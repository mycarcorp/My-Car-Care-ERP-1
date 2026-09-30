import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum PartStockMovementTypeEnum {
	ADJUSTMENT_IN = 'ADJUSTMENT_IN',
	ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
	RECEIPT_IN = 'RECEIPT_IN',
	JOB_CONSUMPTION_OUT = 'JOB_CONSUMPTION_OUT',
	JOB_CONSUMPTION_REVERSAL_IN = 'JOB_CONSUMPTION_REVERSAL_IN'
}

export interface IAutomotivePartProfile extends IBasePerTenantAndOrganizationEntityModel {
	productVariantId: ID;
	normalizedPartNumber: string;
	manufacturer?: string;
	oemPartNumber?: string;
	aftermarketPartNumber?: string;
	barcode?: string;
	internalNotes?: string;
	enabled: boolean;
}

export interface IAutomotivePartVendor extends IBasePerTenantAndOrganizationEntityModel {
	automotivePartProfileId: ID;
	organizationVendorId: ID;
	supplierPartNumber?: string;
	supplierCost?: number;
	leadTimeDays?: number;
	preferred: boolean;
	active: boolean;
}

export interface IPartStockMovement extends IBasePerTenantAndOrganizationEntityModel {
	automotivePartProfileId: ID;
	productVariantId: ID;
	warehouseId: ID;
	warehouseProductVariantId: ID;
	inventorySource?: import('./purchase-order.model').InventorySourceEnum;
	purchaseReceiptId?: ID;
	automotiveJobId?: ID;
	repairOrderId?: ID;
	unitCost?: number;
	costCurrency?: string;
	recordedByUserId?: ID;
	reversesMovementId?: ID;
	operationKey?: string;
	type: PartStockMovementTypeEnum;
	quantityDelta: number;
	quantityBefore: number;
	quantityAfter: number;
	reason: string;
	notes?: string;
}
