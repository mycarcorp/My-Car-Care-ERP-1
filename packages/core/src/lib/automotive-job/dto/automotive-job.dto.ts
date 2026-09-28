import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AutomotiveJobStatusEnum } from '@gauzy/contracts';

export class CreateAutomotiveJobDTO {
	@IsUUID() customerWorkApprovalLineId: string;
	@IsOptional() @IsUUID() assignedEmployeeId?: string;
	@IsOptional() @IsNumber() @Min(0) estimatedHours?: number;
	@IsOptional() @IsString() internalNotes?: string;
}

export class UpdateAutomotiveJobDTO {
	@IsOptional() @IsNumber() @Min(0) estimatedHours?: number;
	@IsOptional() @IsString() internalNotes?: string;
}

export class AssignAutomotiveJobDTO {
	@IsUUID() employeeId: string;
}

export class UpdateAutomotiveJobStatusDTO {
	@IsEnum(AutomotiveJobStatusEnum) status: AutomotiveJobStatusEnum;
}
