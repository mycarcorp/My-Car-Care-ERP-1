import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError, In, Not } from 'typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobQcStatusEnum,
	AutomotiveJobStatusEnum,
	InvoiceStatusTypesEnum,
	PartStockMovementTypeEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ServiceHistoryService } from './service-history.service';

describe('ServiceHistoryService', () => {
	const TENANT_ID = '11111111-1111-4111-8111-111111111111';
	const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
	const REPAIR_ORDER_ID = '33333333-3333-4333-8333-333333333333';
	const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444';
	const VEHICLE_ID = '55555555-5555-4555-8555-555555555555';
	const JOB_ID = '66666666-6666-4666-8666-666666666666';
	const LABOR_ID = '77777777-7777-4777-8777-777777777777';
	const PROFILE_ID = '88888888-8888-4888-8888-888888888888';
	const MOVEMENT_ID = '99999999-9999-4999-8999-999999999999';
	const INVOICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const SCOPE = { tenantId: TENANT_ID, organizationId: ORGANIZATION_ID };
	const ARRIVED_AT = new Date('2026-09-14T15:00:00.000Z');
	const QC_CHECKED_AT = new Date('2026-09-15T10:00:00.000Z');
	const WRITE_METHODS = ['save', 'update', 'delete', 'create', 'remove', 'insert'];

	let service: ServiceHistoryService;
	let repairOrders: Record<string, jest.Mock>;
	let jobs: Record<string, jest.Mock>;
	let labors: Record<string, jest.Mock>;
	let movements: Record<string, jest.Mock>;
	let qcAttempts: Record<string, jest.Mock>;
	let invoices: Record<string, jest.Mock>;
	let partProfiles: Record<string, jest.Mock>;
	let vehicleService: { findOneByIdString: jest.Mock };
	let organizationContactService: { findOneByIdString: jest.Mock };

	const repairOrder = (status = RepairOrderStatusEnum.READY) => ({
		id: REPAIR_ORDER_ID,
		repairOrderNumber: 'RO-ABC123DEF456',
		status,
		arrivedAt: ARRIVED_AT,
		arrivalOdometer: 52341,
		originalConcern: 'Brake noise while stopping',
		customerId: CUSTOMER_ID,
		vehicleId: VEHICLE_ID,
		...SCOPE
	});

	const completedJob = () => ({
		id: JOB_ID,
		repairOrderId: REPAIR_ORDER_ID,
		title: 'Brake pad replacement',
		description: 'Replace front brake pads',
		status: AutomotiveJobStatusEnum.COMPLETED
	});

	const completedLabor = () => ({
		id: LABOR_ID,
		automotiveJobId: JOB_ID,
		description: 'Technician labor row',
		billedHours: 1.5,
		status: AutomotiveJobLaborStatusEnum.COMPLETED
	});

	const consumption = () => ({
		id: MOVEMENT_ID,
		automotivePartProfileId: PROFILE_ID,
		repairOrderId: REPAIR_ORDER_ID,
		type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
		quantityDelta: -3,
		unitCost: 25,
		costCurrency: 'USD',
		automotivePartProfile: {
			id: PROFILE_ID,
			manufacturer: 'ACDelco',
			normalizedPartNumber: 'P123',
			oemPartNumber: 'OE9'
		}
	});

	const qcPassed = () => ({
		automotiveJobId: JOB_ID,
		status: AutomotiveJobQcStatusEnum.PASSED,
		checkedAt: QC_CHECKED_AT,
		createdAt: new Date('2026-09-15T10:05:00.000Z')
	});

	const invoiceRow = () => ({
		id: INVOICE_ID,
		repairOrderId: REPAIR_ORDER_ID,
		invoiceNumber: 42,
		totalValue: 275,
		alreadyPaid: 100,
		amountDue: 175,
		status: InvoiceStatusTypesEnum.SENT,
		paid: false
	});

	const repositoryMock = (readMethods: Record<string, jest.Mock>): Record<string, jest.Mock> => {
		const mock: Record<string, jest.Mock> = { ...readMethods };
		for (const method of WRITE_METHODS) {
			mock[method] = jest.fn();
		}
		return mock;
	};

	beforeEach(() => {
		repairOrders = repositoryMock({
			findOneByOrFail: jest.fn(async () => repairOrder()),
			find: jest.fn(async () => [repairOrder()])
		});
		jobs = repositoryMock({ find: jest.fn(async () => [completedJob()]) });
		labors = repositoryMock({ find: jest.fn(async () => [completedLabor()]) });
		movements = repositoryMock({ find: jest.fn(async () => [consumption()]) });
		qcAttempts = repositoryMock({ find: jest.fn(async () => [qcPassed()]) });
		invoices = repositoryMock({ findOne: jest.fn(async () => invoiceRow()) });
		partProfiles = repositoryMock({ findOneBy: jest.fn(async () => null) });
		vehicleService = {
			findOneByIdString: jest.fn(async () => ({ id: VEHICLE_ID, ...SCOPE }))
		};
		organizationContactService = {
			findOneByIdString: jest.fn(async () => ({ id: CUSTOMER_ID, ...SCOPE }))
		};

		service = new ServiceHistoryService(
			repairOrders as any,
			jobs as any,
			labors as any,
			movements as any,
			qcAttempts as any,
			invoices as any,
			partProfiles as any,
			vehicleService as any,
			organizationContactService as any
		);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('builds the full read-only projection for a READY repair order', async () => {
		invoices.findOne.mockResolvedValue(null);

		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(repairOrders.findOneByOrFail).toHaveBeenCalledWith({ id: REPAIR_ORDER_ID, ...SCOPE });
		expect(record).toMatchObject({
			repairOrderId: REPAIR_ORDER_ID,
			repairOrderNumber: 'RO-ABC123DEF456',
			status: RepairOrderStatusEnum.READY,
			arrivedAt: ARRIVED_AT,
			arrivalOdometer: 52341,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			concern: 'Brake noise while stopping',
			workPerformed: [
				{
					jobId: JOB_ID,
					title: 'Brake pad replacement',
					description: 'Replace front brake pads',
					status: AutomotiveJobStatusEnum.COMPLETED
				}
			],
			labor: [
				{
					laborId: LABOR_ID,
					description: 'Technician labor row',
					billedHours: 1.5,
					status: AutomotiveJobLaborStatusEnum.COMPLETED
				}
			],
			partsUsed: [
				{
					partMovementId: MOVEMENT_ID,
					description: 'ACDelco P123',
					quantity: 3,
					unitCost: 25,
					costCurrency: 'USD'
				}
			],
			qc: {
				totalAttempts: 1,
				latestStatus: AutomotiveJobQcStatusEnum.PASSED,
				latestCheckedAt: QC_CHECKED_AT
			}
		});
		expect(record.invoice).toBeUndefined();
	});

	it('builds the projection for a CLOSED repair order', async () => {
		repairOrders.findOneByOrFail.mockResolvedValue(repairOrder(RepairOrderStatusEnum.CLOSED));

		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(record.status).toBe(RepairOrderStatusEnum.CLOSED);
		expect(record.invoice).toMatchObject({ invoiceId: INVOICE_ID });
	});

	it('includes live invoice and payment information when an invoice exists', async () => {
		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(invoices.findOne).toHaveBeenCalledWith({ where: { repairOrderId: REPAIR_ORDER_ID, ...SCOPE } });
		expect(record.invoice).toEqual({
			invoiceId: INVOICE_ID,
			invoiceNumber: 42,
			totalValue: 275,
			amountPaid: 100,
			amountDue: 175,
			status: InvoiceStatusTypesEnum.SENT,
			paid: false
		});
	});

	it('excludes cancelled repair orders from vehicle and customer history', async () => {
		await service.getVehicleServiceHistory(VEHICLE_ID);
		await service.getContactServiceHistory(CUSTOMER_ID);

		const [vehicleQuery, contactQuery] = repairOrders.find.mock.calls.map(([query]) => query);
		expect(vehicleQuery.where.vehicleId).toBe(VEHICLE_ID);
		expect(vehicleQuery.where.status).toEqual(Not(RepairOrderStatusEnum.CANCELLED));
		expect(vehicleQuery.order).toEqual({ arrivedAt: 'DESC' });
		expect(contactQuery.where.customerId).toBe(CUSTOMER_ID);
		expect(contactQuery.where.status).toEqual(Not(RepairOrderStatusEnum.CANCELLED));
		expect(contactQuery.order).toEqual({ arrivedAt: 'DESC' });
	});

	it('reflects the current repair order status after rework (READY back to IN_PROGRESS)', async () => {
		repairOrders.findOneByOrFail.mockResolvedValue(repairOrder(RepairOrderStatusEnum.IN_PROGRESS));

		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(record.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);
	});

	it('returns only the requested vehicle history records', async () => {
		repairOrders.find.mockResolvedValue([
			repairOrder(),
			{ ...repairOrder(), id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', repairOrderNumber: 'RO-BBB123CCC456' }
		]);

		const records = await service.getVehicleServiceHistory(VEHICLE_ID);

		expect(vehicleService.findOneByIdString).toHaveBeenCalledWith(VEHICLE_ID);
		expect(repairOrders.find).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ vehicleId: VEHICLE_ID, ...SCOPE }) })
		);
		expect(records).toHaveLength(2);
		expect(records.every((record) => record.vehicleId === VEHICLE_ID)).toBe(true);
	});

	it('returns only the requested customer history records', async () => {
		repairOrders.find.mockResolvedValue([
			repairOrder(),
			{ ...repairOrder(), id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', repairOrderNumber: 'RO-CCC123DDD456' }
		]);

		const records = await service.getContactServiceHistory(CUSTOMER_ID);

		expect(organizationContactService.findOneByIdString).toHaveBeenCalledWith(CUSTOMER_ID);
		expect(repairOrders.find).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ customerId: CUSTOMER_ID, ...SCOPE }) })
		);
		expect(records).toHaveLength(2);
		expect(records.every((record) => record.customerId === CUSTOMER_ID)).toBe(true);
	});

	it('scopes every projection query to the current tenant and organization', async () => {
		await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(jobs.find).toHaveBeenCalledWith({ where: { repairOrderId: REPAIR_ORDER_ID, ...SCOPE } });
		expect(labors.find).toHaveBeenCalledWith({ where: { automotiveJobId: In([JOB_ID]), ...SCOPE } });
		expect(movements.find).toHaveBeenCalledWith({
			where: {
				repairOrderId: REPAIR_ORDER_ID,
				type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
				...SCOPE
			},
			relations: { automotivePartProfile: true }
		});
		expect(qcAttempts.find).toHaveBeenCalledWith({
			where: { automotiveJobId: In([JOB_ID]), ...SCOPE },
			order: { createdAt: 'DESC' }
		});
		expect(invoices.findOne).toHaveBeenCalledWith({ where: { repairOrderId: REPAIR_ORDER_ID, ...SCOPE } });
	});

	it('rejects repair orders, vehicles and contacts outside the current tenant/organization', async () => {
		repairOrders.findOneByOrFail.mockRejectedValue(new EntityNotFoundError('RepairOrder', { id: 'foreign' }));
		await expect(service.getRepairOrderHistory('ffffffff-ffff-4fff-8fff-ffffffffffff')).rejects.toBeInstanceOf(
			EntityNotFoundError
		);

		vehicleService.findOneByIdString.mockResolvedValue({
			id: 'foreign-vehicle',
			tenantId: 'other-tenant',
			organizationId: 'other-organization'
		});
		await expect(service.getVehicleServiceHistory('foreign-vehicle')).rejects.toBeInstanceOf(NotFoundException);

		organizationContactService.findOneByIdString.mockResolvedValue({
			id: 'foreign-contact',
			tenantId: 'other-tenant',
			organizationId: 'other-organization'
		});
		await expect(service.getContactServiceHistory('foreign-contact')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('requires tenant and organization context before touching any repository', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);

		await expect(service.getRepairOrderHistory(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.getVehicleServiceHistory(VEHICLE_ID)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.getContactServiceHistory(CUSTOMER_ID)).rejects.toBeInstanceOf(BadRequestException);
		expect(repairOrders.findOneByOrFail).not.toHaveBeenCalled();
		expect(repairOrders.find).not.toHaveBeenCalled();
	});

	it('rejects a missing repair order, vehicle or customer as not found', async () => {
		repairOrders.findOneByOrFail.mockRejectedValue(new EntityNotFoundError('RepairOrder', { id: REPAIR_ORDER_ID }));
		await expect(service.getRepairOrderHistory(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(EntityNotFoundError);

		vehicleService.findOneByIdString.mockRejectedValue(new NotFoundException('The requested record was not found'));
		await expect(service.getVehicleServiceHistory(VEHICLE_ID)).rejects.toBeInstanceOf(NotFoundException);

		organizationContactService.findOneByIdString.mockRejectedValue(
			new NotFoundException('The requested record was not found')
		);
		await expect(service.getContactServiceHistory(CUSTOMER_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(repairOrders.find).not.toHaveBeenCalled();
	});

	it('summarizes QC attempts with the latest attempt first', async () => {
		qcAttempts.find.mockResolvedValue([
			qcPassed(),
			{
				...qcPassed(),
				status: AutomotiveJobQcStatusEnum.FAILED,
				checkedAt: new Date('2026-09-14T09:00:00.000Z'),
				createdAt: new Date('2026-09-14T09:05:00.000Z')
			}
		]);

		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(record.qc).toEqual({
			totalAttempts: 2,
			latestStatus: AutomotiveJobQcStatusEnum.PASSED,
			latestCheckedAt: QC_CHECKED_AT
		});
	});

	it('falls back to a scoped part profile lookup when the movement relation is not loaded', async () => {
		movements.find.mockResolvedValue([{ ...consumption(), automotivePartProfile: undefined }]);
		partProfiles.findOneBy.mockResolvedValue({
			id: PROFILE_ID,
			normalizedPartNumber: undefined,
			oemPartNumber: 'OE9'
		});

		const record = await service.getRepairOrderHistory(REPAIR_ORDER_ID);

		expect(partProfiles.findOneBy).toHaveBeenCalledWith({ id: PROFILE_ID, ...SCOPE });
		expect(record.partsUsed[0].description).toBe('OE9');
	});

	it('is read-only: never writes to any repository', async () => {
		await service.getRepairOrderHistory(REPAIR_ORDER_ID);
		await service.getVehicleServiceHistory(VEHICLE_ID);
		await service.getContactServiceHistory(CUSTOMER_ID);

		const repositories = [repairOrders, jobs, labors, movements, qcAttempts, invoices, partProfiles];
		for (const repository of repositories) {
			for (const method of WRITE_METHODS) {
				expect(repository[method]).not.toHaveBeenCalled();
			}
		}
	});
});
