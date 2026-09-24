import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getMetadataArgsStorage } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { Vehicle } from './vehicle.entity';
import { VehicleService } from './vehicle.service';

describe('VehicleService', () => {
	type CustomerScopeOverride = {
		tenantId?: string;
		organizationId?: string;
	};

	const sameTenantVehicle = '1HGCM82633A004352';
	let service: VehicleService;
	let repository: InMemoryTenantRepository<Vehicle>;
	let customerService: { findOneByIdString: jest.Mock };
	let tenant: ReturnType<typeof createTenantFixture>;

	const vehicleInput = (overrides: Partial<Vehicle> = {}): Partial<Vehicle> => ({
		customerId: '3a1c3a4d-65b4-4d23-b15c-5e5fc44f09d2',
		vinNormalized: sameTenantVehicle,
		year: 2024,
		make: 'Honda',
		model: 'Accord',
		organizationId: tenant.organizationId,
		...overrides
	});

	beforeEach(() => {
		tenant = createTenantFixture();
		repository = new InMemoryTenantRepository<Vehicle>(
			new Set(['id', 'tenantId', 'organizationId', 'customerId', 'vinNormalized'])
		);
		customerService = {
			findOneByIdString: jest.fn(async () => ({
				id: '3a1c3a4d-65b4-4d23-b15c-5e5fc44f09d2',
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			}))
		};
		service = new VehicleService(repository as any, {} as any, customerService as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([
		['lowercase', '1hgcm82633a004352'],
		['spaces', '1HG CM82633 A004352'],
		['hyphens', '1HG-CM82633-A004352']
	])('normalizes %s VIN input and accepts a valid 17-character VIN', async (_case, vinNormalized) => {
		const vehicle = await service.create(vehicleInput({ vinNormalized }));

		expect(vehicle.vinNormalized).toBe('1HGCM82633A004352');
	});

	it.each(['1HGCM82633A00435I', '1HGCM82633A00435O', '1HGCM82633A00435Q', '1HGCM82633A00435'])(
		'rejects invalid VIN %s',
		async (vinNormalized) => {
			await expect(service.create(vehicleInput({ vinNormalized }))).rejects.toBeInstanceOf(BadRequestException);
		}
	);

	it('rejects the same normalized VIN twice within one tenant', async () => {
		const originalSave = repository.save.bind(repository);
		jest.spyOn(repository, 'save').mockImplementation(async (entity: Partial<Vehicle>) => {
			const duplicate = repository
				.all()
				.find(
					(vehicle) => vehicle.tenantId === entity.tenantId && vehicle.vinNormalized === entity.vinNormalized
				);
			if (duplicate) {
				throw new Error('duplicate key value violates unique constraint');
			}
			return originalSave(entity) as Promise<Vehicle>;
		});

		await service.create(vehicleInput({ vinNormalized: '1hgcm82633a004352' }));
		await expect(service.create(vehicleInput({ vinNormalized: '1HG-CM82633-A004352' }))).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('allows a customer from the current tenant and organization', async () => {
		await expect(service.create(vehicleInput())).resolves.toMatchObject({ customerId: vehicleInput().customerId });
	});

	it.each<[string, CustomerScopeOverride]>([
		['tenant', { tenantId: 'a93b7145-5864-4ced-ab78-f365f6bdfc23' }],
		['organization', { organizationId: 'b6e52f73-ca54-4ab0-97bb-4fa69b271d05' }]
	])('rejects a customer from another %s', async (_scope, customerScope) => {
		customerService.findOneByIdString.mockResolvedValue({
			id: vehicleInput().customerId,
			tenantId: customerScope.tenantId ?? tenant.tenantId,
			organizationId: customerScope.organizationId ?? tenant.organizationId
		});

		await expect(service.create(vehicleInput())).rejects.toBeInstanceOf(BadRequestException);
	});

	const validationErrorsFor = async (overrides: Record<string, unknown>) => {
		const vehicle = plainToInstance(Vehicle, vehicleInput(overrides as Partial<Vehicle>));
		return validate(vehicle);
	};

	it('accepts valid mileage', async () => {
		expect(await validationErrorsFor({ currentMileage: 12500 })).toEqual([]);
	});

	it('rejects negative mileage', async () => {
		const errors = await validationErrorsFor({ currentMileage: -1 });
		expect(errors.find((error) => error.property === 'currentMileage')?.constraints).toHaveProperty('min');
	});

	it('accepts a sensible vehicle year', async () => {
		expect(await validationErrorsFor({ year: 2024 })).toEqual([]);
	});

	it.each([
		[1885, 'min'],
		[2101, 'max']
	])('rejects out-of-range year %i', async (year, constraint) => {
		const errors = await validationErrorsFor({ year });
		expect(errors.find((error) => error.property === 'year')?.constraints).toEqual(
			expect.objectContaining({ [constraint]: expect.any(String) })
		);
	});
});

describe('Vehicle entity constraints', () => {
	it('declares VIN unique per tenant', () => {
		const index = getMetadataArgsStorage().indices.find(
			(candidate) => candidate.target === Vehicle && candidate.name === 'IDX_vehicle_tenant_vin_normalized_unique'
		);

		expect(index?.columns).toEqual(['tenantId', 'vinNormalized']);
		expect(index?.unique).toBe(true);
	});
});
