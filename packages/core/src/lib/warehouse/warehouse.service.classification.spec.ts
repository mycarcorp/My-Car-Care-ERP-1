import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { InventorySourceEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../core/utils';
import { TenantPermissionGuard } from '../shared/guards';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

const tenantId = 'tenant-1';
const organizationId = 'organization-1';

function setupContext() {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', tenantId } as never);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(TenantAwareCrudService.prototype as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
}

function createService(options: { inventorySource?: InventorySourceEnum | null; activityCounts?: number[] } = {}) {
	const warehouse = { id: 'warehouse-1', tenantId, organizationId, inventorySource: options.inventorySource ?? null };
	const counts = [...(options.activityCounts ?? [0, 0, 0, 0, 0])];
	const manager = {
		findOneByOrFail: jest.fn(async (_entity, where) => ({ ...warehouse, ...where })),
		count: jest.fn(async () => counts.shift() ?? 0),
		update: jest.fn(async (_entity, _where, values) => {
			Object.assign(warehouse, values);
			return { affected: 1 };
		})
	};
	const repository = {
		metadata: { hasColumnWithPropertyPath: () => false },
		manager: { transaction: jest.fn(async (callback) => callback(manager)) }
	};
	return { service: new WarehouseService(repository as never, {} as never), manager, repository };
}

describe('Warehouse inventory source classification', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each([
		['SERVICE_CENTER', InventorySourceEnum.SERVICE_CENTER],
		['RECON', InventorySourceEnum.RECON]
	] as Array<[string, InventorySourceEnum]>)('classifies an unused warehouse as %s', async (_name, source) => {
		setupContext();
		const { service, manager } = createService();
		await expect(service.classifyInventorySource('warehouse-1', source)).resolves.toMatchObject({
			id: 'warehouse-1',
			inventorySource: source
		});
		expect(manager.update).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ id: 'warehouse-1', tenantId, organizationId }),
			{ inventorySource: source }
		);
	});

	it('rejects invalid source values before opening a transaction', async () => {
		setupContext();
		const { service, repository } = createService();
		await expect(
			service.classifyInventorySource('warehouse-1', 'SERVICE' as InventorySourceEnum)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.manager.transaction).not.toHaveBeenCalled();
	});

	it('scopes warehouse access by the current tenant and organization', async () => {
		setupContext();
		const { service, manager } = createService();
		await service.classifyInventorySource('warehouse-1', InventorySourceEnum.SERVICE_CENTER);
		expect(manager.findOneByOrFail).toHaveBeenCalledWith(expect.anything(), {
			id: 'warehouse-1',
			tenantId,
			organizationId
		});
	});

	it.each([
		['warehouse product rows', [1, 0, 0, 0, 0]],
		['variant balances', [0, 1, 0, 0, 0]],
		['stock movements', [0, 0, 1, 0, 0]],
		['purchase orders', [0, 0, 0, 1, 0]],
		['purchase receipts', [0, 0, 0, 0, 1]]
	] as Array<[string, number[]]>)('blocks classification when %s exist', async (_kind, activityCounts) => {
		setupContext();
		const { service, manager } = createService({ activityCounts });
		await expect(service.classifyInventorySource('warehouse-1', InventorySourceEnum.RECON)).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('does not permit changing a source after classification', async () => {
		setupContext();
		const { service, manager } = createService({ inventorySource: InventorySourceEnum.SERVICE_CENTER });
		await expect(service.classifyInventorySource('warehouse-1', InventorySourceEnum.RECON)).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(manager.count).not.toHaveBeenCalled();
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('allows idempotent requests for the already assigned source', async () => {
		setupContext();
		const { service, manager } = createService({ inventorySource: InventorySourceEnum.SERVICE_CENTER });
		await expect(
			service.classifyInventorySource('warehouse-1', InventorySourceEnum.SERVICE_CENTER)
		).resolves.toMatchObject({ inventorySource: InventorySourceEnum.SERVICE_CENTER });
		expect(manager.count).not.toHaveBeenCalled();
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('requires inventory edit permission on the classification endpoint', async () => {
		setupContext();
		const guard = new TenantPermissionGuard(
			{ get: jest.fn(async () => false), set: jest.fn() } as never,
			new Reflector(),
			{ checkRolePermission: jest.fn(async () => false) } as never
		);
		const allowed = await guard.canActivate({
			getHandler: () => WarehouseController.prototype.classifyInventorySource,
			getClass: () => WarehouseController,
			switchToHttp: () => ({
				getRequest: () => ({
					method: 'PATCH',
					query: {},
					headers: {},
					rawHeaders: [],
					body: { tenantId }
				})
			})
		} as never);
		expect(allowed).toBe(false);
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, WarehouseController.prototype.classifyInventorySource)
		).toEqual([PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT]);
	});
});
