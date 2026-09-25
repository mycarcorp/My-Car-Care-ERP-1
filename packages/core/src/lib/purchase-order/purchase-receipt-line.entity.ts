import { JoinColumn, RelationId } from 'typeorm';
import { IsNumber, IsUUID, Min } from 'class-validator';
import { ID, IPurchaseReceiptLine } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { MikroOrmPurchaseReceiptLineRepository } from './repository/mikro-orm-purchase-receipt-line.repository';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseReceipt } from './purchase-receipt.entity';

@ColumnIndex('IDX_purchase_receipt_line_unique', ['purchaseReceiptId', 'purchaseOrderLineId'], { unique: true })
@MultiORMEntity('purchase_receipt_line', { mikroOrmRepository: () => MikroOrmPurchaseReceiptLineRepository })
export class PurchaseReceiptLine extends TenantOrganizationBaseEntity implements IPurchaseReceiptLine {
	@MultiORMManyToOne(() => PurchaseReceipt, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	purchaseReceipt?: PurchaseReceipt;
	@IsUUID()
	@RelationId((it: PurchaseReceiptLine) => it.purchaseReceipt)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseReceiptId: ID;
	@MultiORMManyToOne(() => PurchaseOrderLine, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	purchaseOrderLine?: PurchaseOrderLine;
	@IsUUID()
	@RelationId((it: PurchaseReceiptLine) => it.purchaseOrderLine)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	purchaseOrderLineId: ID;
	@MultiORMManyToOne(() => AutomotivePartProfile, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotivePartProfile?: AutomotivePartProfile;
	@IsUUID()
	@RelationId((it: PurchaseReceiptLine) => it.automotivePartProfile)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotivePartProfileId: ID;
	@MultiORMManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	productVariant?: ProductVariant;
	@IsUUID()
	@RelationId((it: PurchaseReceiptLine) => it.productVariant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productVariantId: ID;
	@IsNumber()
	@Min(0.001)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	receivedQuantity: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	actualUnitCost: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	taxAmount: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	lineTotal: number;
}
