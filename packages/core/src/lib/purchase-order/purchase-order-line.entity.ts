import { JoinColumn, RelationId } from 'typeorm';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ID, IPurchaseOrderLine } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { MikroOrmPurchaseOrderLineRepository } from './repository/mikro-orm-purchase-order-line.repository';
import { PurchaseOrder } from './purchase-order.entity';

@ColumnIndex('IDX_purchase_order_line_order_variant_unique', ['purchaseOrderId', 'productVariantId'], { unique: true })
@MultiORMEntity('purchase_order_line', { mikroOrmRepository: () => MikroOrmPurchaseOrderLineRepository })
export class PurchaseOrderLine extends TenantOrganizationBaseEntity implements IPurchaseOrderLine {
	@MultiORMManyToOne(() => PurchaseOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	purchaseOrder?: PurchaseOrder;
	@IsUUID()
	@RelationId((it: PurchaseOrderLine) => it.purchaseOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseOrderId: ID;
	@MultiORMManyToOne(() => AutomotivePartProfile, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotivePartProfile?: AutomotivePartProfile;
	@IsUUID()
	@RelationId((it: PurchaseOrderLine) => it.automotivePartProfile)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotivePartProfileId: ID;
	@MultiORMManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	productVariant?: ProductVariant;
	@IsUUID()
	@RelationId((it: PurchaseOrderLine) => it.productVariant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productVariantId: ID;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) supplierPartNumberSnapshot?: string;
	@IsNumber()
	@Min(0.001)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	orderedQuantity: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3), default: 0 })
	receivedQuantity: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	unitCost: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	taxAmount: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	lineTotal: number;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) notes?: string;
}
