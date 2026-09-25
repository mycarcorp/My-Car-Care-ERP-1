import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ID, InventorySourceEnum, PurchaseOrderStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationVendor } from '../organization-vendor/organization-vendor.entity';
import { Warehouse } from '../warehouse/warehouse.entity';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { CreatePurchaseOrderDTO, UpdatePurchaseOrderDTO } from './dto';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { MikroOrmPurchaseOrderRepository } from './repository/mikro-orm-purchase-order.repository';
import { TypeOrmPurchaseOrderLineRepository } from './repository/type-orm-purchase-order-line.repository';
import { TypeOrmPurchaseOrderRepository } from './repository/type-orm-purchase-order.repository';

@Injectable()
export class PurchaseOrderService extends TenantAwareCrudService<PurchaseOrder> {
	constructor(
		typeOrmRepository: TypeOrmPurchaseOrderRepository,
		mikroOrmRepository: MikroOrmPurchaseOrderRepository,
		private readonly lines: TypeOrmPurchaseOrderLineRepository,
		@InjectRepository(OrganizationVendor) private readonly vendors: Repository<OrganizationVendor>,
		@InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
		@InjectRepository(AutomotivePartProfile) private readonly parts: Repository<AutomotivePartProfile>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async createPurchaseOrder(input: CreatePurchaseOrderDTO): Promise<PurchaseOrder> {
		const { tenantId, organizationId } = this.scope();
		if (!input.lines?.length) throw new BadRequestException('Purchase order requires at least one line.');
		await this.vendors.findOneByOrFail({ id: input.organizationVendorId, tenantId, organizationId });
		const warehouse = await this.warehouses.findOneByOrFail({ id: input.warehouseId, tenantId, organizationId });
		this.assertWarehouseSource(warehouse, input.inventorySource);
		const seen = new Set<string>();
		const enriched = await Promise.all(
			input.lines.map(async (line) => {
				if (seen.has(line.automotivePartProfileId))
					throw new BadRequestException('A part may appear only once per purchase order.');
				seen.add(line.automotivePartProfileId);
				const part = await this.parts.findOneByOrFail({
					id: line.automotivePartProfileId,
					tenantId,
					organizationId
				});
				const lineTotal = this.lineTotal(line.orderedQuantity, line.unitCost, line.taxAmount);
				return { ...line, part, lineTotal };
			})
		);
		const totals = this.totals(
			enriched.map((line) => ({
				quantity: line.orderedQuantity,
				unitCost: line.unitCost,
				taxAmount: line.taxAmount
			}))
		);
		const purchaseOrder = await super.create({
			purchaseOrderNumber: `PO-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
			organizationVendorId: input.organizationVendorId,
			warehouseId: input.warehouseId,
			inventorySource: input.inventorySource,
			status: PurchaseOrderStatusEnum.DRAFT,
			expectedAt: input.expectedAt ? new Date(input.expectedAt) : undefined,
			currency: input.currency,
			...totals,
			notes: input.notes,
			organizationId
		});
		await this.lines.save(
			enriched.map((line) =>
				this.lines.create({
					purchaseOrderId: purchaseOrder.id,
					automotivePartProfileId: line.part.id,
					productVariantId: line.part.productVariantId,
					orderedQuantity: line.orderedQuantity,
					receivedQuantity: 0,
					unitCost: line.unitCost,
					taxAmount: line.taxAmount,
					lineTotal: line.lineTotal,
					notes: line.notes,
					tenantId,
					organizationId
				})
			)
		);
		return purchaseOrder;
	}

	async updateDraft(id: ID, input: UpdatePurchaseOrderDTO): Promise<PurchaseOrder> {
		const order = await this.findOneByIdString(id);
		if (order.status !== PurchaseOrderStatusEnum.DRAFT)
			throw new BadRequestException('Only draft purchase orders can be edited.');
		await super.update(id, {
			expectedAt: input.expectedAt ? new Date(input.expectedAt) : undefined,
			notes: input.notes
		});
		return this.findOneByIdString(id);
	}

	async order(id: ID): Promise<PurchaseOrder> {
		const order = await this.findOneByIdString(id);
		if (order.status !== PurchaseOrderStatusEnum.DRAFT)
			throw new BadRequestException('Only draft purchase orders can be ordered.');
		await super.update(id, { status: PurchaseOrderStatusEnum.ORDERED, orderedAt: new Date() });
		return this.findOneByIdString(id);
	}

	async cancel(id: ID): Promise<PurchaseOrder> {
		const order = await this.findOneByIdString(id);
		if (![PurchaseOrderStatusEnum.DRAFT, PurchaseOrderStatusEnum.ORDERED].includes(order.status))
			throw new BadRequestException('Purchase order cannot be cancelled after receiving begins.');
		const lines = await this.lines.find({
			where: { purchaseOrderId: id, tenantId: order.tenantId, organizationId: order.organizationId }
		});
		if (lines.some((line) => Number(line.receivedQuantity) > 0))
			throw new BadRequestException('Purchase order cannot be cancelled after receiving begins.');
		await super.update(id, { status: PurchaseOrderStatusEnum.CANCELLED });
		return this.findOneByIdString(id);
	}

	private assertWarehouseSource(warehouse: Warehouse, source: InventorySourceEnum) {
		if (!warehouse.inventorySource || warehouse.inventorySource !== source)
			throw new BadRequestException('Warehouse does not belong to the requested inventory source.');
	}
	private lineTotal(quantity: number, unitCost: number, taxAmount: number) {
		return +(Number(quantity) * Number(unitCost) + Number(taxAmount)).toFixed(2);
	}
	private totals(lines: Array<{ quantity: number; unitCost: number; taxAmount: number }>) {
		const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0);
		const taxTotal = lines.reduce((sum, line) => sum + Number(line.taxAmount), 0);
		return {
			subtotal: +subtotal.toFixed(2),
			taxTotal: +taxTotal.toFixed(2),
			total: +(subtotal + taxTotal).toFixed(2)
		};
	}
	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
