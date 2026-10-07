import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EmployeeAppointmentStatus } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentService } from './employee-appointment.service';

describe('EmployeeAppointmentService My Car Care integration', () => {
	type ScopeOverride = {
		tenantId?: string;
		organizationId?: string;
	};

	const CUSTOMER_ID = '2ac08c5e-3d88-474a-9ac4-7df6fa47e9dc';
	const VEHICLE_ID = 'ca74285d-5b54-46bd-97c6-3c1df53819bf';
	let service: EmployeeAppointmentService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let customerService: { findOneByIdString: jest.Mock };
	let vehicleService: { findOneByIdString: jest.Mock };
	let repository: InMemoryTenantRepository<EmployeeAppointment>;

	const appointmentInput = (overrides: Partial<EmployeeAppointment> = {}): Partial<EmployeeAppointment> => ({
		agenda: 'Oil change appointment',
		startDateTime: new Date('2026-10-01T09:00:00.000Z'),
		endDateTime: new Date('2026-10-01T10:00:00.000Z'),
		organizationId: tenant.organizationId,
		...overrides
	});

	// Seeds an existing appointment row directly (includes the entity-required fields
	// so it satisfies the repository's EmployeeAppointment type).
	const seedAppointment = (overrides: Partial<EmployeeAppointment>): EmployeeAppointment =>
		repository.seed({
			agenda: 'Existing appointment',
			startDateTime: new Date('2026-10-01T09:00:00.000Z'),
			endDateTime: new Date('2026-10-01T10:00:00.000Z'),
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			status: EmployeeAppointmentStatus.SCHEDULED,
			...overrides
		} as EmployeeAppointment);

	beforeEach(() => {
		tenant = createTenantFixture();
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
		repository = new InMemoryTenantRepository<EmployeeAppointment>(
			new Set(['id', 'tenantId', 'organizationId', 'employeeId', 'customerId', 'vehicleId', 'status'])
		);
		service = new EmployeeAppointmentService(
			repository as any,
			{} as any,
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
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('preserves existing generic appointments without automotive fields', async () => {
		await expect(service.create(appointmentInput())).resolves.toMatchObject({ agenda: 'Oil change appointment' });
		expect(customerService.findOneByIdString).not.toHaveBeenCalled();
		expect(vehicleService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('creates an appointment for a current customer, vehicle, and original concern', async () => {
		const appointment = await service.create(
			appointmentInput({
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				originalConcern: 'Brake noise while stopping'
			})
		);

		expect(appointment).toMatchObject({
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			originalConcern: 'Brake noise while stopping'
		});
	});

	it('requires all My Car Care appointment fields when any automotive field is supplied', async () => {
		await expect(service.create(appointmentInput({ customerId: CUSTOMER_ID }))).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it.each<[string, ScopeOverride, ScopeOverride]>([
		['customer tenant', { tenantId: '44cc3fab-c3a3-44bc-8610-0f0a95c3a37a' }, {}],
		['vehicle organization', {}, { organizationId: 'cb6e597f-04e6-4a6a-886d-ff1810b4d6f5' }]
	])('rejects an appointment with a foreign %s', async (_scope, customerScope, vehicleScope) => {
		customerService.findOneByIdString.mockResolvedValue({
			id: CUSTOMER_ID,
			tenantId: customerScope.tenantId ?? tenant.tenantId,
			organizationId: tenant.organizationId
		});
		vehicleService.findOneByIdString.mockResolvedValue({
			id: VEHICLE_ID,
			tenantId: tenant.tenantId,
			organizationId: vehicleScope.organizationId ?? tenant.organizationId,
			customerId: CUSTOMER_ID
		});

		await expect(
			service.create(
				appointmentInput({ customerId: CUSTOMER_ID, vehicleId: VEHICLE_ID, originalConcern: 'Engine noise' })
			)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a vehicle associated with another customer', async () => {
		vehicleService.findOneByIdString.mockResolvedValue({
			id: VEHICLE_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			customerId: '712aa055-093e-4317-bf28-1bf923e0b92d'
		});

		await expect(
			service.create(
				appointmentInput({ customerId: CUSTOMER_ID, vehicleId: VEHICLE_ID, originalConcern: 'Engine noise' })
			)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('defaults a new appointment to SCHEDULED when no status is supplied', async () => {
		const appointment = await service.create(appointmentInput());
		expect(appointment.status).toBe(EmployeeAppointmentStatus.SCHEDULED);
	});

	it('preserves an explicitly supplied valid status on create', async () => {
		const appointment = await service.create(appointmentInput({ status: EmployeeAppointmentStatus.COMPLETED }));
		expect(appointment.status).toBe(EmployeeAppointmentStatus.COMPLETED);
	});

	it.each<[string, EmployeeAppointmentStatus]>([
		['completed', EmployeeAppointmentStatus.COMPLETED],
		['cancelled', EmployeeAppointmentStatus.CANCELLED]
	])('rejects a %s appointment moving back to SCHEDULED', async (_label, terminalStatus) => {
		const existing = seedAppointment({ status: terminalStatus });

		await expect(
			service.update(existing.id, { status: EmployeeAppointmentStatus.SCHEDULED })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects cancellation without the cancel permission', async () => {
		const existing = seedAppointment({ status: EmployeeAppointmentStatus.SCHEDULED });
		// RequestContext.hasPermission is already mocked to false in beforeEach.
		await expect(
			service.update(existing.id, { status: EmployeeAppointmentStatus.CANCELLED })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('allows cancellation when the cancel permission is present', async () => {
		const existing = seedAppointment({ status: EmployeeAppointmentStatus.SCHEDULED });
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

		await expect(
			service.update(existing.id, { status: EmployeeAppointmentStatus.CANCELLED })
		).resolves.not.toThrow();
	});
});
