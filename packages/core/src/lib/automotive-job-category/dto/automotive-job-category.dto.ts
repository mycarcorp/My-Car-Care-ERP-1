import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAutomotiveJobCategoryDTO {
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	displayOrder?: number;
}

export class UpdateAutomotiveJobCategoryDTO {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	displayOrder?: number;

	@IsOptional()
	@Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
	@IsBoolean()
	isActive?: boolean;
}

export class AutomotiveJobCategoryQueryDTO {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number;

	@IsOptional()
	@Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
	@IsBoolean()
	activeOnly?: boolean;
}
