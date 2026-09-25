import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PartStockMovementTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../shared/guards';
import { AutomotivePartController } from './automotive-part.controller';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import {
	createCrossTenantFixture,
	createTenantFixture
} from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { AutomotivePartService, normalizeAutomotivePartNumber } from './automotive-part.service';
import { AutomotivePartVendor } from './automotive-part-vendor.entity';
import { AutomotivePartVendorService } from './automotive-part-vendor.service';
import { PartStockMovementService } from './part-stock-movement.service';

const setupScope = (fixture: ReturnType<typeof createTenantFixture>) => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(fixture.tenantId);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(fixture.organizationId);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		...fixture.user,
		lastOrganizationId: fixture.organizationId
	} as never);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(
		TenantAwareCrudService.prototype as unknown as { assertNestedGraphNotForeign: () => Promise<void> },
		'assertNestedGraphNotForeign'
	).mockResolvedValue(undefined);
};

describe('Automotive parts Phase 1 services', () => {
	afterEach(() => jest.restoreAllMocks());

	it('creates a normalized automotive part profile and rejects blank identity', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const profiles = new InMemoryTenantRepository<AutomotivePartProfile>(
			new Set(['id', 'tenantId', 'organizationId'])
		);
		const service = new AutomotivePartService(
			profiles as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'variant',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never
		);
		const created = await service.createAutomotivePart({
			productVariantId: 'variant',
			normalizedPartNumber: ' ab  123 '
		});
		expect(created.normalizedPartNumber).toBe('AB123');
		await expect(
			service.createAutomotivePart({ productVariantId: 'variant', normalizedPartNumber: '   ' })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects duplicate normalized numbers in one tenant/org and permits another tenant/org', async () => {
		const { tenantA, tenantB } = createCrossTenantFixture();
		const profiles = new InMemoryTenantRepository<AutomotivePartProfile>(
			new Set(['id', 'tenantId', 'organizationId'])
		);
		const variants = {
			findOneByOrFail: jest.fn(async (where) => ({
				id: where.id,
				tenantId: where.tenantId,
				organizationId: where.organizationId
			}))
		};
		setupScope(tenantA);
		const service = new AutomotivePartService(profiles as never, {} as never, variants as never);
		await service.createAutomotivePart({ productVariantId: 'variant-a', normalizedPartNumber: 'AB-123' });
		await expect(
			service.createAutomotivePart({ productVariantId: 'variant-b', normalizedPartNumber: ' ab-123 ' })
		).rejects.toBeInstanceOf(ConflictException);
		setupScope(tenantB);
		await expect(
			service.createAutomotivePart({ productVariantId: 'variant-b', normalizedPartNumber: 'AB-123' })
		).resolves.toMatchObject({ normalizedPartNumber: 'AB-123' });
	});

	it('creates a scoped vendor relation and rejects a vendor outside the part organization', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const profile = { id: 'profile', tenantId: fixture.tenantId, organizationId: fixture.organizationId };
		const vendorRelations = new InMemoryTenantRepository<AutomotivePartVendor>(
			new Set(['id', 'tenantId', 'organizationId'])
		);
		const vendors = {
			findOneByOrFail: jest.fn(async (where) => ({
				id: where.id,
				tenantId: where.tenantId,
				organizationId: where.organizationId
			}))
		};
		const service = new AutomotivePartVendorService(
			vendorRelations as never,
			{} as never,
			{ findOneByOrFail: jest.fn(async () => profile) } as never,
			vendors as never
		);
		await expect(service.createForPart('profile', { organizationVendorId: 'vendor' })).resolves.toMatchObject({
			automotivePartProfileId: 'profile'
		});
		await expect(service.createForPart('profile', { organizationVendorId: 'vendor' })).rejects.toBeInstanceOf(
			ConflictException
		);
		vendors.findOneByOrFail.mockRejectedValueOnce(new Error('foreign vendor'));
		await expect(service.createForPart('profile', { organizationVendorId: 'other' })).rejects.toThrow(
			'foreign vendor'
		);
	});

	it('rejects a cross-organization vendor before creating a relation', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const relations = new InMemoryTenantRepository<AutomotivePartVendor>(
			new Set(['id', 'tenantId', 'organizationId'])
		);
		const service = new AutomotivePartVendorService(
			relations as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'profile',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never,
			{
				findOneByOrFail: jest.fn(async (where) => {
					if (where.organizationId !== fixture.organizationId) throw new Error('foreign organization');
					throw new Error('vendor belongs to another organization');
				})
			} as never
		);
		await expect(service.createForPart('profile', { organizationVendorId: 'foreign-vendor' })).rejects.toThrow(
			'vendor belongs to another organization'
		);
	});

	it('rejects a cross-tenant vendor before creating a relation', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const relations = new InMemoryTenantRepository<AutomotivePartVendor>(
			new Set(['id', 'tenantId', 'organizationId'])
		);
		const service = new AutomotivePartVendorService(
			relations as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'profile',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never,
			{
				findOneByOrFail: jest.fn(async (where) => {
					if (where.tenantId !== fixture.tenantId) throw new Error('foreign tenant');
					throw new Error('vendor belongs to another tenant');
				})
			} as never
		);
		await expect(service.createForPart('profile', { organizationVendorId: 'foreign-vendor' })).rejects.toThrow(
			'vendor belongs to another tenant'
		);
	});

	it('writes adjustment-in balance and immutable movement atomically', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const manager = {
			findOneByOrFail: jest.fn(async (_entity, where) => ({
				id: where.id,
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId
			})),
			findOne: jest.fn(async () => ({
				id: 'balance',
				variantId: 'variant',
				quantity: 2,
				warehouseProduct: { warehouseId: 'warehouse' }
			})),
			update: jest.fn(async () => ({ affected: 1 })),
			save: jest.fn(async (_entity, data) => ({ id: 'movement', ...data }))
		};
		const movements = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const service = new PartStockMovementService(
			movements as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'profile',
					productVariantId: 'variant',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never
		);
		const movement = await service.adjust('profile', {
			warehouseId: 'warehouse',
			warehouseProductVariantId: 'balance',
			type: PartStockMovementTypeEnum.ADJUSTMENT_IN,
			quantity: 3,
			reason: 'counted stock'
		});
		expect(movement).toMatchObject({ quantityBefore: 2, quantityAfter: 5, quantityDelta: 3 });
		expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ quantity: 2 }), {
			quantity: 5
		});
		expect(manager.save).toHaveBeenCalledTimes(1);
	});

	it('decreases stock, blocks negative stock, and creates no movement when the balance update is not claimed', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const manager = {
			findOneByOrFail: jest.fn(async (_entity, where) => ({ id: where.id })),
			findOne: jest.fn(async () => ({
				id: 'balance',
				variantId: 'variant',
				quantity: 2,
				warehouseProduct: { warehouseId: 'warehouse' }
			})),
			update: jest.fn(async () => ({ affected: 1 })),
			save: jest.fn(async (_entity, data) => data)
		};
		const movements = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const service = new PartStockMovementService(
			movements as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'profile',
					productVariantId: 'variant',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never
		);
		await expect(
			service.adjust('profile', {
				warehouseId: 'warehouse',
				warehouseProductVariantId: 'balance',
				type: PartStockMovementTypeEnum.ADJUSTMENT_OUT,
				quantity: 3,
				reason: 'damage'
			})
		).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.update).not.toHaveBeenCalled();
		manager.findOne.mockResolvedValueOnce({
			id: 'balance',
			variantId: 'variant',
			quantity: 5,
			warehouseProduct: { warehouseId: 'warehouse' }
		});
		manager.update.mockResolvedValueOnce({ affected: 0 });
		await expect(
			service.adjust('profile', {
				warehouseId: 'warehouse',
				warehouseProductVariantId: 'balance',
				type: PartStockMovementTypeEnum.ADJUSTMENT_OUT,
				quantity: 2,
				reason: 'damage'
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('adjusts stock out with server-calculated before and after quantities', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const manager = {
			findOneByOrFail: jest.fn(async (_entity, where) => ({ id: where.id })),
			findOne: jest.fn(async () => ({
				id: 'balance',
				variantId: 'variant',
				quantity: 5,
				warehouseProduct: { warehouseId: 'warehouse' }
			})),
			update: jest.fn(async () => ({ affected: 1 })),
			save: jest.fn(async (_entity, data) => data)
		};
		const movements = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		const service = new PartStockMovementService(
			movements as never,
			{} as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: 'profile',
					productVariantId: 'variant',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId
				}))
			} as never
		);
		await expect(
			service.adjust('profile', {
				warehouseId: 'warehouse',
				warehouseProductVariantId: 'balance',
				type: PartStockMovementTypeEnum.ADJUSTMENT_OUT,
				quantity: 2,
				reason: 'damage'
			})
		).resolves.toMatchObject({ quantityDelta: -2, quantityBefore: 5, quantityAfter: 3 });
	});

	it('fails cross-tenant and cross-organization stock access before mutation', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const movements = { metadata: { hasColumnWithPropertyPath: () => false }, manager: { transaction: jest.fn() } };
		const profiles = {
			findOneByOrFail: jest.fn(async () => {
				throw new Error('not found in scope');
			})
		};
		const service = new PartStockMovementService(movements as never, {} as never, profiles as never);
		await expect(
			service.adjust('foreign-profile', {
				warehouseId: 'warehouse',
				warehouseProductVariantId: 'balance',
				type: PartStockMovementTypeEnum.ADJUSTMENT_IN,
				quantity: 1,
				reason: 'count'
			})
		).rejects.toThrow('not found in scope');
		expect(movements.manager.transaction).not.toHaveBeenCalled();
	});

	it.each(['cross-tenant', 'cross-organization'])('rejects %s part stock access before mutation', async () => {
		const fixture = createTenantFixture();
		setupScope(fixture);
		const movements = { metadata: { hasColumnWithPropertyPath: () => false }, manager: { transaction: jest.fn() } };
		const profiles = {
			findOneByOrFail: jest.fn(async () => {
				throw new Error('profile is outside the current scope');
			})
		};
		const service = new PartStockMovementService(movements as never, {} as never, profiles as never);
		await expect(
			service.adjust('foreign-profile', {
				warehouseId: 'warehouse',
				warehouseProductVariantId: 'balance',
				type: PartStockMovementTypeEnum.ADJUSTMENT_IN,
				quantity: 1,
				reason: 'count'
			})
		).rejects.toThrow('profile is outside the current scope');
		expect(movements.manager.transaction).not.toHaveBeenCalled();
	});

	it('keeps stock movements immutable after creation', async () => {
		const service = new PartStockMovementService({} as never, {} as never, {} as never);
		await expect(service.update()).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.delete()).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.softDelete()).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects an inventory mutation without a tenant authorization context', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		const guard = new TenantPermissionGuard({} as never, new Reflector(), {} as never);
		const allowed = await guard.canActivate({
			getHandler: () => AutomotivePartController.prototype.adjust,
			getClass: () => AutomotivePartController
		} as never);
		expect(allowed).toBe(false);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AutomotivePartController.prototype.adjust)).toEqual([
			PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT
		]);
	});

	it('normalizes part numbers deterministically', () => {
		expect(normalizeAutomotivePartNumber('  ab 12  ')).toBe('AB12');
	});
});
