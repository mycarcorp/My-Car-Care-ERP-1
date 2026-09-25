import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { ID, InventorySourceEnum, PartStockMovementTypeEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { CreatePartInventoryAdjustmentDTO } from './dto';
import { PartStockMovement } from './part-stock-movement.entity';
import { MikroOrmPartStockMovementRepository } from './repository/mikro-orm-part-stock-movement.repository';
import { TypeOrmPartStockMovementRepository } from './repository/type-orm-part-stock-movement.repository';

@Injectable()
export class PartStockMovementService extends TenantAwareCrudService<PartStockMovement> {
	constructor(
		typeOrmRepository: TypeOrmPartStockMovementRepository,
		mikroOrmRepository: MikroOrmPartStockMovementRepository,
		@InjectRepository(AutomotivePartProfile) private readonly profiles: Repository<AutomotivePartProfile>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async adjust(profileId: ID, input: CreatePartInventoryAdjustmentDTO): Promise<PartStockMovement> {
		const { tenantId, organizationId } = this.currentScope();
		const profile = await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		const quantity = Number(input.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0)
			throw new BadRequestException('Adjustment quantity must be positive.');
		const quantityDelta = input.type === PartStockMovementTypeEnum.ADJUSTMENT_IN ? quantity : -quantity;

		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			await manager.findOneByOrFail(ProductVariant, { id: profile.productVariantId, tenantId, organizationId });
			const warehouse = await manager.findOneByOrFail(Warehouse, {
				id: input.warehouseId,
				tenantId,
				organizationId
			});
			const balance = await manager.findOne(WarehouseProductVariant, {
				where: {
					id: input.warehouseProductVariantId,
					variantId: profile.productVariantId,
					tenantId,
					organizationId
				},
				relations: { warehouseProduct: true }
			});
			if (!balance || balance.warehouseProduct?.warehouseId !== input.warehouseId) {
				throw new BadRequestException(
					'Warehouse inventory balance does not belong to this part and warehouse.'
				);
			}
			return this.postMovement(manager, {
				profile,
				warehouse,
				balance,
				quantityDelta,
				type: input.type,
				reason: input.reason,
				notes: input.notes,
				tenantId,
				organizationId,
				inventorySource: warehouse.inventorySource
			});
		});
	}

	async postReceiptIn(
		manager: EntityManager,
		input: {
			profile: AutomotivePartProfile;
			warehouse: Warehouse;
			balance: WarehouseProductVariant;
			quantity: number;
			purchaseReceiptId: ID;
			inventorySource: InventorySourceEnum;
			tenantId: ID;
			organizationId: ID;
		}
	): Promise<PartStockMovement> {
		if (input.warehouse.inventorySource !== input.inventorySource) {
			throw new BadRequestException('Warehouse does not belong to the receipt inventory source.');
		}
		return this.postMovement(manager, {
			...input,
			quantityDelta: input.quantity,
			type: PartStockMovementTypeEnum.RECEIPT_IN,
			reason: 'Purchase receipt',
			purchaseReceiptId: input.purchaseReceiptId
		});
	}

	async stock(profileId: ID): Promise<WarehouseProductVariant[]> {
		const { tenantId, organizationId } = this.currentScope();
		const profile = await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		return this.typeOrmRepository.manager.find(WarehouseProductVariant, {
			where: { variantId: profile.productVariantId, tenantId, organizationId },
			relations: { warehouseProduct: { warehouse: true } }
		});
	}

	async movements(profileId: ID): Promise<PartStockMovement[]> {
		const { tenantId, organizationId } = this.currentScope();
		await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		return this.typeOrmRepository.find({
			where: { automotivePartProfileId: profileId, tenantId, organizationId },
			order: { createdAt: 'DESC' }
		});
	}

	async update(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async delete(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async softDelete(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async softRemove(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	private currentScope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}

	private async postMovement(
		manager: EntityManager,
		input: {
			profile: AutomotivePartProfile;
			warehouse: Warehouse;
			balance: WarehouseProductVariant;
			quantityDelta: number;
			type: PartStockMovementTypeEnum;
			reason: string;
			notes?: string;
			purchaseReceiptId?: ID;
			inventorySource?: InventorySourceEnum;
			tenantId: ID;
			organizationId: ID;
		}
	): Promise<PartStockMovement> {
		const quantityBefore = Number(input.balance.quantity ?? 0);
		const quantityAfter = +(quantityBefore + input.quantityDelta).toFixed(3);
		if (quantityAfter < 0) throw new BadRequestException('Inventory adjustment cannot create negative stock.');
		const claimed = await manager.update(
			WarehouseProductVariant,
			{
				id: input.balance.id,
				tenantId: input.tenantId,
				organizationId: input.organizationId,
				quantity: quantityBefore
			} as FindOptionsWhere<WarehouseProductVariant>,
			{ quantity: quantityAfter }
		);
		if (!claimed.affected) throw new ConflictException('Inventory balance changed; retry the adjustment.');
		return manager.save(PartStockMovement, {
			automotivePartProfileId: input.profile.id,
			productVariantId: input.profile.productVariantId,
			warehouseId: input.warehouse.id,
			warehouseProductVariantId: input.balance.id,
			type: input.type,
			quantityDelta: input.quantityDelta,
			quantityBefore,
			quantityAfter,
			reason: input.reason,
			notes: input.notes,
			purchaseReceiptId: input.purchaseReceiptId,
			inventorySource: input.inventorySource,
			tenantId: input.tenantId,
			organizationId: input.organizationId
		});
	}
}
