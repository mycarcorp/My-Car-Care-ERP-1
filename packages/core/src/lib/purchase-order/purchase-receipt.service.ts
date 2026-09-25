import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { ID, PurchaseOrderStatusEnum, PurchaseReceiptStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { PartStockMovementService } from '../automotive-part/part-stock-movement.service';
import { CreatePurchaseReceiptDTO } from './dto';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseReceiptLine } from './purchase-receipt-line.entity';
import { PurchaseReceipt } from './purchase-receipt.entity';
import { MikroOrmPurchaseReceiptRepository } from './repository/mikro-orm-purchase-receipt.repository';
import { TypeOrmPurchaseReceiptRepository } from './repository/type-orm-purchase-receipt.repository';

@Injectable()
export class PurchaseReceiptService extends TenantAwareCrudService<PurchaseReceipt> {
	constructor(
		typeOrmRepository: TypeOrmPurchaseReceiptRepository,
		mikroOrmRepository: MikroOrmPurchaseReceiptRepository,
		@InjectRepository(PurchaseOrder) private readonly orders: Repository<PurchaseOrder>,
		@InjectRepository(PurchaseOrderLine) private readonly orderLines: Repository<PurchaseOrderLine>,
		@InjectRepository(PurchaseReceiptLine) private readonly receiptLines: Repository<PurchaseReceiptLine>,
		@InjectRepository(AutomotivePartProfile) private readonly parts: Repository<AutomotivePartProfile>,
		private readonly stock: PartStockMovementService
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async post(orderId: ID, input: CreatePurchaseReceiptDTO): Promise<PurchaseReceipt> {
		const { tenantId, organizationId } = this.scope();
		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			const order = await manager.findOneByOrFail(PurchaseOrder, { id: orderId, tenantId, organizationId });
			if (![PurchaseOrderStatusEnum.ORDERED, PurchaseOrderStatusEnum.PARTIALLY_RECEIVED].includes(order.status))
				throw new BadRequestException('Only ordered purchase orders can receive stock.');
			const warehouse = await manager.findOneByOrFail(Warehouse, {
				id: order.warehouseId,
				tenantId,
				organizationId
			});
			if (warehouse.inventorySource !== order.inventorySource)
				throw new BadRequestException('Purchase order warehouse does not belong to its inventory source.');
			if (!input.lines?.length) throw new BadRequestException('Receipt requires at least one line.');
			if (input.externalReference) {
				const duplicate = await manager.findOne(PurchaseReceipt, {
					where: {
						purchaseOrderId: order.id,
						externalReference: input.externalReference,
						tenantId,
						organizationId
					}
				});
				if (duplicate)
					throw new ConflictException(
						'This receipt reference has already been posted for the purchase order.'
					);
			}
			const seen = new Set<string>();
			const lineInputs = await Promise.all(
				input.lines.map(async (item) => {
					if (seen.has(item.purchaseOrderLineId))
						throw new BadRequestException('A purchase order line may appear only once per receipt.');
					seen.add(item.purchaseOrderLineId);
					const line = await manager.findOneByOrFail(PurchaseOrderLine, {
						id: item.purchaseOrderLineId,
						purchaseOrderId: order.id,
						tenantId,
						organizationId
					});
					const quantity = Number(item.receivedQuantity);
					if (!Number.isFinite(quantity) || quantity <= 0)
						throw new BadRequestException('Received quantity must be positive.');
					if (Number(line.receivedQuantity) + quantity > Number(line.orderedQuantity))
						throw new BadRequestException('Received quantity cannot exceed the outstanding quantity.');
					const profile = await manager.findOneByOrFail(AutomotivePartProfile, {
						id: line.automotivePartProfileId,
						tenantId,
						organizationId
					});
					if (profile.productVariantId !== line.productVariantId)
						throw new BadRequestException('Purchase order line part does not match its product variant.');
					const balance = await manager.findOne(WarehouseProductVariant, {
						where: {
							id: item.warehouseProductVariantId,
							variantId: profile.productVariantId,
							tenantId,
							organizationId
						},
						relations: { warehouseProduct: true }
					});
					if (!balance || balance.warehouseProduct?.warehouseId !== order.warehouseId)
						throw new BadRequestException(
							'Receipt balance does not belong to the purchase order warehouse and part.'
						);
					return { item, line, profile, balance, quantity };
				})
			);
			const receipt = await manager.save(PurchaseReceipt, {
				purchaseOrderId: order.id,
				receiptNumber: `PR-${require('node:crypto').randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
				externalReference: input.externalReference,
				receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
				warehouseId: order.warehouseId,
				inventorySource: order.inventorySource,
				status: PurchaseReceiptStatusEnum.POSTED,
				tenantId,
				organizationId
			});
			for (const entry of lineInputs) {
				const lineTotal = +(
					entry.quantity * Number(entry.item.actualUnitCost) +
					Number(entry.item.taxAmount)
				).toFixed(2);
				await manager.save(PurchaseReceiptLine, {
					purchaseReceiptId: receipt.id,
					purchaseOrderLineId: entry.line.id,
					automotivePartProfileId: entry.profile.id,
					productVariantId: entry.profile.productVariantId,
					receivedQuantity: entry.quantity,
					actualUnitCost: entry.item.actualUnitCost,
					taxAmount: entry.item.taxAmount,
					lineTotal,
					tenantId,
					organizationId
				});
				await this.stock.postReceiptIn(manager, {
					profile: entry.profile,
					warehouse,
					balance: entry.balance,
					quantity: entry.quantity,
					purchaseReceiptId: receipt.id,
					inventorySource: order.inventorySource,
					tenantId,
					organizationId
				});
				const claimed = await manager.update(
					PurchaseOrderLine,
					{
						id: entry.line.id,
						tenantId,
						organizationId,
						receivedQuantity: entry.line.receivedQuantity
					} as FindOptionsWhere<PurchaseOrderLine>,
					{ receivedQuantity: +(Number(entry.line.receivedQuantity) + entry.quantity).toFixed(3) }
				);
				if (!claimed.affected) throw new ConflictException('Purchase order line changed; retry the receipt.');
			}
			const existingLines = await manager.find(PurchaseOrderLine, {
				where: { purchaseOrderId: order.id, tenantId, organizationId }
			});
			const receivedByLineId = new Map(lineInputs.map((entry) => [entry.line.id, entry.quantity]));
			const allReceived = existingLines.every(
				(line) =>
					Number(line.receivedQuantity) + (receivedByLineId.get(line.id) ?? 0) >= Number(line.orderedQuantity)
			);
			await manager.update(
				PurchaseOrder,
				{ id: order.id, tenantId, organizationId, status: order.status } as FindOptionsWhere<PurchaseOrder>,
				{ status: allReceived ? PurchaseOrderStatusEnum.RECEIVED : PurchaseOrderStatusEnum.PARTIALLY_RECEIVED }
			);
			return receipt;
		});
	}

	async list(orderId: ID): Promise<PurchaseReceipt[]> {
		const { tenantId, organizationId } = this.scope();
		return this.typeOrmRepository.find({
			where: { purchaseOrderId: orderId, tenantId, organizationId },
			order: { createdAt: 'DESC' }
		});
	}
	async findPosted(id: ID): Promise<PurchaseReceipt> {
		return this.findOneByIdString(id);
	}
	async update(): Promise<never> {
		throw new BadRequestException('Posted purchase receipts are immutable.');
	}
	async delete(): Promise<never> {
		throw new BadRequestException('Posted purchase receipts are immutable.');
	}
	async softDelete(): Promise<never> {
		throw new BadRequestException('Posted purchase receipts are immutable.');
	}
	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
