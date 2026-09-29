import { Type } from 'class-transformer';
import {
	ArrayUnique,
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';

export class CreateAutomotiveJobLaborDTO {
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	description: string;

	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsUUID('all', { each: true })
	assignedEmployeeIds?: string[];

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	billedHours?: number;
}

export class UpdateAutomotiveJobLaborDTO {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	description?: string;

	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsUUID('all', { each: true })
	assignedEmployeeIds?: string[];

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	billedHours?: number | null;
}
