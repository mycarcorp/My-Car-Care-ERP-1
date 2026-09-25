import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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
	@IsEnum(PartStockMovementTypeEnum) type: PartStockMovementTypeEnum;
	@IsNumber() @Min(0.001) quantity: number;
	@IsNotEmpty() @IsString() reason: string;
	@IsOptional() @IsString() notes?: string;
}
