import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, InventorySourceEnum, IPurchaseOrder, PurchaseOrderStatusEnum } from '@gauzy/contracts';
import { OrganizationVendor, TenantOrganizationBaseEntity, Warehouse } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmPurchaseOrderRepository } from './repository/mikro-orm-purchase-order.repository';

@ColumnIndex('IDX_purchase_order_tenant_number_unique', ['tenantId', 'purchaseOrderNumber'], { unique: true })
@MultiORMEntity('purchase_order', { mikroOrmRepository: () => MikroOrmPurchaseOrderRepository })
export class PurchaseOrder extends TenantOrganizationBaseEntity implements IPurchaseOrder {
	@IsString() @ColumnIndex() @MultiORMColumn() purchaseOrderNumber: string;
	@MultiORMManyToOne(() => OrganizationVendor, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	organizationVendor?: OrganizationVendor;
	@IsUUID()
	@RelationId((it: PurchaseOrder) => it.organizationVendor)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationVendorId: ID;
	@MultiORMManyToOne(() => Warehouse, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	warehouse?: Warehouse;
	@IsUUID()
	@RelationId((it: PurchaseOrder) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;
	@IsEnum(InventorySourceEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: InventorySourceEnum })
	inventorySource: InventorySourceEnum;
	@IsEnum(PurchaseOrderStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: PurchaseOrderStatusEnum, default: PurchaseOrderStatusEnum.DRAFT })
	status: PurchaseOrderStatusEnum;
	@IsOptional() @IsDate() @MultiORMColumn({ nullable: true }) orderedAt?: Date;
	@IsOptional() @IsDate() @MultiORMColumn({ nullable: true }) expectedAt?: Date;
	@IsString() @MultiORMColumn() currency: string;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) subtotal: number;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) taxTotal: number;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) total: number;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) notes?: string;
}
