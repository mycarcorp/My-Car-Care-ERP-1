import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';

export enum AutomotiveJobLaborStatusEnum {
	OPEN = 'OPEN',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED'
}

export interface IAutomotiveJobLabor extends IBasePerTenantAndOrganizationEntityModel {
	automotiveJobId: ID;
	estimateLineId?: ID;
	customerWorkApprovalLineId?: ID;
	description: string;
	assignedEmployeeIds?: ID[];
	assignedEmployees?: IEmployee[];
	billedHours?: number;
	status: AutomotiveJobLaborStatusEnum;
	completedAt?: Date;
}

export interface IAutomotiveJobLaborCreateInput {
	description: string;
	assignedEmployeeIds?: ID[];
	billedHours?: number;
}

export interface IAutomotiveJobLaborUpdateInput {
	description?: string;
	assignedEmployeeIds?: ID[];
	billedHours?: number | null;
}

export interface IAutomotiveJobLaborView extends IAutomotiveJobLabor {
	assignedEmployees?: IEmployee[];
	actualSeconds: number;
	activeEmployeeIds: ID[];
	activeTimeLogIds: ID[];
}
