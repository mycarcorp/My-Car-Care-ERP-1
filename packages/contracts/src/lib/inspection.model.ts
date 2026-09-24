import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum InspectionStatusEnum {
	DRAFT = 'DRAFT',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED'
}

export enum InspectionFindingResultEnum {
	PASS = 'PASS',
	ATTENTION = 'ATTENTION'
}

export interface IInspection extends IBasePerTenantAndOrganizationEntityModel {
	repairOrderId: ID;
	vehicleId: ID;
	technicianEmployeeId: ID;
	inspectedAt: Date;
	status: InspectionStatusEnum;
}

export interface IInspectionFinding extends IBasePerTenantAndOrganizationEntityModel {
	inspectionId: ID;
	description: string;
	result: InspectionFindingResultEnum;
}

export interface IInspectionFindingCreateInput {
	description: string;
	result: InspectionFindingResultEnum;
}

export interface IInspectionCreateInput {
	repairOrderId: ID;
	vehicleId: ID;
	technicianEmployeeId: ID;
	status?: InspectionStatusEnum;
	findings?: IInspectionFindingCreateInput[];
}
