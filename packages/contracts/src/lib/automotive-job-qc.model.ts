import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum AutomotiveJobQcStatusEnum {
	PENDING = 'PENDING',
	PASSED = 'PASSED',
	FAILED = 'FAILED'
}

export interface IAutomotiveJobQcAttempt extends IBasePerTenantAndOrganizationEntityModel {
	automotiveJobId: ID;
	status: AutomotiveJobQcStatusEnum;
	reason?: string;
	notes?: string;
	checkedByEmployeeId?: ID;
	checkedAt?: Date;
}

export interface IAutomotiveJobQcCreateInput {
	notes?: string;
}

export interface IAutomotiveJobQcFailInput {
	reason: string;
	notes?: string;
}