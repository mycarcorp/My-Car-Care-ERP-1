import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum InventorySourceEnum {
	SERVICE_CENTER = 'SERVICE_CENTER',
	RECON = 'RECON'
}

export enum PurchaseOrderStatusEnum {
	DRAFT = 'DRAFT',
	ORDERED = 'ORDERED',
	PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
	RECEIVED = 'RECEIVED',
	CANCELLED = 'CANCELLED'
}

export enum PurchaseReceiptStatusEnum {
	POSTED = 'POSTED'
}

export interface IPurchaseOrder extends IBasePerTenantAndOrganizationEntityModel {
	purchaseOrderNumber: string;
	organizationVendorId: ID;
	warehouseId: ID;
	inventorySource: InventorySourceEnum;
	status: PurchaseOrderStatusEnum;
	orderedAt?: Date;
	expectedAt?: Date;
	currency: string;
	subtotal: number;
	taxTotal: number;
	total: number;
	notes?: string;
}

export interface IPurchaseOrderLine extends IBasePerTenantAndOrganizationEntityModel {
	purchaseOrderId: ID;
	automotivePartProfileId: ID;
	productVariantId: ID;
	supplierPartNumberSnapshot?: string;
	orderedQuantity: number;
	receivedQuantity: number;
	unitCost: number;
	taxAmount: number;
	lineTotal: number;
	notes?: string;
}

export interface IPurchaseReceipt extends IBasePerTenantAndOrganizationEntityModel {
	purchaseOrderId: ID;
	receiptNumber: string;
	externalReference?: string;
	receivedAt: Date;
	warehouseId: ID;
	inventorySource: InventorySourceEnum;
	status: PurchaseReceiptStatusEnum;
}

export interface IPurchaseReceiptLine extends IBasePerTenantAndOrganizationEntityModel {
	purchaseReceiptId: ID;
	purchaseOrderLineId: ID;
	automotivePartProfileId: ID;
	productVariantId: ID;
	receivedQuantity: number;
	actualUnitCost: number;
	taxAmount: number;
	lineTotal: number;
}
