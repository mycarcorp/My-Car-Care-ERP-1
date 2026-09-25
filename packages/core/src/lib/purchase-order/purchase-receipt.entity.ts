import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, InventorySourceEnum, IPurchaseReceipt, PurchaseReceiptStatusEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, Warehouse } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmPurchaseReceiptRepository } from './repository/mikro-orm-purchase-receipt.repository';
import { PurchaseOrder } from './purchase-order.entity';

@ColumnIndex('IDX_purchase_receipt_tenant_number_unique', ['tenantId', 'receiptNumber'], { unique: true })
@ColumnIndex(
	'IDX_purchase_receipt_reference_unique',
	['tenantId', 'organizationId', 'purchaseOrderId', 'externalReference'],
	{ unique: true }
)
@MultiORMEntity('purchase_receipt', { mikroOrmRepository: () => MikroOrmPurchaseReceiptRepository })
export class PurchaseReceipt extends TenantOrganizationBaseEntity implements IPurchaseReceipt {
	@MultiORMManyToOne(() => PurchaseOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	purchaseOrder?: PurchaseOrder;
	@IsUUID()
	@RelationId((it: PurchaseReceipt) => it.purchaseOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseOrderId: ID;
	@IsString() @ColumnIndex() @MultiORMColumn() receiptNumber: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) externalReference?: string;
	@IsDate() @MultiORMColumn() receivedAt: Date;
	@MultiORMManyToOne(() => Warehouse, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	warehouse?: Warehouse;
	@IsUUID()
	@RelationId((it: PurchaseReceipt) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;
	@IsEnum(InventorySourceEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: InventorySourceEnum })
	inventorySource: InventorySourceEnum;
	@IsEnum(PurchaseReceiptStatusEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: PurchaseReceiptStatusEnum, default: PurchaseReceiptStatusEnum.POSTED })
	status: PurchaseReceiptStatusEnum;
}
