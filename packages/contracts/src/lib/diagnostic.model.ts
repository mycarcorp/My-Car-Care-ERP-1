import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
export enum DiagnosticStatusEnum {
	DRAFT = 'DRAFT',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED'
}
export enum DiagnosticFindingKindEnum {
	OBSERVATION = 'OBSERVATION',
	TEST_RESULT = 'TEST_RESULT',
	CAUSE = 'CAUSE',
	RECOMMENDATION = 'RECOMMENDATION'
}
export interface IDiagnostic extends IBasePerTenantAndOrganizationEntityModel {
	inspectionId: ID;
	technicianEmployeeId: ID;
	symptom: string;
	status: DiagnosticStatusEnum;
	diagnosedAt: Date;
	summary?: string;
	internalNote?: string;
	completedAt?: Date;
}
export interface IDiagnosticFinding extends IBasePerTenantAndOrganizationEntityModel {
	diagnosticId: ID;
	kind: DiagnosticFindingKindEnum;
	description: string;
}
export interface IDiagnosticFindingCreateInput {
	kind: DiagnosticFindingKindEnum;
	description: string;
}
export interface IDiagnosticCreateInput {
	inspectionId: ID;
	technicianEmployeeId: ID;
	symptom: string;
	status?: DiagnosticStatusEnum;
	summary?: string;
	internalNote?: string;
	findings?: IDiagnosticFindingCreateInput[];
}
