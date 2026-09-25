import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventorySourceEnum, PurchaseOrderStatusEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseReceiptService } from './purchase-receipt.service';

const fixture = createTenantFixture();
const scope = () => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(fixture.tenantId);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(fixture.organizationId);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		...fixture.user,
		lastOrganizationId: fixture.organizationId
	} as never);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(TenantAwareCrudService.prototype as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
};

const order = {
	id: 'po',
	tenantId: fixture.tenantId,
	organizationId: fixture.organizationId,
	warehouseId: 'warehouse',
	inventorySource: InventorySourceEnum.SERVICE_CENTER,
	status: PurchaseOrderStatusEnum.ORDERED
};
const line = {
	id: 'line',
	purchaseOrderId: 'po',
	automotivePartProfileId: 'part',
	productVariantId: 'variant',
	orderedQuantity: 4,
	receivedQuantity: 0,
	tenantId: fixture.tenantId,
	organizationId: fixture.organizationId
};

describe('Purchase Order Phase 2 services', () => {
	afterEach(() => jest.restoreAllMocks());
	it('creates a draft PO with server calculated totals and source-matched warehouse', async () => {
		scope();
		const lines = { create: jest.fn((data) => data), save: jest.fn() };
		const repository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			create: jest.fn((data) => ({ id: 'po', tenantId: fixture.tenantId, ...data })),
			save: jest.fn(async (data) => data)
		};
		const service = new PurchaseOrderService(
			repository as never,
			{} as never,
			lines as never,
			{ findOneByOrFail: jest.fn() } as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'warehouse',
					inventorySource: InventorySourceEnum.SERVICE_CENTER
				}))
			} as never,
			{ findOneByOrFail: jest.fn(async () => ({ id: 'part', productVariantId: 'variant' })) } as never
		);
		const created = await service.createPurchaseOrder({
			organizationVendorId: 'vendor',
			warehouseId: 'warehouse',
			inventorySource: InventorySourceEnum.SERVICE_CENTER,
			currency: 'USD',
			lines: [{ automotivePartProfileId: 'part', orderedQuantity: 2, unitCost: 10, taxAmount: 1 }]
		});
		expect(created).toMatchObject({ status: PurchaseOrderStatusEnum.DRAFT, subtotal: 20, taxTotal: 1, total: 21 });
		expect(created.purchaseOrderNumber).toMatch(/^PO-/);
	});
	it('rejects a warehouse from the other inventory source', async () => {
		scope();
		const service = new PurchaseOrderService(
			{ metadata: { hasColumnWithPropertyPath: () => false } } as never,
			{} as never,
			{} as never,
			{ findOneByOrFail: jest.fn() } as never,
			{ findOneByOrFail: jest.fn(async () => ({ inventorySource: InventorySourceEnum.RECON })) } as never,
			{} as never
		);
		await expect(
			service.createPurchaseOrder({
				organizationVendorId: 'vendor',
				warehouseId: 'warehouse',
				inventorySource: InventorySourceEnum.SERVICE_CENTER,
				currency: 'USD',
				lines: [{ automotivePartProfileId: 'part', orderedQuantity: 1, unitCost: 1, taxAmount: 0 }]
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});
	it('orders a draft PO and rejects cancellation after receiving begins', async () => {
		scope();
		const repository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			findOneByOrFail: jest.fn(async () => ({ ...order, status: PurchaseOrderStatusEnum.DRAFT })),
			findOne: jest.fn(async () => ({ ...order, status: PurchaseOrderStatusEnum.DRAFT })),
			update: jest.fn()
		};
		const lines = { find: jest.fn(async () => [{ ...line, receivedQuantity: 1 }]) };
		const service = new PurchaseOrderService(
			repository as never,
			{} as never,
			lines as never,
			{} as never,
			{} as never,
			{} as never
		);
		await expect(service.order('po')).resolves.toMatchObject({ status: PurchaseOrderStatusEnum.DRAFT });
		expect(repository.update).toHaveBeenCalledWith(
			'po',
			expect.objectContaining({ status: PurchaseOrderStatusEnum.ORDERED })
		);
		await expect(service.cancel('po')).rejects.toBeInstanceOf(BadRequestException);
	});
	it('posts a partial receipt, creates receipt movement, and preserves actual cost', async () => {
		scope();
		const manager = {
			findOneByOrFail: jest.fn(async (entity, where) =>
				entity.name === 'PurchaseOrder'
					? { ...order }
					: entity.name === 'PurchaseOrderLine'
						? { ...line }
						: entity.name === 'Warehouse'
							? { id: where.id, inventorySource: InventorySourceEnum.SERVICE_CENTER }
							: { id: where.id, productVariantId: 'variant' }
			),
			findOne: jest.fn(async (entity) =>
				entity.name === 'PurchaseReceipt'
					? null
					: {
							id: 'balance',
							variantId: 'variant',
							quantity: 2,
							warehouseProduct: { warehouseId: 'warehouse' }
						}
			),
			find: jest.fn(async () => [{ ...line, receivedQuantity: 2 }]),
			save: jest.fn(async (_entity, data) => ({ id: data.purchaseOrderId ? 'receipt' : 'line', ...data })),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		const repository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const stock = { postReceiptIn: jest.fn(async () => ({ id: 'movement', quantityBefore: 2, quantityAfter: 4 })) };
		const service = new PurchaseReceiptService(
			repository as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{ findOneByOrFail: jest.fn() } as never,
			stock as never
		);
		await expect(
			service.post('po', {
				externalReference: 'packing-1',
				lines: [
					{
						purchaseOrderLineId: 'line',
						warehouseProductVariantId: 'balance',
						receivedQuantity: 2,
						actualUnitCost: 22,
						taxAmount: 1
					}
				]
			})
		).resolves.toMatchObject({ inventorySource: InventorySourceEnum.SERVICE_CENTER });
		expect(stock.postReceiptIn).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({ inventorySource: InventorySourceEnum.SERVICE_CENTER, quantity: 2 })
		);
		expect(manager.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actualUnitCost: 22 }));
	});
	it('rejects over-receiving, duplicate references, and does not post stock', async () => {
		scope();
		const manager = {
			findOneByOrFail: jest.fn(async (entity) =>
				entity.name === 'PurchaseOrder'
					? { ...order }
					: entity.name === 'Warehouse'
						? { id: 'warehouse', inventorySource: InventorySourceEnum.SERVICE_CENTER }
						: { ...line, receivedQuantity: 3 }
			),
			findOne: jest.fn(async (entity) => (entity.name === 'PurchaseReceipt' ? null : null)),
			find: jest.fn(),
			save: jest.fn(),
			update: jest.fn()
		};
		const repository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const stock = { postReceiptIn: jest.fn() };
		const service = new PurchaseReceiptService(
			repository as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			stock as never
		);
		await expect(
			service.post('po', {
				lines: [
					{
						purchaseOrderLineId: 'line',
						warehouseProductVariantId: 'balance',
						receivedQuantity: 2,
						actualUnitCost: 1,
						taxAmount: 0
					}
				]
			})
		).rejects.toBeInstanceOf(BadRequestException);
		expect(stock.postReceiptIn).not.toHaveBeenCalled();
		manager.findOne.mockResolvedValueOnce({ id: 'receipt' });
		await expect(
			service.post('po', {
				externalReference: 'dup',
				lines: [
					{
						purchaseOrderLineId: 'line',
						warehouseProductVariantId: 'balance',
						receivedQuantity: 1,
						actualUnitCost: 1,
						taxAmount: 0
					}
				]
			})
		).rejects.toBeInstanceOf(ConflictException);
	});
	it('keeps Recon receipt posting within Recon inventory source', async () => {
		scope();
		const reconOrder = { ...order, inventorySource: InventorySourceEnum.RECON };
		const manager = {
			findOneByOrFail: jest.fn(async (entity, where) =>
				entity.name === 'PurchaseOrder'
					? reconOrder
					: entity.name === 'PurchaseOrderLine'
						? { ...line }
						: entity.name === 'Warehouse'
							? { id: where.id, inventorySource: InventorySourceEnum.RECON }
							: { id: where.id, productVariantId: 'variant' }
			),
			findOne: jest.fn(async (entity) =>
				entity.name === 'PurchaseReceipt'
					? null
					: {
							id: 'recon-balance',
							variantId: 'variant',
							quantity: 0,
							warehouseProduct: { warehouseId: 'warehouse' }
						}
			),
			find: jest.fn(async () => [{ ...line, receivedQuantity: 0 }]),
			save: jest.fn(async (_entity, data) => ({ id: 'receipt', ...data })),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		const repository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const stock = { postReceiptIn: jest.fn(async () => ({ id: 'movement' })) };
		const service = new PurchaseReceiptService(
			repository as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{ findOneByOrFail: jest.fn() } as never,
			stock as never
		);
		await service.post('po', {
			lines: [
				{
					purchaseOrderLineId: 'line',
					warehouseProductVariantId: 'recon-balance',
					receivedQuantity: 4,
					actualUnitCost: 9,
					taxAmount: 0
				}
			]
		});
		expect(stock.postReceiptIn).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({
				inventorySource: InventorySourceEnum.RECON,
				balance: expect.objectContaining({ id: 'recon-balance' })
			})
		);
	});
	it('keeps posted receipts immutable', async () => {
		const service = new PurchaseReceiptService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
		await expect(service.update()).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.delete()).rejects.toBeInstanceOf(BadRequestException);
	});
});
