import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PartStockMovementTypeEnum } from '@gauzy/contracts';

export class CreateAutomotivePartDTO {
	@IsUUID() productVariantId: string;
	@IsNotEmpty() @IsString() normalizedPartNumber: string;
	@IsOptional() @IsString() manufacturer?: string;
	@IsOptional() @IsString() oemPartNumber?: string;
	@IsOptional() @IsString() aftermarketPartNumber?: string;
	@IsOptional() @IsString() barcode?: string;
	@IsOptional() @IsString() internalNotes?: string;
	@IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateAutomotivePartDTO {
	@IsOptional() @IsNotEmpty() @IsString() normalizedPartNumber?: string;
	@IsOptional() @IsString() manufacturer?: string;
	@IsOptional() @IsString() oemPartNumber?: string;
	@IsOptional() @IsString() aftermarketPartNumber?: string;
	@IsOptional() @IsString() barcode?: string;
	@IsOptional() @IsString() internalNotes?: string;
	@IsOptional() @IsBoolean() enabled?: boolean;
}

export class CreateAutomotivePartVendorDTO {
	@IsUUID() organizationVendorId: string;
	@IsOptional() @IsString() supplierPartNumber?: string;
	@IsOptional() @IsNumber() @Min(0) supplierCost?: number;
	@IsOptional() @IsNumber() @Min(0) leadTimeDays?: number;
	@IsOptional() @IsBoolean() preferred?: boolean;
	@IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAutomotivePartVendorDTO {
	@IsOptional() @IsString() supplierPartNumber?: string;
	@IsOptional() @IsNumber() @Min(0) supplierCost?: number;
	@IsOptional() @IsNumber() @Min(0) leadTimeDays?: number;
	@IsOptional() @IsBoolean() preferred?: boolean;
	@IsOptional() @IsBoolean() active?: boolean;
}

export class CreatePartInventoryAdjustmentDTO {
	@IsUUID() warehouseId: string;
	@IsUUID() warehouseProductVariantId: string;
	@IsIn([PartStockMovementTypeEnum.ADJUSTMENT_IN, PartStockMovementTypeEnum.ADJUSTMENT_OUT]) type: PartStockMovementTypeEnum;
	@IsNumber() @Min(0.001) quantity: number;
	@IsNotEmpty() @IsString() reason: string;
	@IsOptional() @IsString() notes?: string;
}

export class ConsumeAutomotiveJobPartDTO {
	@IsUUID() automotivePartProfileId: string;
	@IsUUID() warehouseId: string;
	@IsUUID() warehouseProductVariantId: string;
	@IsNumber() @Min(0.001) quantity: number;
	@IsUUID() operationKey: string;
}

export class ReverseAutomotiveJobPartDTO {
	@IsNotEmpty() @IsString() @MaxLength(1000) reason: string;
}
