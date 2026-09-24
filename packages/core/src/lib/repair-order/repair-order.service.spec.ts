import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { RepairOrder } from './repair-order.entity';
import { RepairOrderService } from './repair-order.service';

describe('RepairOrderService vehicle arrival', () => {
	type ScopeOverride = {
		tenantId?: string;
		organizationId?: string;
	};

	const APPOINTMENT_ID = '2a48a729-7dd1-4a96-a79e-8426d34d7e5d';
	const CUSTOMER_ID = '17bc6abf-1462-4774-a05f-0becdf2940d0';
	const VEHICLE_ID = '3d3a26b3-d31a-42a3-a044-c23a7eeb8a2f';
	const ADVISOR_ID = 'f741614a-1e03-4093-a5c6-78c9254577d3';
	let service: RepairOrderService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let appointmentService: { findOneByIdString: jest.Mock };
	let customerService: { findOneByIdString: jest.Mock };
	let vehicleService: { findOneByIdString: jest.Mock };

	beforeEach(() => {
		tenant = createTenantFixture();
		appointmentService = {
			findOneByIdString: jest.fn(async () => ({
				id: APPOINTMENT_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				employeeId: ADVISOR_ID,
				originalConcern: 'Brake noise while stopping'
			}))
		};
		customerService = {
			findOneByIdString: jest.fn(async () => ({
				id: CUSTOMER_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			}))
		};
		vehicleService = {
			findOneByIdString: jest.fn(async () => ({
				id: VEHICLE_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				customerId: CUSTOMER_ID
			}))
		};
		const repository = new InMemoryTenantRepository<RepairOrder>(
			new Set(['id', 'tenantId', 'organizationId', 'appointmentId', 'customerId', 'vehicleId'])
		);
		service = new RepairOrderService(
			repository as any,
			{} as any,
			appointmentService as any,
			customerService as any,
			vehicleService as any
		);
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
		jest.spyOn(service, 'findAll').mockResolvedValue({ items: [], total: 0 } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('creates one open repair order from an arrived My Car Care appointment', async () => {
		const repairOrder = await service.arrive({ appointmentId: APPOINTMENT_ID, arrivalOdometer: 52341 });

		expect(repairOrder).toMatchObject({
			appointmentId: APPOINTMENT_ID,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			serviceAdvisorEmployeeId: ADVISOR_ID,
			originalConcern: 'Brake noise while stopping',
			arrivalOdometer: 52341,
			status: 'OPEN'
		});
		expect(repairOrder.repairOrderNumber).toMatch(/^RO-[A-F0-9]{12}$/);
	});

	it('rejects a duplicate repair order for the same service visit', async () => {
		jest.spyOn(service, 'findAll').mockResolvedValue({ items: [{ id: 'existing-ro' }], total: 1 } as any);

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects an appointment without its My Car Care customer and vehicle linkage', async () => {
		appointmentService.findOneByIdString.mockResolvedValue({
			id: APPOINTMENT_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId
		});

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
	});

	it.each<[string, ScopeOverride, ScopeOverride, ScopeOverride]>([
		['appointment tenant', { tenantId: 'ce74d25f-5a8e-4f0c-b3cb-199a66a7a8a7' }, {}, {}],
		['customer organization', {}, { organizationId: '012351be-fbd9-4f4c-80fc-df7e82162a58' }, {}],
		['vehicle organization', {}, {}, { organizationId: '4be58a74-5f81-43b7-8954-98d87aa4eb79' }]
	])('rejects arrival with a foreign %s', async (_scope, appointmentScope, customerScope, vehicleScope) => {
		appointmentService.findOneByIdString.mockResolvedValue({
			id: APPOINTMENT_ID,
			tenantId: appointmentScope.tenantId ?? tenant.tenantId,
			organizationId: tenant.organizationId,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID
		});
		customerService.findOneByIdString.mockResolvedValue({
			id: CUSTOMER_ID,
			tenantId: tenant.tenantId,
			organizationId: customerScope.organizationId ?? tenant.organizationId
		});
		vehicleService.findOneByIdString.mockResolvedValue({
			id: VEHICLE_ID,
			tenantId: tenant.tenantId,
			organizationId: vehicleScope.organizationId ?? tenant.organizationId,
			customerId: CUSTOMER_ID
		});

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects arrival when the appointment vehicle belongs to another customer', async () => {
		vehicleService.findOneByIdString.mockResolvedValue({
			id: VEHICLE_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			customerId: 'd2b8a4c1-52ec-4195-b928-dbe0ad90fc8b'
		});

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('RepairOrder entity constraints', () => {
	it('declares one repair order per appointment and unique numbers per tenant', () => {
		const indexes = getMetadataArgsStorage().indices.filter((index) => index.target === RepairOrder);

		expect(indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ columns: ['appointmentId'], unique: true }),
				expect.objectContaining({ columns: ['tenantId', 'repairOrderNumber'], unique: true })
			])
		);
	});
});
