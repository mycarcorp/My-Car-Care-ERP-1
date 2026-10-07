import '../core/entities/internal';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InspectionFindingResultEnum, InspectionStatusEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { Inspection } from './inspection.entity';
import { InspectionService } from './inspection.service';

describe('InspectionService', () => {
	type ScopeOverride = { tenantId?: string; organizationId?: string };
	const RO_ID = 'aeeeb1cf-bd68-4d78-8ea5-b1e62a0b9bc4';
	const VEHICLE_ID = 'e4b4b351-6aa4-44ae-b1c8-ccdd48de0bd4';
	const TECHNICIAN_ID = '6ef5cb3e-5e2a-446f-b5e3-bd7b7aaea51c';
	let service: InspectionService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let repairOrders: { findOneByIdString: jest.Mock };
	let vehicles: { findOneByIdString: jest.Mock };
	let employees: { findOneByIdString: jest.Mock };
	let findingRepository: { create: jest.Mock; save: jest.Mock };
	let repository: InMemoryTenantRepository<Inspection>;

	// Seeds an inspection row directly (includes the entity-required fields so it
	// satisfies the repository's Inspection type) for read/lifecycle tests.
	const seedInspection = (overrides: Partial<Inspection> = {}): Inspection =>
		repository.seed({
			repairOrderId: RO_ID,
			vehicleId: VEHICLE_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			inspectedAt: new Date('2026-10-01T09:00:00.000Z'),
			status: InspectionStatusEnum.DRAFT,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			...overrides
		} as Inspection);

	beforeEach(() => {
		tenant = createTenantFixture();
		repairOrders = {
			findOneByIdString: jest.fn(async () => ({
				id: RO_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				vehicleId: VEHICLE_ID
			}))
		};
		vehicles = {
			findOneByIdString: jest.fn(async () => ({
				id: VEHICLE_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			}))
		};
		employees = {
			findOneByIdString: jest.fn(async () => ({
				id: TECHNICIAN_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			}))
		};
		findingRepository = { create: jest.fn((input) => input), save: jest.fn(async (input) => input) };
		repository = new InMemoryTenantRepository<Inspection>(
			new Set(['id', 'tenantId', 'organizationId', 'repairOrderId', 'vehicleId', 'technicianEmployeeId', 'status'])
		);
		service = new InspectionService(
			repository as any,
			{} as any,
			findingRepository as any,
			{} as any,
			repairOrders as any,
			vehicles as any,
			employees as any
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
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a draft inspection and its minimum finding', async () => {
		const inspection = await service.createInspection({
			repairOrderId: RO_ID,
			vehicleId: VEHICLE_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			findings: [{ description: 'Brake pad wear', result: InspectionFindingResultEnum.ATTENTION }]
		});
		expect(inspection).toMatchObject({
			repairOrderId: RO_ID,
			vehicleId: VEHICLE_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			status: 'DRAFT'
		});
		expect(findingRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ inspectionId: inspection.id, result: 'ATTENTION' })
		);
	});

	it('rejects a nonexistent repair order', async () => {
		repairOrders.findOneByIdString.mockRejectedValue(new NotFoundException());
		await expect(
			service.createInspection({
				repairOrderId: RO_ID,
				vehicleId: VEHICLE_ID,
				technicianEmployeeId: TECHNICIAN_ID
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects a vehicle that differs from the repair order vehicle', async () => {
		vehicles.findOneByIdString.mockResolvedValue({
			id: 'other-vehicle',
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId
		});
		await expect(
			service.createInspection({
				repairOrderId: RO_ID,
				vehicleId: VEHICLE_ID,
				technicianEmployeeId: TECHNICIAN_ID
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it.each<[string, ScopeOverride, ScopeOverride, ScopeOverride]>([
		['repair order tenant', { tenantId: 'd24f64f3-efb5-4d92-8a4d-e3cd9357d887' }, {}, {}],
		['vehicle organization', {}, { organizationId: '8fafbd4a-afb5-4c75-99f6-7959585574f1' }, {}],
		['technician organization', {}, {}, { organizationId: '2d07b810-9bb4-4b61-8746-05574465d69a' }]
	])('rejects a foreign %s', async (_label, repairScope, vehicleScope, technicianScope) => {
		repairOrders.findOneByIdString.mockResolvedValue({
			id: RO_ID,
			vehicleId: VEHICLE_ID,
			tenantId: repairScope.tenantId ?? tenant.tenantId,
			organizationId: tenant.organizationId
		});
		vehicles.findOneByIdString.mockResolvedValue({
			id: VEHICLE_ID,
			tenantId: tenant.tenantId,
			organizationId: vehicleScope.organizationId ?? tenant.organizationId
		});
		employees.findOneByIdString.mockResolvedValue({
			id: TECHNICIAN_ID,
			tenantId: tenant.tenantId,
			organizationId: technicianScope.organizationId ?? tenant.organizationId
		});
		await expect(
			service.createInspection({
				repairOrderId: RO_ID,
				vehicleId: VEHICLE_ID,
				technicianEmployeeId: TECHNICIAN_ID
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('finds an inspection by id', async () => {
		const existing = seedInspection();
		const found = await service.findByIdWithFindings(existing.id);
		expect(found.id).toBe(existing.id);
	});

	it('finds the inspection for a repair order', async () => {
		const existing = seedInspection();
		const found = await service.findByRepairOrderWithFindings(RO_ID);
		expect(found.id).toBe(existing.id);
	});

	it('cannot read an inspection belonging to another tenant', async () => {
		const foreign = seedInspection({ tenantId: 'f6c2a1a4-9c3f-4a4f-9d21-9c2f0f8a1a01' });
		await expect(service.findByIdWithFindings(foreign.id)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('cannot read an inspection via a repair order from another tenant', async () => {
		seedInspection();
		repairOrders.findOneByIdString.mockRejectedValue(new NotFoundException());
		await expect(service.findByRepairOrderWithFindings(RO_ID)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('starts a draft inspection (DRAFT → IN_PROGRESS)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.DRAFT });
		const updated = await service.start(existing.id);
		expect(updated.status).toBe(InspectionStatusEnum.IN_PROGRESS);
	});

	it('completes an in-progress inspection (IN_PROGRESS → COMPLETED)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.IN_PROGRESS });
		const updated = await service.complete(existing.id);
		expect(updated.status).toBe(InspectionStatusEnum.COMPLETED);
	});

	it('rejects completing a draft inspection (DRAFT → COMPLETED)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.DRAFT });
		await expect(service.complete(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects starting an already in-progress inspection (IN_PROGRESS → IN_PROGRESS)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.IN_PROGRESS });
		await expect(service.start(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects starting a completed inspection (COMPLETED → IN_PROGRESS)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.COMPLETED });
		await expect(service.start(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects completing an already completed inspection (COMPLETED → COMPLETED)', async () => {
		const existing = seedInspection({ status: InspectionStatusEnum.COMPLETED });
		await expect(service.complete(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('enforces tenant isolation on lifecycle transitions', async () => {
		const foreign = seedInspection({
			tenantId: 'f6c2a1a4-9c3f-4a4f-9d21-9c2f0f8a1a01',
			status: InspectionStatusEnum.DRAFT
		});
		await expect(service.start(foreign.id)).rejects.toBeInstanceOf(NotFoundException);
	});
});
