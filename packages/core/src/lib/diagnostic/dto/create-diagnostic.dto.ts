import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DiagnosticFindingKindEnum, DiagnosticStatusEnum, IDiagnosticCreateInput } from '@gauzy/contracts';

export class CreateDiagnosticFindingDTO {
	@IsEnum(DiagnosticFindingKindEnum)
	kind: DiagnosticFindingKindEnum;

	@IsNotEmpty()
	@IsString()
	description: string;
}

export class CreateDiagnosticDTO implements IDiagnosticCreateInput {
	@IsUUID()
	inspectionId: string;

	@IsUUID()
	technicianEmployeeId: string;

	@IsNotEmpty()
	@IsString()
	symptom: string;

	@IsOptional()
	@IsEnum(DiagnosticStatusEnum)
	status?: DiagnosticStatusEnum;

	@IsOptional()
	@IsString()
	summary?: string;

	@IsOptional()
	@IsString()
	internalNote?: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateDiagnosticFindingDTO)
	findings?: CreateDiagnosticFindingDTO[];
}
