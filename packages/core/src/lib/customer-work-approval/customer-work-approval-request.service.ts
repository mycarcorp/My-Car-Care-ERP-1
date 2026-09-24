import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { addDays } from 'date-fns';
import {
	CustomerWorkApprovalRequestStatusEnum,
	EstimateStatusEnum,
	ICustomerWorkApprovalRequestCreateInput,
	ICustomerWorkApprovalRequestCreateResponse,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';
import { EstimateService } from '../estimate/estimate.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { CustomerWorkApprovalRequest } from './customer-work-approval-request.entity';
import { TypeOrmCustomerWorkApprovalRequestRepository } from './repository/type-orm-customer-work-approval-request.repository';
import { MikroOrmCustomerWorkApprovalRequestRepository } from './repository/mikro-orm-customer-work-approval-request.repository';

/** Default secure-link lifetime, used when the organization has no configured invite-style expiry. */
export const DEFAULT_APPROVAL_REQUEST_EXPIRY_DAYS = 7;

/**
 * The link handed to a customer is a purpose-typed JWT (signature + expiry + purpose all pinned)
 * whose payload embeds a separate high-entropy opaque `secret` claim. Only `sha256(secret)` is ever
 * persisted as `tokenHash` — `EstimateEmail` stored its bearer token verbatim (only `@Exclude`d from
 * serialization, not hashed at rest), which this deliberately does not repeat. Verifying a request
 * therefore requires BOTH a validly signed JWT naming this request AND a secret whose hash matches
 * the stored row — either alone is insufficient.
 */
export function hashApprovalToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class CustomerWorkApprovalRequestService extends TenantAwareCrudService<CustomerWorkApprovalRequest> {
	constructor(
		typeOrmRepository: TypeOrmCustomerWorkApprovalRequestRepository,
		mikroOrmRepository: MikroOrmCustomerWorkApprovalRequestRepository,
		private readonly estimates: EstimateService,
		private readonly organizations: OrganizationService,
		private readonly repairOrders: RepairOrderService,
		private readonly customers: OrganizationContactService,
		private readonly vehicles: VehicleService
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Creates a new secure customer approval request for an estimate revision, superseding any
	 * previously ACTIVE requests for the same estimate lineage.
	 *
	 * Only a DRAFT-or-later, non-superseded, customer-facing revision may generate a request —
	 * enforced by requiring the estimate to be the CURRENT row named by `input.estimateId`
	 * (a superseded/older revision id still resolves via `findOneByIdString`, so its
	 * `rootEstimateId`/`revisionNumber` are pinned onto the request rather than trusted from the caller).
	 */
	async createRequest(
		input: ICustomerWorkApprovalRequestCreateInput
	): Promise<ICustomerWorkApprovalRequestCreateResponse> {
		const estimate = await this.estimates.findOneByIdString(input.estimateId);
		if (
			![EstimateStatusEnum.FINALIZED, EstimateStatusEnum.SENT, EstimateStatusEnum.VIEWED].includes(
				estimate.status
			)
		) {
			throw new BadRequestException(
				'Only a finalized customer-facing estimate revision can generate an approval request.'
			);
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? estimate.organizationId;
		if (
			(tenantId && estimate.tenantId !== tenantId) ||
			(organizationId && estimate.organizationId !== organizationId)
		) {
			throw new BadRequestException('Estimate must belong to the current tenant and organization.');
		}
		const [repairOrder, customer, vehicle] = await Promise.all([
			this.repairOrders.findOneByIdString(estimate.repairOrderId),
			this.customers.findOneByIdString(estimate.customerId),
			this.vehicles.findOneByIdString(estimate.vehicleId)
		]);
		if (
			repairOrder.customerId !== customer.id ||
			repairOrder.vehicleId !== vehicle.id ||
			vehicle.customerId !== customer.id ||
			estimate.customerId !== customer.id ||
			estimate.vehicleId !== vehicle.id ||
			estimate.repairOrderId !== repairOrder.id ||
			[repairOrder, customer, vehicle].some(
				(entity) => entity.tenantId !== estimate.tenantId || entity.organizationId !== estimate.organizationId
			)
		) {
			throw new BadRequestException(
				'Estimate, repair order, customer, and vehicle must share one service chain.'
			);
		}

		const organization = await this.organizations.findOneByIdString(estimate.organizationId);
		const expiryDays = organization?.inviteExpiryPeriod || DEFAULT_APPROVAL_REQUEST_EXPIRY_DAYS;
		const expiresAt = addDays(new Date(), expiryDays);

		// Supersede any still-ACTIVE requests for this estimate's revision lineage: only one link
		// may authorize a submission at a time.
		const rootEstimateId = estimate.rootEstimateId ?? estimate.id;
		await this.typeOrmRepository.update(
			{ estimateRootId: rootEstimateId, status: CustomerWorkApprovalRequestStatusEnum.ACTIVE },
			{ status: CustomerWorkApprovalRequestStatusEnum.SUPERSEDED }
		);

		const secret = randomBytes(32).toString('base64url');
		const tokenHash = hashApprovalToken(secret);

		const request = await super.create({
			estimateId: estimate.id,
			estimateRootId: rootEstimateId,
			estimateRevisionNumber: estimate.revisionNumber,
			repairOrderId: estimate.repairOrderId,
			customerId: estimate.customerId,
			vehicleId: estimate.vehicleId,
			tokenHash,
			expiresAt,
			status: CustomerWorkApprovalRequestStatusEnum.ACTIVE,
			organizationId: estimate.organizationId
		});

		const signedToken = signPurposeToken(
			TokenPurposeEnum.CUSTOMER_WORK_APPROVAL,
			{
				requestId: request.id,
				tenantId: request.tenantId,
				organizationId: request.organizationId,
				customerId: request.customerId,
				vehicleId: request.vehicleId,
				repairOrderId: request.repairOrderId,
				estimateId: request.estimateId,
				estimateRootId: request.estimateRootId,
				estimateRevisionNumber: String(request.estimateRevisionNumber),
				secret
			},
			{ expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) }
		);

		// The raw bearer token (the signed JWT, secret embedded) is returned ONLY here, in the
		// creation response, and never logged or persisted anywhere — this is the one intended
		// link-generation path.
		return { ...request, token: signedToken };
	}

	/** Tenant/org-scoped revocation. A revoked request can never be submitted. */
	async revoke(id: ID): Promise<CustomerWorkApprovalRequest> {
		const request = await this.findOneByIdString(id);
		if (request.status !== CustomerWorkApprovalRequestStatusEnum.ACTIVE) {
			throw new BadRequestException('Only an active request can be revoked.');
		}
		await super.update(id, { status: CustomerWorkApprovalRequestStatusEnum.REVOKED });
		return { ...request, status: CustomerWorkApprovalRequestStatusEnum.REVOKED };
	}
}
