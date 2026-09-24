import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
export enum EstimateStatusEnum {
	DRAFT = 'DRAFT',
	FINALIZED = 'FINALIZED',
	SENT = 'SENT',
	VIEWED = 'VIEWED',
	SUPERSEDED = 'SUPERSEDED',
	EXPIRED = 'EXPIRED',
	CANCELLED = 'CANCELLED'
}
export enum EstimateLinePriorityEnum {
	MUST_FIX = 'MUST_FIX',
	RECOMMENDED = 'RECOMMENDED'
}
export interface IEstimate extends IBasePerTenantAndOrganizationEntityModel {
	repairOrderId: ID;
	customerId: ID;
	vehicleId: ID;
	estimateNumber: number;
	rootEstimateId?: ID;
	revisionNumber: number;
	status: EstimateStatusEnum;
	currency: string;
	subtotal: number;
	taxTotal: number;
	discountTotal: number;
	total: number;
	inspectionId?: ID;
	diagnosticId?: ID;
}
export interface IEstimateLine extends IBasePerTenantAndOrganizationEntityModel {
	estimateId: ID;
	lineNumber: number;
	description: string;
	reason: string;
	priority: EstimateLinePriorityEnum;
	quantity: number;
	unitPrice: number;
	taxAmount: number;
	discountAmount?: number;
	lineTotal: number;
}
export interface IEstimateLineInput {
	description: string;
	reason: string;
	priority: EstimateLinePriorityEnum;
	quantity: number;
	unitPrice: number;
	taxAmount: number;
	discountAmount?: number;
}
export interface IEstimateCreateInput {
	repairOrderId: ID;
	customerId: ID;
	vehicleId: ID;
	currency: string;
	inspectionId?: ID;
	diagnosticId?: ID;
	lines: IEstimateLineInput[];
}
