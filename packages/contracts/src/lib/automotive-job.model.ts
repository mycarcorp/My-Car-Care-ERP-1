import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum AutomotiveJobStatusEnum {
	OPEN = 'OPEN',
	ASSIGNED = 'ASSIGNED',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED'
}

/** Operational execution record for one customer-authorized work line on a Repair Order. */
export interface IAutomotiveJob extends IBasePerTenantAndOrganizationEntityModel {
	repairOrderId: ID;
	estimateId: ID;
	estimateRevisionNumber: number;
	estimateLineId: ID;
	customerWorkApprovalId: ID;
	customerWorkApprovalLineId: ID;
	title: string;
	description: string;
	internalNotes?: string;
	assignedEmployeeId?: ID;
	status: AutomotiveJobStatusEnum;
	estimatedHours?: number;
	authorizedHours?: number;
}

export interface IAutomotiveJobCreateInput {
	customerWorkApprovalLineId: ID;
	estimatedHours?: number;
	internalNotes?: string;
}

export interface IAutomotiveJobUpdateInput {
	internalNotes?: string;
	estimatedHours?: number;
	status?: AutomotiveJobStatusEnum;
}

export interface IAutomotiveJobAssignInput {
	employeeId: ID;
}
