import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AutomotiveJobStatusEnum } from '@gauzy/contracts';

export class CreateAutomotiveJobDTO {
	@IsUUID() customerWorkApprovalLineId: string;
	@IsOptional() @IsUUID() categoryId?: string;
	@IsOptional() @IsUUID() assignedEmployeeId?: string;
	@IsOptional() @IsNumber() @Min(0) estimatedHours?: number;
	@IsOptional() @IsString() internalNotes?: string;
}

export class UpdateAutomotiveJobDTO {
	@IsOptional() @IsNumber() @Min(0) estimatedHours?: number;
	@IsOptional() @IsString() internalNotes?: string;
	@IsOptional() @IsUUID() categoryId?: string | null;
}

export class AssignAutomotiveJobDTO {
	@IsUUID() employeeId: string;
}

export class UpdateAutomotiveJobStatusDTO {
	@IsEnum(AutomotiveJobStatusEnum) status: AutomotiveJobStatusEnum;
}
