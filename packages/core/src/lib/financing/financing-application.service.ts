import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
	CurrenciesEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	EstimateStatusEnum,
	FINANCING_ACTIVE_KEY,
	FinancingApplicationStatusEnum,
	ID,
	IFinancingApplicationCreateInput,
	IFinancingApplicationTransitionInput,
	IFinancingApplicationUpdateInput,
	InvoiceStatusTypesEnum,
	PermissionsEnum,
	PaymentMethodEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { EstimateService } from '../estimate/estimate.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { Invoice } from '../invoice/invoice.entity';
import { PaymentService } from '../payment/payment.service';
import { FinancingApplication } from './financing-application.entity';
import { TypeOrmFinancingApplicationRepository } from './repository/type-orm-financing-application.repository';
import { MikroOrmFinancingApplicationRepository } from './repository/mikro-orm-financing-application.repository';

/**
 * Financing application lifecycle. DRAFT → SUBMITTED → PENDING → APPROVED/DECLINED →
 * ACCEPTED/CANCELLED. DECLINED/CANCELLED are terminal in Phase 1; APPROVED is never FUNDED.
 * FUNDED is reserved for a later phase and is not reachable here.
 */
const FINANCING_TRANSITIONS: Record<FinancingApplicationStatusEnum, FinancingApplicationStatusEnum[]> = {
	[FinancingApplicationStatusEnum.DRAFT]: [FinancingApplicationStatusEnum.SUBMITTED],
	[FinancingApplicationStatusEnum.SUBMITTED]: [
		FinancingApplicationStatusEnum.PENDING,
		FinancingApplicationStatusEnum.CANCELLED
	],
	[FinancingApplicationStatusEnum.PENDING]: [
		FinancingApplicationStatusEnum.APPROVED,
		FinancingApplicationStatusEnum.DECLINED,
		FinancingApplicationStatusEnum.CANCELLED
	],
	[FinancingApplicationStatusEnum.APPROVED]: [
		FinancingApplicationStatusEnum.ACCEPTED,
		FinancingApplicationStatusEnum.CANCELLED
	],
	[FinancingApplicationStatusEnum.ACCEPTED]: [],
	[FinancingApplicationStatusEnum.DECLINED]: [],
	[FinancingApplicationStatusEnum.CANCELLED]: [],
	[FinancingApplicationStatusEnum.FUNDED]: []
};

// FUNDED is terminal but is NOT cleared by the generic transition path; it is reached only via
// the dedicated atomic `fund()` method, which clears the sentinel after recording the payment.
const TERMINAL_STATUSES = [
	FinancingApplicationStatusEnum.DECLINED,
	FinancingApplicationStatusEnum.CANCELLED,
	FinancingApplicationStatusEnum.FUNDED
];

@Injectable()
export class FinancingApplicationService extends TenantAwareCrudService<FinancingApplication> {
	constructor(
		typeOrmRepository: TypeOrmFinancingApplicationRepository,
		mikroOrmRepository: MikroOrmFinancingApplicationRepository,
		private readonly repairOrderService: RepairOrderService,
		private readonly estimateService: EstimateService,
		private readonly customerService: OrganizationContactService,
		private readonly vehicleService: VehicleService,
		@InjectRepository(CustomerWorkApproval)
	private readonly approvals: Repository<CustomerWorkApproval>,
	@InjectRepository(Invoice)
	private readonly invoices: Repository<Invoice>,
	private readonly paymentService: PaymentService
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Creates a DRAFT financing application after validating the full relationship chain:
	 * RO/Estimate/Customer/Vehicle/Approval must share the current tenant+organization, the
	 * Estimate must belong to the RO, and the Customer Work Approval must be a SUBMITTED record
	 * for the same RO+Estimate+customer+vehicle.
	 *
	 * Concurrency: the `activeKey` sentinel is written in the same INSERT, and the composite unique
	 * index on (tenantId, repairOrderId, activeKey) is the final enforcement mechanism. A duplicate
	 * active application surfaces as a unique-constraint violation, mapped to ConflictException
	 * without leaking database internals.
	 */
	async createApplication(input: IFinancingApplicationCreateInput): Promise<FinancingApplication> {
		const [repairOrder, estimate] = await Promise.all([
			this.repairOrderService.findOneByIdString(input.repairOrderId),
			this.estimateService.findOneByIdString(input.estimateId)
		]);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? repairOrder.organizationId;

		const approval = await this.approvals.findOne({
			where: { id: input.customerWorkApprovalId, tenantId, organizationId } as any
		});
		if (!approval || approval.submissionState !== CustomerWorkApprovalSubmissionStateEnum.SUBMITTED) {
			throw new BadRequestException('A submitted customer approval is required before financing.');
		}

		if (
			estimate.repairOrderId !== repairOrder.id ||
			approval.repairOrderId !== repairOrder.id ||
			approval.estimateId !== estimate.id ||
			approval.customerId !== repairOrder.customerId ||
			approval.vehicleId !== repairOrder.vehicleId ||
			(tenantId &&
				(repairOrder.tenantId !== tenantId ||
					estimate.tenantId !== tenantId ||
					approval.tenantId !== tenantId)) ||
			(organizationId &&
				(repairOrder.organizationId !== organizationId ||
					estimate.organizationId !== organizationId ||
					approval.organizationId !== organizationId))
		) {
			throw new BadRequestException(
				'Financing application repair order, estimate, customer, vehicle, and approval must share one service chain.'
			);
		}

		// The repair order must be active (not terminal). CLOSED/CANCELLED repair orders are ineligible.
		if ([RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED].includes(repairOrder.status)) {
			throw new BadRequestException('Financing is not available for a closed or cancelled repair order.');
		}

		// The estimate must be a customer-facing revision. A SUBMITTED approval can only exist for a
		// FINALIZED/SENT/VIEWED estimate (enforced at approval-request creation), so DRAFT/SUPERSEDED/
		// EXPIRED/CANCELLED estimates are ineligible even if a stale approval references them.
		if (
			![EstimateStatusEnum.FINALIZED, EstimateStatusEnum.SENT, EstimateStatusEnum.VIEWED].includes(estimate.status)
		) {
			throw new BadRequestException('Financing requires a finalized customer-facing estimate.');
		}

		// The requested amount must be positive and may not exceed the customer's approved work total.
		const requestedAmount = Number(input.requestedAmount);
		if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
			throw new BadRequestException('Requested financing amount must be greater than zero.');
		}
		// The approved total must be a valid finite number before it can act as the ceiling. A missing,
		// non-numeric, or non-finite approved total is rejected rather than silently bypassing the cap.
		const approvedTotal = Number(approval.approvedTotal);
		if (!Number.isFinite(approvedTotal)) {
			throw new BadRequestException('The customer approval has no valid approved total to finance against.');
		}
		if (requestedAmount > approvedTotal) {
			throw new BadRequestException('Requested financing amount cannot exceed the approved total.');
		}

		// One active application per repair order. The duplicate check excludes terminal rows
		// explicitly via the validated active marker; the unique index is the final enforcement.
		const existingActive = await this.typeOrmRepository.findOne({
			where: { repairOrderId: repairOrder.id, tenantId, organizationId, activeKey: FINANCING_ACTIVE_KEY } as any
		});
		if (existingActive) {
			throw new ConflictException('An active financing application already exists for this repair order.');
		}

		try {
			// Persist directly through the TypeORM repository so a unique-constraint violation surfaces
			// as a driver error we can map to ConflictException. CrudService.create would wrap it in a
			// generic BadRequestException, hiding the constraint. tenantId/organizationId are set
			// explicitly from the validated, in-scope repair order.
			const newEntity = this.typeOrmRepository.create({
				tenantId,
				organizationId: repairOrder.organizationId,
				repairOrderId: repairOrder.id,
				customerId: repairOrder.customerId,
				vehicleId: repairOrder.vehicleId,
				estimateId: estimate.id,
				customerWorkApprovalId: approval.id,
				provider: input.provider,
				requestedAmount: input.requestedAmount,
				currency: input.currency,
				status: FinancingApplicationStatusEnum.DRAFT,
				activeKey: FINANCING_ACTIVE_KEY
			} as Partial<FinancingApplication>);
			return await this.typeOrmRepository.save(newEntity);
		} catch (error) {
			// Map a unique-constraint violation (a concurrent active application) to a safe conflict
			// without leaking the SQL statement or driver details.
			if (this.isUniqueConstraintViolation(error)) {
				throw new ConflictException('An active financing application already exists for this repair order.');
			}
			throw error;
		}
	}

	/**
	 * Detects a unique-constraint violation across the supported drivers (Postgres 23505,
	 * MySQL ER_DUP_ENTRY, SQLite SQLITE_CONSTRAINT_UNIQUE / SQLITE_CONSTRAINT) without exposing
	 * database internals to the caller.
	 */
	private isUniqueConstraintViolation(error: any): boolean {
		const code = error?.code ?? error?.driverError?.code;
		if (!code) return false;
		return (
			code === '23505' ||
			code === 'ER_DUP_ENTRY' ||
			code === 'SQLITE_CONSTRAINT_UNIQUE' ||
			code === 'SQLITE_CONSTRAINT'
		);
	}

	/**
	 * Applies a controlled lifecycle transition. Only declared transitions are permitted;
	 * terminal states accept none. Reaching a terminal state clears the uniqueness `activeKey`.
	 * APPROVED/DECLINED decisions may carry `approvedAmount`/`rejectionReason`; those payloads are
	 * ignored for every other target. Status is never settable through the generic update path.
	 */
	async transition(id: ID, input: IFinancingApplicationTransitionInput): Promise<FinancingApplication> {
		const to = input.status;
		const application = await this.findOneByIdString(id);
		// findOneByIdString scopes by tenant only; enforce the organization boundary explicitly.
		this.assertSameOrganization(application);
		// The transition route admits ORG_FINANCING_EDIT (submit/cancel) as well as APPROVE. Decision
		// actions (approve/decline) must remain restricted to ORG_FINANCING_APPROVE; enforce it here.
		if (
			(to === FinancingApplicationStatusEnum.APPROVED || to === FinancingApplicationStatusEnum.DECLINED) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_FINANCING_APPROVE)
		) {
			throw new ForbiddenException('Only a financing approver can approve or decline an application.');
		}
		const allowed = FINANCING_TRANSITIONS[application.status] ?? [];
		if (!allowed.includes(to)) {
			throw new BadRequestException(`Cannot move a financing application from ${application.status} to ${to}.`);
		}
		const patch: Partial<FinancingApplication> = { status: to };
		const now = new Date();
		if (to === FinancingApplicationStatusEnum.SUBMITTED) patch.submittedAt = now;
		if (to === FinancingApplicationStatusEnum.APPROVED || to === FinancingApplicationStatusEnum.DECLINED) {
			patch.decidedAt = now;
			if (to === FinancingApplicationStatusEnum.APPROVED && input.approvedAmount !== undefined)
				patch.approvedAmount = input.approvedAmount;
			if (to === FinancingApplicationStatusEnum.DECLINED && input.rejectionReason !== undefined)
				patch.rejectionReason = input.rejectionReason;
		}
		if (to === FinancingApplicationStatusEnum.ACCEPTED) patch.acceptedAt = now;
		if (TERMINAL_STATUSES.includes(to)) patch.activeKey = null;
		await this.typeOrmRepository.update({ id: application.id }, patch as any);
		return { ...application, ...patch };
	}

	/**
	 * Records funding for an ACCEPTED financing application, atomically.
	 *
	 * Inside a single transaction: re-loads the application and asserts it is still ACCEPTED
	 * (this is the duplicate/concurrency guard — the row's status is re-checked against the
	 * transaction's view, so a concurrent funding that already committed FUNDED is rejected);
	 * resolves the repair order's existing invoice (rejecting missing/VOID/foreign invoices);
	 * computes the funding amount from the invoice's current server-side `amountDue`; verifies
	 * the approved financing covers the full remaining balance; records the payment through the
	 * existing payment engine (which recalculates the invoice authoritatively); and only then
	 * marks the application FUNDED, stamping fundedAt/fundedAmount/invoiceId and clearing the
	 * active sentinel. Any failure rolls the whole transaction back — no partial funding.
	 *
	 * The client never supplies the amount, invoice, or any lifecycle/timestamp field.
	 */
	async fund(id: ID): Promise<FinancingApplication> {
		const application = await this.findOneByIdString(id);
		this.assertSameOrganization(application);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = application.organizationId;

		return await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			// Atomic admission claim: flip ACCEPTED → FUNDED in a single conditional UPDATE keyed on
			// id + tenant + organization + status. Only the request that actually transitions the row
			// sees `affected === 1`; any concurrent or duplicate funding finds the row already claimed
			// (affected 0) and fails closed. This is the repository's portable claim pattern — it avoids
			// `SELECT … FOR UPDATE`, which is not supported on every driver we support (better-sqlite3).
			// The payment, invoice recalculation, and the sentinel clear happen in the SAME transaction,
			// so a payment failure rolls the claim back and leaves the application ACCEPTED.
			const fundedAt = new Date();
			const claim = await manager.update(
				FinancingApplication,
				{
					id: application.id,
					tenantId,
					organizationId,
					status: FinancingApplicationStatusEnum.ACCEPTED
				} as any,
				{ status: FinancingApplicationStatusEnum.FUNDED, fundedAt } as any
			);
			if (claim.affected !== 1) {
				throw new ConflictException('This financing application has already been funded or is no longer accepted.');
			}

			// Resolve the repair order's existing invoice within scope; never auto-generate here.
			const invoice = await manager.findOne(Invoice, {
				where: { repairOrderId: application.repairOrderId, tenantId, organizationId } as any
			});
			if (!invoice) {
				throw new BadRequestException(
					'No invoice exists for this repair order. Generate the invoice once the repair order is eligible, then record funding.'
				);
			}
			if (invoice.status === InvoiceStatusTypesEnum.VOID) {
				throw new BadRequestException('A void invoice cannot be funded.');
			}

			// Funding settles the remaining balance, computed from the authoritative server-side amountDue.
			const fundedAmount = Number(invoice.amountDue);
			if (!Number.isFinite(fundedAmount) || fundedAmount <= 0) {
				throw new BadRequestException('The invoice has no outstanding balance to fund.');
			}

			// The approved financing offer must cover the full remaining balance.
			const approvedTotal = Number(application.approvedAmount);
			if (!Number.isFinite(approvedTotal) || approvedTotal < fundedAmount) {
				throw new BadRequestException(
					'The approved financing amount does not cover the remaining invoice balance.'
				);
			}

			// Record the funding payment through the existing payment engine (same transaction), so the
			// invoice's alreadyPaid/amountDue/status recalculation stays authoritative and atomic.
			await this.paymentService.createWithManager(
				{
					amount: fundedAmount,
					currency: invoice.currency as CurrenciesEnum,
					invoiceId: invoice.id,
					paymentDate: new Date(),
					paymentMethod: PaymentMethodEnum.BANK_TRANSFER,
					note: `Financing funding for application ${application.id}`,
				} as any,
				manager,
				{ tenantId, organizationId }
			);

			// Finalize the funding fields and clear the sentinel, in the same transaction as the claim
			// and the payment. Any failure above rolls back the claim, the payment, and this update.
			const patch: Partial<FinancingApplication> = {
				fundedAmount,
				invoiceId: invoice.id,
				activeKey: null
			};
			await manager.update(FinancingApplication, { id: application.id }, patch as any);
			return {
				...application,
				status: FinancingApplicationStatusEnum.FUNDED,
				fundedAt,
				...patch
			} as FinancingApplication;
		});
	}

	/**
	 * Update is restricted to non-lifecycle fields on a DRAFT application. Lifecycle status and
	 * protected fields can never be modified through this path.
	 */
	async updateApplication(id: ID, input: IFinancingApplicationUpdateInput) {
		const application = await this.findOneByIdString(id);
		// findOneByIdString scopes by tenant only; enforce the organization boundary explicitly.
		this.assertSameOrganization(application);
		if (application.status !== FinancingApplicationStatusEnum.DRAFT) {
			throw new BadRequestException('Only a draft financing application can be edited.');
		}
		const safe: IFinancingApplicationUpdateInput = {
			...(input.provider !== undefined ? { provider: input.provider } : {}),
			...(input.requestedAmount !== undefined ? { requestedAmount: input.requestedAmount } : {}),
			...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {})
		};
		return super.update(id, safe as any);
	}

	/**
	 * Ensures the loaded application belongs to the caller's organization (when one is in context).
	 * findOneByIdString enforces the tenant boundary; this closes the same-tenant/different-org gap.
	 */
	private assertSameOrganization(application: FinancingApplication): void {
		const organizationId = RequestContext.currentOrganizationId();
		if (organizationId && application.organizationId && application.organizationId !== organizationId) {
			throw new ForbiddenException('Financing application belongs to another organization.');
		}
	}
}
