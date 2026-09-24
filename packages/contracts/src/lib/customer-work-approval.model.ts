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
}

/**
 * Response for request creation — the ONLY place the raw bearer token is ever returned.
 * It is never persisted and never returned again.
 */
export interface ICustomerWorkApprovalRequestCreateResponse extends ICustomerWorkApprovalRequest {
	token: string;
}

/** Customer submission payload: exactly one decision per presented estimate line. */
export interface ICustomerWorkApprovalSubmitInput {
	decisions: ICustomerWorkApprovalLineDecisionInput[];
}

/** Read-only public view of an ACTIVE request, before submission. */
export interface ICustomerWorkApprovalPublicView {
	request: Pick<ICustomerWorkApprovalRequest, 'id' | 'status' | 'expiresAt' | 'estimateRevisionNumber'>;
	estimate: IEstimate;
	lines: IEstimateLine[];
}

/** Read-only confirmation view of a SUBMITTED request. */
export interface ICustomerWorkApprovalConfirmationView extends ICustomerWorkApproval {
	lines: ICustomerWorkApprovalLine[];
}
