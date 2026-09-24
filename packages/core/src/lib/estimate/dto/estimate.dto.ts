import { Type } from 'class-transformer';
import {
	IsArray,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested
} from 'class-validator';
import { EstimateLinePriorityEnum, EstimateStatusEnum } from '@gauzy/contracts';
export class EstimateLineDTO {
	@IsNotEmpty() @IsString() description: string;
	@IsNotEmpty() @IsString() reason: string;
	@IsEnum(EstimateLinePriorityEnum) priority: EstimateLinePriorityEnum;
	@IsNumber() @Min(0.001) quantity: number;
	@IsNumber() @Min(0) unitPrice: number;
	@IsNumber() @Min(0) taxAmount: number;
	@IsOptional() @IsNumber() @Min(0) discountAmount?: number;
}
export class CreateEstimateDTO {
	@IsUUID() repairOrderId: string;
	@IsUUID() customerId: string;
	@IsUUID() vehicleId: string;
	@IsString() currency: string;
	@IsOptional() @IsUUID() inspectionId?: string;
	@IsOptional() @IsUUID() diagnosticId?: string;
	@IsArray() @ValidateNested({ each: true }) @Type(() => EstimateLineDTO) lines: EstimateLineDTO[];
}
export class UpdateEstimateDTO {
	@IsOptional() @IsEnum(EstimateStatusEnum) status?: EstimateStatusEnum;
}
