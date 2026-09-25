import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ID, IWarehouse, InventorySourceEnum } from '@gauzy/contracts';
import { IsNull } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { PartStockMovement } from '../automotive-part/part-stock-movement.entity';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { PurchaseReceipt } from '../purchase-order/purchase-receipt.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { Warehouse } from './warehouse.entity';

@Injectable()
export class WarehouseService extends TenantAwareCrudService<Warehouse> {
	constructor(
		readonly typeOrmWarehouseRepository: TypeOrmWarehouseRepository,
		readonly mikroOrmWarehouseRepository: MikroOrmWarehouseRepository
	) {
		super(typeOrmWarehouseRepository, mikroOrmWarehouseRepository);
	}

	/**
	 * Finds a warehouse by its unique identifier.
	 *
	 * @param {ID} id - The unique identifier of the warehouse.
	 * @param {string[]} [relations=[]] - Optional array of related entities to be included in the query.
	 * @returns {Promise<IWarehouse>} - A promise resolving to the warehouse entity if found.
	 *
	 * @description
	 * This method retrieves a warehouse entity by its ID, optionally loading related entities.
	 * It uses the `findOneByIdString` method from the parent repository/service.
	 *
	 * @example
	 * ```ts
	 * const warehouse = await warehouseService.findById('123e4567-e89b-12d3-a456-426614174000', ['products', 'employees']);
	 * console.log(warehouse);
	 * ```
	 */
	async findById(id: ID, relations: string[] = []): Promise<IWarehouse> {
		return await super.findOneByIdString(id, { relations });
	}

	async classifyInventorySource(id: ID, inventorySource: InventorySourceEnum): Promise<Warehouse> {
		if (!Object.values(InventorySourceEnum).includes(inventorySource)) {
			throw new BadRequestException('Invalid warehouse inventory source.');
		}
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and organization context are required.');
		}

		return this.typeOrmWarehouseRepository.manager.transaction(async (manager) => {
			const warehouse = await manager.findOneByOrFail(Warehouse, { id, tenantId, organizationId });
			if (warehouse.inventorySource === inventorySource) return warehouse;
			if (warehouse.inventorySource) {
				throw new ConflictException('A classified warehouse cannot be reassigned to another inventory source.');
			}

			const [warehouseProducts, variantBalances, movements, purchaseOrders, receipts] = await Promise.all([
				manager.count(WarehouseProduct, { where: { warehouseId: id, tenantId, organizationId } }),
				manager.count(WarehouseProductVariant, {
					where: { warehouseProduct: { warehouseId: id }, tenantId, organizationId }
				}),
				manager.count(PartStockMovement, { where: { warehouseId: id, tenantId, organizationId } }),
				manager.count(PurchaseOrder, { where: { warehouseId: id, tenantId, organizationId } }),
				manager.count(PurchaseReceipt, { where: { warehouseId: id, tenantId, organizationId } })
			]);
			if (warehouseProducts || variantBalances || movements || purchaseOrders || receipts) {
				throw new ConflictException(
					'An operationally used warehouse cannot be classified because its existing inventory source is unknown.'
				);
			}

			const result = await manager.update(
				Warehouse,
				{ id, tenantId, organizationId, inventorySource: IsNull() },
				{ inventorySource }
			);
			if (!result.affected) {
				throw new ConflictException('Warehouse classification changed concurrently; reload and try again.');
			}
			return manager.findOneByOrFail(Warehouse, { id, tenantId, organizationId });
		});
	}
}
