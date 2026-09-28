import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IAutomotiveJobCategory } from './automotive-job-category.model';

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
	categoryId?: ID;
	category?: IAutomotiveJobCategory;
}

export interface IAutomotiveJobCreateInput {
	customerWorkApprovalLineId: ID;
	estimatedHours?: number;
	internalNotes?: string;
	categoryId?: ID;
}

export interface IAutomotiveJobUpdateInput {
	internalNotes?: string;
	estimatedHours?: number;
	status?: AutomotiveJobStatusEnum;
	categoryId?: ID | null;
}

export interface IAutomotiveJobAssignInput {
	employeeId: ID;
}
