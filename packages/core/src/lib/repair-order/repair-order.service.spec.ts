import '../core/entities/internal';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AutomotiveJobStatusEnum, EmployeeAppointmentStatus, RepairOrderStatusEnum } from '@gauzy/contracts';
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
	let managerUpdateSpy: jest.Mock;
	let transactionUsed: boolean;

	// Builds the arrival appointment fixture; `status` is SCHEDULED by default and
	// can be overridden to exercise the CANCELLED / COMPLETED rejection paths.
	const appointmentFixture = (overrides: Record<string, any> = {}): Record<string, any> => ({
		id: APPOINTMENT_ID,
		tenantId: tenant.tenantId,
		organizationId: tenant.organizationId,
		customerId: CUSTOMER_ID,
		vehicleId: VEHICLE_ID,
		employeeId: ADVISOR_ID,
		originalConcern: 'Brake noise while stopping',
		status: EmployeeAppointmentStatus.SCHEDULED,
		...overrides
	});

	beforeEach(() => {
		tenant = createTenantFixture();
		appointmentService = {
			findOneByIdString: jest.fn(async () => appointmentFixture())
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
		// The arrival path now runs the RO save + appointment status update inside
		// `typeOrmRepairOrderRepository.manager.transaction(...)`. Provide a faithful in-memory
		// stand-in: getRepository(RepairOrder) returns the same in-memory repository so the real
		// create/save logic executes, and `manager.update` is captured for assertions.
		managerUpdateSpy = jest.fn(async () => ({ affected: 1, raw: [], generatedMaps: [] }));
		transactionUsed = false;
		(repository as any).manager = {
			transaction: async (work: (manager: any) => Promise<any>) => {
				transactionUsed = true;
				return await work({
					getRepository: () => repository,
					update: managerUpdateSpy
				});
			}
		};
		service = new RepairOrderService(
			repository as any,
			{} as any,
			appointmentService as any,
			customerService as any,
			vehicleService as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any
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

	it('runs the RO creation and appointment completion inside a single transaction', async () => {
		const repairOrder = await service.arrive({ appointmentId: APPOINTMENT_ID });

		expect(transactionUsed).toBe(true);
		expect(repairOrder.status).toBe(RepairOrderStatusEnum.OPEN);
		expect(managerUpdateSpy).toHaveBeenCalledWith(
			expect.anything(),
			{ id: APPOINTMENT_ID },
			{ status: EmployeeAppointmentStatus.COMPLETED }
		);
	});

	it('rejects arrival for a cancelled appointment', async () => {
		appointmentService.findOneByIdString.mockResolvedValue(
			appointmentFixture({ status: EmployeeAppointmentStatus.CANCELLED })
		);

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
		expect(managerUpdateSpy).not.toHaveBeenCalled();
	});

	it('rejects arrival for an already-checked-in (completed) appointment', async () => {
		appointmentService.findOneByIdString.mockResolvedValue(
			appointmentFixture({ status: EmployeeAppointmentStatus.COMPLETED })
		);

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
		expect(managerUpdateSpy).not.toHaveBeenCalled();
	});

	it('rejects a duplicate repair order for the same service visit', async () => {
		jest.spyOn(service, 'findAll').mockResolvedValue({ items: [{ id: 'existing-ro' }], total: 1 } as any);

		await expect(service.arrive({ appointmentId: APPOINTMENT_ID })).rejects.toBeInstanceOf(BadRequestException);
		expect(managerUpdateSpy).not.toHaveBeenCalled();
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

describe('RepairOrderService lifecycle', () => {
	const REPAIR_ORDER_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
	const LABOR_ID = '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b';
	let service: RepairOrderService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let repairOrders: InMemoryTenantRepository<RepairOrder>;
	let jobs: InMemoryTenantRepository;
	let labors: InMemoryTenantRepository;
	let timeLogs: InMemoryTenantRepository;

	const seedRepairOrder = (status: RepairOrderStatusEnum, overrides: Record<string, unknown> = {}) =>
		repairOrders.seed({
			id: REPAIR_ORDER_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			status,
			...overrides
		} as RepairOrder);

	const seedJob = (id: string, status: AutomotiveJobStatusEnum) =>
		jobs.seed({
			id,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			repairOrderId: REPAIR_ORDER_ID,
			status
		});

	const seedRunningLaborLog = (jobId: string) => {
		labors.seed({
			id: LABOR_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			automotiveJobId: jobId
		});
		timeLogs.seed({
			id: 'a7b1c3d4-2e5f-4a6b-8c9d-0e1f2a3b4c5d',
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			automotiveJobLaborId: LABOR_ID,
			isRunning: true
		});
	};

	beforeEach(() => {
		tenant = createTenantFixture();
		repairOrders = new InMemoryTenantRepository<RepairOrder>(
			new Set(['id', 'tenantId', 'organizationId', 'appointmentId', 'customerId', 'vehicleId'])
		);
		jobs = new InMemoryTenantRepository(new Set(['id', 'tenantId', 'organizationId']));
		labors = new InMemoryTenantRepository(new Set(['id', 'tenantId', 'organizationId']));
		timeLogs = new InMemoryTenantRepository(new Set(['id', 'tenantId', 'organizationId']));
		service = new RepairOrderService(
			repairOrders as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			jobs as any,
			labors as any,
			timeLogs as any,
			{} as any
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('moves an open repair order to in-progress when work starts', async () => {
		seedRepairOrder(RepairOrderStatusEnum.OPEN);

		await service.markInProgressIfOpen(REPAIR_ORDER_ID);

		expect((await repairOrders.findOneBy({ id: REPAIR_ORDER_ID }))?.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it.each([RepairOrderStatusEnum.IN_PROGRESS, RepairOrderStatusEnum.READY])(
		'keeps a %s repair order untouched when work starts',
		async (status) => {
			seedRepairOrder(status);
			const updateSpy = jest.spyOn(repairOrders, 'update');

			await service.markInProgressIfOpen(REPAIR_ORDER_ID);

			expect(updateSpy).not.toHaveBeenCalled();
			expect((await repairOrders.findOneBy({ id: REPAIR_ORDER_ID }))?.status).toBe(status);
		}
	);

	it.each([RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED])(
		'rejects starting work on a terminal %s repair order',
		async (status) => {
			seedRepairOrder(status);

			await expect(service.markInProgressIfOpen(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
		}
	);

	it('marks an in-progress repair order ready once every non-cancelled job is completed', async () => {
		seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
		seedJob('job-1', AutomotiveJobStatusEnum.COMPLETED);
		seedJob('job-2', AutomotiveJobStatusEnum.COMPLETED);
		labors.seed({
			id: LABOR_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			automotiveJobId: 'job-1'
		});

		const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

		expect(result.status).toBe(RepairOrderStatusEnum.READY);
	});

	it('excludes cancelled jobs from the readiness check', async () => {
		seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
		seedJob('job-1', AutomotiveJobStatusEnum.COMPLETED);
		seedJob('job-2', AutomotiveJobStatusEnum.CANCELLED);

		const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

		expect(result.status).toBe(RepairOrderStatusEnum.READY);
	});

	it('stays in-progress while a non-cancelled job is not completed', async () => {
		seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
		seedJob('job-1', AutomotiveJobStatusEnum.COMPLETED);
		seedJob('job-2', AutomotiveJobStatusEnum.IN_PROGRESS);

		const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

		expect(result.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it('stays in-progress when no non-cancelled job remains', async () => {
		seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
		seedJob('job-1', AutomotiveJobStatusEnum.CANCELLED);

		const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

		expect(result.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it('stays in-progress while a labor time log is still running', async () => {
		seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
		seedJob('job-1', AutomotiveJobStatusEnum.COMPLETED);
		seedRunningLaborLog('job-1');

		const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

		expect(result.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it.each([RepairOrderStatusEnum.READY, RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED])(
		'leaves a %s repair order unchanged when evaluating readiness',
		async (status) => {
			seedRepairOrder(status);
			const saveSpy = jest.spyOn(repairOrders, 'save');

			const result = await service.evaluateReadiness(REPAIR_ORDER_ID);

			expect(result.status).toBe(status);
			expect(saveSpy).not.toHaveBeenCalled();
		}
	);

	it('closes a ready repair order', async () => {
		seedRepairOrder(RepairOrderStatusEnum.READY);

		const result = await service.close(REPAIR_ORDER_ID, {});

		expect(result.status).toBe(RepairOrderStatusEnum.CLOSED);
	});

	it('returns an already closed repair order without changes', async () => {
		seedRepairOrder(RepairOrderStatusEnum.CLOSED);
		const saveSpy = jest.spyOn(repairOrders, 'save');

		const result = await service.close(REPAIR_ORDER_ID, {});

		expect(result.status).toBe(RepairOrderStatusEnum.CLOSED);
		expect(saveSpy).not.toHaveBeenCalled();
	});

	it.each([RepairOrderStatusEnum.OPEN, RepairOrderStatusEnum.IN_PROGRESS])(
		'rejects closing a %s repair order',
		async (status) => {
			seedRepairOrder(status);

			await expect(service.close(REPAIR_ORDER_ID, {})).rejects.toBeInstanceOf(BadRequestException);
		}
	);

	it.each([RepairOrderStatusEnum.OPEN, RepairOrderStatusEnum.IN_PROGRESS, RepairOrderStatusEnum.READY])(
		'cancels a %s repair order with a reason',
		async (status) => {
			seedRepairOrder(status);

			const result = await service.cancel(REPAIR_ORDER_ID, { cancelReason: 'Customer no-show' });

			expect(result.status).toBe(RepairOrderStatusEnum.CANCELLED);
		}
	);

	it('returns an already cancelled repair order without changes', async () => {
		seedRepairOrder(RepairOrderStatusEnum.CANCELLED);
		const saveSpy = jest.spyOn(repairOrders, 'save');

		const result = await service.cancel(REPAIR_ORDER_ID, { cancelReason: 'Duplicate visit' });

		expect(result.status).toBe(RepairOrderStatusEnum.CANCELLED);
		expect(saveSpy).not.toHaveBeenCalled();
	});

	it('rejects cancelling a closed repair order', async () => {
		seedRepairOrder(RepairOrderStatusEnum.CLOSED);

		await expect(service.cancel(REPAIR_ORDER_ID, { cancelReason: 'Customer request' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('requires a cancellation reason', async () => {
		seedRepairOrder(RepairOrderStatusEnum.OPEN);

		await expect(service.cancel(REPAIR_ORDER_ID, { cancelReason: '   ' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it.each([AutomotiveJobStatusEnum.OPEN, AutomotiveJobStatusEnum.ASSIGNED, AutomotiveJobStatusEnum.IN_PROGRESS])(
		'blocks cancellation while a %s job exists',
		async (status) => {
			seedRepairOrder(RepairOrderStatusEnum.IN_PROGRESS);
			seedJob('job-1', status);

			await expect(service.cancel(REPAIR_ORDER_ID, { cancelReason: 'Customer request' })).rejects.toBeInstanceOf(
				ConflictException
			);
		}
	);

	it('returns a ready repair order to in-progress for rework', async () => {
		seedRepairOrder(RepairOrderStatusEnum.READY);

		await service.markRework(REPAIR_ORDER_ID);

		expect((await repairOrders.findOneBy({ id: REPAIR_ORDER_ID }))?.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it.each([RepairOrderStatusEnum.OPEN, RepairOrderStatusEnum.IN_PROGRESS])(
		'keeps a %s repair order untouched on rework',
		async (status) => {
			seedRepairOrder(status);
			const updateSpy = jest.spyOn(repairOrders, 'update');

			await service.markRework(REPAIR_ORDER_ID);

			expect(updateSpy).not.toHaveBeenCalled();
		}
	);

	it.each([RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED])(
		'rejects rework on a terminal %s repair order',
		async (status) => {
			seedRepairOrder(status);

			await expect(service.markRework(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
		}
	);

	it('hides repair orders outside the current tenant scope', async () => {
		repairOrders.seed({
			id: REPAIR_ORDER_ID,
			tenantId: 'ce74d25f-5a8e-4f0c-b3cb-199a66a7a8a7',
			organizationId: tenant.organizationId,
			status: RepairOrderStatusEnum.OPEN
		} as RepairOrder);

		await expect(service.markInProgressIfOpen(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.close(REPAIR_ORDER_ID, {})).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.cancel(REPAIR_ORDER_ID, { cancelReason: 'Customer request' })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('requires a tenant and organization context', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
		seedRepairOrder(RepairOrderStatusEnum.OPEN);

		await expect(service.markInProgressIfOpen(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
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
