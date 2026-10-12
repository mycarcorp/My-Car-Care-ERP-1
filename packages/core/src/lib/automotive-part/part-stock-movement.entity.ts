import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	CurrenciesEnum,
	ID,
	IPartStockMovement,
	InventorySourceEnum,
	PartStockMovementTypeEnum
} from '@gauzy/contracts';
import {
	ProductVariant,
	TenantOrganizationBaseEntity,
	Warehouse,
	WarehouseProductVariant,
	User
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { MikroOrmPartStockMovementRepository } from './repository/mikro-orm-part-stock-movement.repository';

@ColumnIndex('IDX_part_stock_movement_lookup', [
	'tenantId',
	'organizationId',
	'productVariantId',
	'warehouseId',
	'createdAt'
])
@MultiORMEntity('part_stock_movement', { mikroOrmRepository: () => MikroOrmPartStockMovementRepository })
export class PartStockMovement extends TenantOrganizationBaseEntity implements IPartStockMovement {
	@MultiORMManyToOne(() => AutomotivePartProfile, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotivePartProfile?: AutomotivePartProfile;
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.automotivePartProfile)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotivePartProfileId: ID;

	@MultiORMManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	productVariant?: ProductVariant;
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.productVariant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productVariantId: ID;

	@MultiORMManyToOne(() => Warehouse, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	warehouse?: Warehouse;
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	@MultiORMManyToOne(() => WarehouseProductVariant, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	warehouseProductVariant?: WarehouseProductVariant;
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.warehouseProductVariant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseProductVariantId: ID;

	@IsOptional()
	@IsEnum(InventorySourceEnum)
	@MultiORMColumn({ nullable: true, type: 'simple-enum', enum: InventorySourceEnum })
	inventorySource?: InventorySourceEnum;

	@IsOptional() @IsUUID() @ColumnIndex() @MultiORMColumn({ nullable: true }) purchaseReceiptId?: ID;

	@MultiORMManyToOne(() => AutomotiveJob, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotiveJob?: AutomotiveJob;
	@IsOptional()
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.automotiveJob)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	automotiveJobId?: ID;

	@MultiORMManyToOne(() => RepairOrder, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: RepairOrder;
	@IsOptional()
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	repairOrderId?: ID;

	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe() })
	unitCost?: number;
	@IsOptional() @IsEnum(CurrenciesEnum) @MultiORMColumn({ nullable: true }) costCurrency?: string;
	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	recordedByUser?: User;
	@IsOptional()
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.recordedByUser)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	recordedByUserId?: ID;
	@MultiORMManyToOne(() => PartStockMovement, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	reversesMovement?: PartStockMovement;
	@IsOptional()
	@IsUUID()
	@RelationId((it: PartStockMovement) => it.reversesMovement)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reversesMovementId?: ID;
	@IsOptional() @IsUUID() @ColumnIndex() @MultiORMColumn({ nullable: true }) operationKey?: string;

	@IsEnum(PartStockMovementTypeEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: PartStockMovementTypeEnum })
	type: PartStockMovementTypeEnum;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	quantityDelta: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	quantityBefore: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	quantityAfter: number;
	@IsString() @MultiORMColumn({ type: 'text' }) reason: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) notes?: string;
}
