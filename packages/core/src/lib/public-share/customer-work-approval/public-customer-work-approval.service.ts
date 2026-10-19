import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import {
	CustomerWorkApprovalChannelEnum,
	CustomerWorkApprovalRequestStatusEnum,
	ICustomerWorkApprovalConfirmationView,
	ICustomerWorkApprovalPublicView,
	ICustomerWorkApprovalSubmitInput,
	ID
} from '@gauzy/contracts';
import { CustomerWorkApprovalRequest } from '../../customer-work-approval/customer-work-approval-request.entity';
import { CustomerWorkApproval } from '../../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalService } from '../../customer-work-approval/customer-work-approval.service';
import { hashApprovalToken } from '../../customer-work-approval/customer-work-approval-request.service';
import { Estimate } from '../../estimate/estimate.entity';
import { EstimateLine } from '../../estimate/estimate-line.entity';
import { isNonEmptyString, TokenPurposeEnum, verifyPurposeToken } from '../../auth/purpose-token';
import { TypeOrmCustomerWorkApprovalRequestRepository } from '../../customer-work-approval/repository/type-orm-customer-work-approval-request.repository';
import { TypeOrmCustomerWorkApprovalRepository } from '../../customer-work-approval/repository/type-orm-customer-work-approval.repository';
import { TypeOrmCustomerWorkApprovalLineRepository } from '../../customer-work-approval/repository/type-orm-customer-work-approval-line.repository';
import { TypeOrmEstimateRepository } from '../../estimate/repository/type-orm-estimate.repository';
import { TypeOrmEstimateLineRepository } from '../../estimate/repository/type-orm-estimate-line.repository';

interface ApprovalTokenClaims {
	requestId: ID;
	tenantId: ID;
	organizationId: ID;
	customerId: ID;
	vehicleId: ID;
	repairOrderId: ID;
	estimateId: ID;
	estimateRootId: ID;
	estimateRevisionNumber: string;
	secret: string;
}

@Injectable()
export class PublicCustomerWorkApprovalService {
	constructor(
		private readonly requests: TypeOrmCustomerWorkApprovalRequestRepository,
		private readonly approvals: TypeOrmCustomerWorkApprovalRepository,
		private readonly approvalLines: TypeOrmCustomerWorkApprovalLineRepository,
		private readonly estimates: TypeOrmEstimateRepository,
		private readonly estimateLines: TypeOrmEstimateLineRepository,
		private readonly submissionService: CustomerWorkApprovalService
	) {}

	async view(
		requestId: ID,
		token: string
	): Promise<ICustomerWorkApprovalPublicView | ICustomerWorkApprovalConfirmationView> {
		const request = await this.validateLink(requestId, token, true);
		if (request.status === CustomerWorkApprovalRequestStatusEnum.SUBMITTED) {
			return this.confirmationFor(request.id);
		}
		// Customer-safe projections: fetch only the columns the public page renders. No tenant/org
		// ids, internal user ids, deletion/audit metadata, or unrelated linkage ids are selected.
		const [estimate, lines] = await Promise.all([
			this.estimates.findOneOrFail({
				where: { id: request.estimateId },
				select: {
					id: true,
					estimateNumber: true,
					revisionNumber: true,
					currency: true,
					subtotal: true,
					taxTotal: true,
					discountTotal: true,
					total: true
				},
				relations: { repairOrder: { vehicle: true } }
			}),
			this.estimateLines.find({
				where: { estimateId: request.estimateId },
				order: { lineNumber: 'ASC' },
				select: {
					id: true,
					estimateId: true,
					lineNumber: true,
					description: true,
					reason: true,
					priority: true,
					quantity: true,
					unitPrice: true,
					taxAmount: true,
					discountAmount: true,
					lineTotal: true
				}
			})
		]);
		return {
			request: {
				id: request.id,
				status: request.status,
				expiresAt: request.expiresAt,
				estimateRevisionNumber: request.estimateRevisionNumber
			},
			estimate: this.toPublicEstimate(estimate),
			lines: lines.map((line) => this.toPublicEstimateLine(line))
		};
	}

	async submit(
		requestId: ID,
		token: string,
		input: ICustomerWorkApprovalSubmitInput,
		evidence: { ip?: string | null; userAgent?: string | null }
	): Promise<CustomerWorkApproval> {
		const request = await this.validateLink(requestId, token, false);
		if (request.status === CustomerWorkApprovalRequestStatusEnum.SUBMITTED) {
			throw new ConflictException('This approval request has already been submitted.');
		}
		return this.submissionService.submit(request.id, input, {
			...evidence,
			channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK
		});
	}

	async confirmation(requestId: ID, token: string): Promise<ICustomerWorkApprovalConfirmationView> {
		const request = await this.validateLink(requestId, token, true);
		if (request.status !== CustomerWorkApprovalRequestStatusEnum.SUBMITTED) {
			throw new BadRequestException('This approval request has not been submitted.');
		}
		return this.confirmationFor(request.id);
	}

	/**
	 * Verifies the JWT (HS256, signature, purpose, expiry and all claims) then independently binds
	 * every claim and the opaque secret hash to a stored request. JWT claims are never authorization
	 * on their own.
	 */
	private async validateLink(
		requestId: ID,
		token: string,
		allowSubmitted: boolean
	): Promise<CustomerWorkApprovalRequest> {
		if (!isNonEmptyString(requestId) || !isNonEmptyString(token))
			throw new ForbiddenException('Invalid approval link.');
		let claims: ApprovalTokenClaims;
		try {
			claims = verifyPurposeToken<ApprovalTokenClaims>(token, TokenPurposeEnum.CUSTOMER_WORK_APPROVAL, {
				requiredClaims: [
					'requestId',
					'tenantId',
					'organizationId',
					'customerId',
					'vehicleId',
					'repairOrderId',
					'estimateId',
					'estimateRootId',
					'estimateRevisionNumber',
					'secret'
				]
			});
		} catch {
			throw new ForbiddenException('Invalid approval link.');
		}
		if (claims.requestId !== requestId) throw new ForbiddenException('Invalid approval link.');

		let request: CustomerWorkApprovalRequest;
		try {
			request = await this.requests.findOneByOrFail({ id: requestId });
		} catch {
			throw new NotFoundException('Approval request not found.');
		}

		const expectedHash = Buffer.from(request.tokenHash, 'hex');
		const receivedHash = Buffer.from(hashApprovalToken(claims.secret), 'hex');
		const hashMatches = expectedHash.length === receivedHash.length && timingSafeEqual(expectedHash, receivedHash);
		if (
			!hashMatches ||
			request.tenantId !== claims.tenantId ||
			request.organizationId !== claims.organizationId ||
			request.customerId !== claims.customerId ||
			request.vehicleId !== claims.vehicleId ||
			request.repairOrderId !== claims.repairOrderId ||
			request.estimateId !== claims.estimateId ||
			request.estimateRootId !== claims.estimateRootId ||
			String(request.estimateRevisionNumber) !== claims.estimateRevisionNumber
		) {
			throw new ForbiddenException('Invalid approval link.');
		}

		if (
			request.expiresAt.getTime() <= Date.now() &&
			request.status === CustomerWorkApprovalRequestStatusEnum.ACTIVE
		) {
			await this.requests.update(request.id, { status: CustomerWorkApprovalRequestStatusEnum.EXPIRED });
			request.status = CustomerWorkApprovalRequestStatusEnum.EXPIRED;
		}
		if (request.status === CustomerWorkApprovalRequestStatusEnum.SUBMITTED && allowSubmitted) return request;
		if (request.status !== CustomerWorkApprovalRequestStatusEnum.ACTIVE) {
			throw new ForbiddenException('This approval link is no longer active.');
		}
		return request;
	}

	private async confirmationFor(requestId: ID): Promise<ICustomerWorkApprovalConfirmationView> {
		// Customer-safe projection: select only the confirmation fields the public page renders.
		const approval = await this.approvals.findOneOrFail({
			where: { approvalRequestId: requestId },
			select: {
				id: true,
				estimateRevisionNumber: true,
				submittedAt: true,
				approvedTotal: true,
				currency: true,
				submissionState: true
			}
		});
		const lines = await this.approvalLines.find({
			where: { customerWorkApprovalId: approval.id },
			order: { createdAt: 'ASC' },
			select: {
				id: true,
				customerWorkApprovalId: true,
				estimateLineId: true,
				selected: true,
				approvedQuantity: true,
				priority: true,
				description: true,
				reason: true,
				unitPrice: true,
				taxAmount: true,
				discountAmount: true,
				lineTotal: true
			}
		});
		return {
			id: approval.id,
			estimateRevisionNumber: approval.estimateRevisionNumber,
			submittedAt: approval.submittedAt,
			approvedTotal: approval.approvedTotal,
			currency: approval.currency,
			submissionState: approval.submissionState,
			lines
		};
	}

	/**
	 * Maps a narrowly-selected Estimate to its customer-safe public shape. The vehicle label
	 * fields (year/make/model) are nested under `repairOrder.vehicle` to match the existing
	 * frontend `vehicleLabel` accessor; no other repair-order/vehicle graph data is included.
	 * No internal ids, tenant/org metadata, or audit fields are carried through.
	 */
	private toPublicEstimate(estimate: Estimate): ICustomerWorkApprovalPublicView['estimate'] {
		const vehicle = estimate?.repairOrder?.['vehicle'];
		return {
			id: estimate.id,
			estimateNumber: estimate.estimateNumber,
			revisionNumber: estimate.revisionNumber,
			currency: estimate.currency,
			subtotal: estimate.subtotal,
			taxTotal: estimate.taxTotal,
			discountTotal: estimate.discountTotal,
			total: estimate.total,
			// Vehicle label only: year/make/model, nothing else from the repair order graph.
			repairOrder: vehicle
				? { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model } }
				: undefined
		};
	}

	/** Maps a narrowly-selected EstimateLine to its customer-safe public shape. */
	private toPublicEstimateLine(line: EstimateLine): ICustomerWorkApprovalPublicView['lines'][number] {
		return {
			id: line.id,
			estimateId: line.estimateId,
			lineNumber: line.lineNumber,
			description: line.description,
			reason: line.reason,
			priority: line.priority,
			quantity: line.quantity,
			unitPrice: line.unitPrice,
			taxAmount: line.taxAmount,
			discountAmount: line.discountAmount,
			lineTotal: line.lineTotal
		};
	}
}
