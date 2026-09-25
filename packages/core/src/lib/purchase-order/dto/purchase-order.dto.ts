import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested
} from 'class-validator';
import { InventorySourceEnum } from '@gauzy/contracts';

export class PurchaseOrderLineDTO {
	@IsUUID() automotivePartProfileId: string;
	@IsNumber() @Min(0.001) orderedQuantity: number;
	@IsNumber() @Min(0) unitCost: number;
	@IsNumber() @Min(0) taxAmount: number;
	@IsOptional() @IsString() notes?: string;
}

export class CreatePurchaseOrderDTO {
	@IsUUID() organizationVendorId: string;
	@IsUUID() warehouseId: string;
	@IsEnum(InventorySourceEnum) inventorySource: InventorySourceEnum;
	@IsString() currency: string;
	@IsOptional() @IsDateString() expectedAt?: string;
	@IsOptional() @IsString() notes?: string;
	@IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDTO) lines: PurchaseOrderLineDTO[];
}

export class UpdatePurchaseOrderDTO {
	@IsOptional() @IsDateString() expectedAt?: string;
	@IsOptional() @IsString() notes?: string;
}

export class PurchaseReceiptLineDTO {
	@IsUUID() purchaseOrderLineId: string;
	@IsUUID() warehouseProductVariantId: string;
	@IsNumber() @Min(0.001) receivedQuantity: number;
	@IsNumber() @Min(0) actualUnitCost: number;
	@IsNumber() @Min(0) taxAmount: number;
}

export class CreatePurchaseReceiptDTO {
	@IsOptional() @IsString() externalReference?: string;
	@IsOptional() @IsDateString() receivedAt?: string;
	@IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseReceiptLineDTO) lines: PurchaseReceiptLineDTO[];
}
