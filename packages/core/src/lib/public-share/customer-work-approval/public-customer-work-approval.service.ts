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
		const [estimate, lines] = await Promise.all([
			this.estimates.findOneByOrFail({ id: request.estimateId }),
			this.estimateLines.find({ where: { estimateId: request.estimateId }, order: { lineNumber: 'ASC' } })
		]);
		return {
			request: {
				id: request.id,
				status: request.status,
				expiresAt: request.expiresAt,
				estimateRevisionNumber: request.estimateRevisionNumber
			},
			estimate,
			lines
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
		const approval = await this.approvals.findOneByOrFail({ approvalRequestId: requestId });
		const lines = await this.approvalLines.find({
			where: { customerWorkApprovalId: approval.id },
			order: { createdAt: 'ASC' }
		});
		return { ...approval, lines };
	}
}
