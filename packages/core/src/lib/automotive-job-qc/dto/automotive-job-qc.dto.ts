import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAutomotiveJobQcAttemptDTO {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	notes?: string;
}

export class FailAutomotiveJobQcAttemptDTO {
	@IsNotEmpty()
	@IsString()
	@MaxLength(1000)
	reason: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	notes?: string;
}