import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { addDays } from 'date-fns';
import {
	CustomerWorkApprovalDeliveryChannelEnum,
	CustomerWorkApprovalDeliveryStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	EstimateStatusEnum,
	ICustomerWorkApprovalRequestCreateInput,
	ICustomerWorkApprovalRequestCreateResponse,
	ID
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { signPurposeToken, TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
import { EstimateService } from '../estimate/estimate.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { EmailSendService } from '../email-send/email-send.service';
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
		private readonly vehicles: VehicleService,
		private readonly emailSendService: EmailSendService
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
		const activeRequest = await this.typeOrmRepository.findOne({
			where: {
				estimateRootId: estimate.rootEstimateId ?? estimate.id,
				status: CustomerWorkApprovalRequestStatusEnum.ACTIVE
			}
		});
		if (activeRequest && activeRequest.expiresAt.getTime() > Date.now()) {
			return { ...activeRequest };
		}

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

		const response: ICustomerWorkApprovalRequestCreateResponse = { ...request, token: signedToken };
		// The raw bearer token (the signed JWT, secret embedded) is returned ONLY here, in the
		// creation response, and never logged or persisted anywhere — this is the one intended
		// link-generation path.
		return response;
	}

	async deliverRequest(
		id: ID,
		token: string,
		deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum = CustomerWorkApprovalDeliveryChannelEnum.EMAIL
	): Promise<ICustomerWorkApprovalRequestCreateResponse> {
		const request = await this.findOneByIdString(id);
		if (request.status !== CustomerWorkApprovalRequestStatusEnum.ACTIVE) {
			throw new BadRequestException('This approval request is no longer active.');
		}
		if (request.expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException('This approval request has expired.');
		}

		const claims = verifyPurposeToken<{
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
		}>(token, TokenPurposeEnum.CUSTOMER_WORK_APPROVAL, {
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
		if (claims.requestId !== id) {
			throw new BadRequestException('This approval request no longer matches the provided token.');
		}

		const receivedHash = Buffer.from(hashApprovalToken(claims.secret), 'hex');
		const storedHash = Buffer.from(request.tokenHash, 'hex');
		if (storedHash.length !== receivedHash.length || !timingSafeEqual(storedHash, receivedHash)) {
			throw new BadRequestException('This approval request no longer matches the provided token.');
		}

		const customer = await this.customers.findOneByIdString(request.customerId);
		const delivery = await this.sendDelivery(request, token, deliveryChannel, customer);
		return { ...request, ...delivery };
	}

	private buildApprovalUrl(requestId: ID, token: string): string {
		const url = new URL(`/share/customer-work-approval/${requestId}`, env.clientBaseUrl);
		url.searchParams.set('token', token);
		return url.toString();
	}

	private async sendDelivery(
		request: CustomerWorkApprovalRequest,
		token: string,
		deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum,
		customer: { primaryEmail?: string; primaryPhone?: string }
	): Promise<Pick<ICustomerWorkApprovalRequestCreateResponse, 'deliveryChannel' | 'deliveryStatus' | 'deliveryAttemptedAt' | 'deliveryError'>> {
		const attemptedAt = new Date();
		if (deliveryChannel === CustomerWorkApprovalDeliveryChannelEnum.SMS) {
			const delivery = {
				deliveryChannel,
				deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE,
				deliveryAttemptedAt: attemptedAt,
				deliveryError: 'SMS delivery is not available in this workspace.'
			} satisfies Pick<
				ICustomerWorkApprovalRequestCreateResponse,
				'deliveryChannel' | 'deliveryStatus' | 'deliveryAttemptedAt' | 'deliveryError'
			>;
			await this.typeOrmRepository.update({ id: request.id }, delivery);
			return delivery;
		}

		if (!customer?.primaryEmail) {
			const delivery = {
				deliveryChannel,
				deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE,
				deliveryAttemptedAt: attemptedAt,
				deliveryError: 'Customer email is missing.'
			} satisfies Pick<
				ICustomerWorkApprovalRequestCreateResponse,
				'deliveryChannel' | 'deliveryStatus' | 'deliveryAttemptedAt' | 'deliveryError'
			>;
			await this.typeOrmRepository.update({ id: request.id }, delivery);
			return delivery;
		}

		try {
			const approvalUrl = this.buildApprovalUrl(request.id, token);
			const transport = await this.emailSendService.getEmailInstance({
				organizationId: request.organizationId,
				tenantId: request.tenantId
			});
			await transport.send({
				message: {
					to: customer.primaryEmail,
					subject: `Secure approval link for estimate #${request.estimateRevisionNumber}`,
					html: `<p>Your secure approval link is ready.</p><p><a href="${approvalUrl}">Open approval request</a></p>`
				}
			});

			const delivery = {
				deliveryChannel,
				deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.SENT,
				deliveryAttemptedAt: attemptedAt,
				deliveryError: undefined
			} satisfies Pick<
				ICustomerWorkApprovalRequestCreateResponse,
				'deliveryChannel' | 'deliveryStatus' | 'deliveryAttemptedAt' | 'deliveryError'
			>;
			await this.typeOrmRepository.update({ id: request.id }, delivery);
			return delivery;
		} catch (error) {
			const isUnavailable = /SMTP configuration is not set|smtp configuration is not set/i.test(error?.message ?? '');
			const delivery = {
				deliveryChannel,
				deliveryStatus: isUnavailable
					? CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE
					: CustomerWorkApprovalDeliveryStatusEnum.FAILED,
				deliveryAttemptedAt: attemptedAt,
				deliveryError: error?.message || 'Unable to deliver the approval link.'
			} satisfies Pick<
				ICustomerWorkApprovalRequestCreateResponse,
				'deliveryChannel' | 'deliveryStatus' | 'deliveryAttemptedAt' | 'deliveryError'
			>;
			await this.typeOrmRepository.update({ id: request.id }, delivery);
			return delivery;
		}
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
