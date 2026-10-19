import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { EstimateLinePriorityEnum, IEstimate, IEstimateLine } from './estimate.model';

export enum CustomerWorkApprovalRequestStatusEnum {
	ACTIVE = 'ACTIVE',
	SUBMITTED = 'SUBMITTED',
	EXPIRED = 'EXPIRED',
	REVOKED = 'REVOKED',
	SUPERSEDED = 'SUPERSEDED'
}

export enum CustomerWorkApprovalSubmissionStateEnum {
	SUBMITTED = 'SUBMITTED'
}

export enum CustomerWorkApprovalChannelEnum {
	SMS_SECURE_LINK = 'SMS_SECURE_LINK'
}

export enum CustomerWorkApprovalDeliveryChannelEnum {
	EMAIL = 'EMAIL',
	SMS = 'SMS'
}

export enum CustomerWorkApprovalDeliveryStatusEnum {
	SENT = 'SENT',
	FAILED = 'FAILED',
	UNAVAILABLE = 'UNAVAILABLE'
}

export interface ICustomerWorkApprovalRequest extends IBasePerTenantAndOrganizationEntityModel {
	estimateId: ID;
	estimateRootId: ID;
	estimateRevisionNumber: number;
	repairOrderId: ID;
	customerId: ID;
	vehicleId: ID;
	tokenHash: string;
	expiresAt: Date;
	status: CustomerWorkApprovalRequestStatusEnum;
	deliveryChannel?: CustomerWorkApprovalDeliveryChannelEnum;
	deliveryStatus?: CustomerWorkApprovalDeliveryStatusEnum;
	deliveryAttemptedAt?: Date;
	deliveryError?: string;
}

export interface ICustomerWorkApproval extends IBasePerTenantAndOrganizationEntityModel {
	approvalRequestId: ID;
	customerId: ID;
	vehicleId: ID;
	repairOrderId: ID;
	estimateId: ID;
	estimateRevisionNumber: number;
	submittedAt: Date;
	approvedTotal: number;
	currency: string;
	submissionState: CustomerWorkApprovalSubmissionStateEnum;
	estimateSnapshotHash: string;
	ipHash?: string;
	userAgent?: string;
	channel: CustomerWorkApprovalChannelEnum;
}

export interface ICustomerWorkApprovalLine extends IBasePerTenantAndOrganizationEntityModel {
	customerWorkApprovalId: ID;
	estimateLineId: ID;
	selected: boolean;
	approvedQuantity: number;
	priority: EstimateLinePriorityEnum;
	description: string;
	reason: string;
	unitPrice: number;
	taxAmount: number;
	discountAmount?: number;
	lineTotal: number;
}

/** One customer decision on a single presented `EstimateLine`. */
export interface ICustomerWorkApprovalLineDecisionInput {
	estimateLineId: ID;
	selected: boolean;
}

/** Staff request to generate a new secure customer approval link for an estimate revision. */
export interface ICustomerWorkApprovalRequestCreateInput {
	estimateId: ID;
	deliveryChannel?: CustomerWorkApprovalDeliveryChannelEnum;
}

/**
 * Response for request creation — the ONLY place the raw bearer token is ever returned.
 * It is never persisted and never returned again.
 */
export interface ICustomerWorkApprovalRequestCreateResponse extends ICustomerWorkApprovalRequest {
	token?: string;
}

/** Customer submission payload: exactly one decision per presented estimate line. */
export interface ICustomerWorkApprovalSubmitInput {
	decisions: ICustomerWorkApprovalLineDecisionInput[];
}

/** Read-only public view of an ACTIVE request, before submission. */
export interface ICustomerWorkApprovalPublicView {
	request: Pick<ICustomerWorkApprovalRequest, 'id' | 'status' | 'expiresAt' | 'estimateRevisionNumber'>;
	/** Customer-safe estimate projection — no tenant/org ids, internal user ids, or audit fields. */
	estimate: Pick<
		IEstimate,
		'id' | 'estimateNumber' | 'revisionNumber' | 'currency' | 'subtotal' | 'taxTotal' | 'discountTotal' | 'total'
	> & {
		/** Vehicle label only (year/make/model) for the approval header; nothing else from the RO graph. */
		repairOrder?: { vehicle: { year?: number; make?: string; model?: string } };
	};
	/** Customer-safe estimate-line projection. */
	lines: Pick<
		IEstimateLine,
		| 'id'
		| 'estimateId'
		| 'lineNumber'
		| 'description'
		| 'reason'
		| 'priority'
		| 'quantity'
		| 'unitPrice'
		| 'taxAmount'
		| 'discountAmount'
		| 'lineTotal'
	>[];
}

/** Read-only confirmation view of a SUBMITTED request (customer-safe projection). */
export interface ICustomerWorkApprovalConfirmationView {
	id: ID;
	estimateRevisionNumber: number;
	submittedAt: Date;
	approvedTotal: number;
	currency: string;
	submissionState: CustomerWorkApprovalSubmissionStateEnum;
	lines: Pick<
		ICustomerWorkApprovalLine,
		| 'id'
		| 'customerWorkApprovalId'
		| 'estimateLineId'
		| 'selected'
		| 'approvedQuantity'
		| 'priority'
		| 'description'
		| 'reason'
		| 'unitPrice'
		| 'taxAmount'
		| 'discountAmount'
		| 'lineTotal'
	>[];
}
