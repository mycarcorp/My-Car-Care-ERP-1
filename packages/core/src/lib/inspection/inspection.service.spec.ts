import '../core/entities/internal';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InspectionFindingResultEnum } from '@gauzy/contracts';
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
		const repository = new InMemoryTenantRepository<Inspection>(
			new Set(['id', 'tenantId', 'organizationId', 'repairOrderId', 'vehicleId', 'technicianEmployeeId'])
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
});
