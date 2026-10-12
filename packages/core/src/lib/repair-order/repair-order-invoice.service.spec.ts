import { BadRequestException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobStatusEnum,
	InvoiceStatusTypesEnum,
	PartStockMovementTypeEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { RepairOrderInvoiceService } from './repair-order-invoice.service';

describe('RepairOrderInvoiceService', () => {
	const TENANT_ID = '11111111-1111-4111-8111-111111111111';
	const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
	const REPAIR_ORDER_ID = '33333333-3333-4333-8333-333333333333';
	const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444';
	const JOB_ID = '55555555-5555-4555-8555-555555555555';
	const LABOR_ID = '66666666-6666-4666-8666-666666666666';
	const ESTIMATE_LINE_ID = '77777777-7777-4777-8777-777777777777';
	const PROFILE_ID = '88888888-8888-4888-8888-888888888888';
	const INVOICE_ID = '99999999-9999-4999-8999-999999999999';
	const SCOPE = { tenantId: TENANT_ID, organizationId: ORGANIZATION_ID };

	let service: RepairOrderInvoiceService;
	let manager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; transaction: jest.Mock };
	let repairOrders: { findOneByOrFail: jest.Mock; manager: typeof manager };
	let jobs: { find: jest.Mock };
	let labors: { find: jest.Mock };
	let estimateLines: { findOneByOrFail: jest.Mock };
	let movements: { find: jest.Mock };
	let partProfiles: { findOneBy: jest.Mock };
	let invoiceService: { getHighestInvoiceNumber: jest.Mock };
	let invoiceItemService: { createBulk: jest.Mock };

	const readyRepairOrder = () => ({
		id: REPAIR_ORDER_ID,
		status: RepairOrderStatusEnum.READY,
		customerId: CUSTOMER_ID,
		...SCOPE
	});

	const completedJob = () => ({
		id: JOB_ID,
		repairOrderId: REPAIR_ORDER_ID,
		status: AutomotiveJobStatusEnum.COMPLETED
	});

	const completedLabor = () => ({
		id: LABOR_ID,
		automotiveJobId: JOB_ID,
		estimateLineId: ESTIMATE_LINE_ID,
		description: 'Technician labor row',
		status: AutomotiveJobLaborStatusEnum.COMPLETED
	});

	const estimateLine = () => ({
		id: ESTIMATE_LINE_ID,
		description: 'Brake pad replacement',
		quantity: 2,
		unitPrice: 100,
		lineTotal: 200
	});

	const consumption = () => ({
		automotivePartProfileId: PROFILE_ID,
		repairOrderId: REPAIR_ORDER_ID,
		type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
		quantityDelta: -3,
		unitCost: 25,
		costCurrency: 'USD'
	});

	const partProfile = () => ({
		id: PROFILE_ID,
		manufacturer: 'ACDelco',
		normalizedPartNumber: 'P123',
		oemPartNumber: 'OE9'
	});

	beforeEach(() => {
		manager = {
			findOne: jest.fn(async () => null),
			create: jest.fn((_entity: unknown, input: any) => ({ ...input })),
			save: jest.fn(async (_entity: unknown, input: any) => ({ id: INVOICE_ID, ...input })),
			transaction: jest.fn(async (callback: (m: any) => Promise<any>) => callback(manager))
		};
		repairOrders = {
			findOneByOrFail: jest.fn(async () => readyRepairOrder()),
			manager
		};
		jobs = { find: jest.fn(async () => [completedJob()]) };
		labors = { find: jest.fn(async () => [completedLabor()]) };
		estimateLines = { findOneByOrFail: jest.fn(async () => estimateLine()) };
		movements = { find: jest.fn(async () => [consumption()]) };
		partProfiles = { findOneBy: jest.fn(async () => partProfile()) };
		invoiceService = { getHighestInvoiceNumber: jest.fn(async () => ({ max: 41 })) };
		invoiceItemService = {
			createBulk: jest.fn(async (_invoiceId: string, items: any[]) =>
				items.map((item, index) => ({ id: `item-${index}`, ...item }))
			)
		};

		service = new RepairOrderInvoiceService(
			repairOrders as any,
			jobs as any,
			labors as any,
			estimateLines as any,
			movements as any,
			partProfiles as any,
			invoiceService as any,
			invoiceItemService as any
		);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('generates exactly one invoice for a READY repair order', async () => {
		const invoice = await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(invoice).toMatchObject({
			id: INVOICE_ID,
			invoiceNumber: 42,
			status: InvoiceStatusTypesEnum.DRAFT,
			isEstimate: false,
			paid: false,
			currency: 'USD',
			totalValue: 275,
			alreadyPaid: 0,
			amountDue: 275
		});
		expect(manager.save).toHaveBeenCalledTimes(1);
		expect(invoiceItemService.createBulk).toHaveBeenCalledTimes(1);
		expect(invoiceItemService.createBulk).toHaveBeenCalledWith(
			INVOICE_ID,
			expect.arrayContaining([expect.objectContaining({ invoiceId: INVOICE_ID })])
		);
	});

	it('re-running returns the existing invoice without creating a duplicate', async () => {
		const existing = { id: INVOICE_ID, repairOrderId: REPAIR_ORDER_ID, invoiceItems: [] };
		manager.findOne.mockResolvedValue(existing);

		const invoice = await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(invoice).toBe(existing);
		expect(manager.save).not.toHaveBeenCalled();
		expect(invoiceItemService.createBulk).not.toHaveBeenCalled();
	});

	it('links the invoice to the correct repairOrderId', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(manager.create).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ repairOrderId: REPAIR_ORDER_ID })
		);
	});

	it('uses the repair order customer as toContact/organizationContact', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(manager.create).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				toContactId: CUSTOMER_ID,
				organizationContactId: CUSTOMER_ID,
				fromOrganizationId: ORGANIZATION_ID
			})
		);
	});

	it('prices approved labor from the EstimateLine (quantity x unitPrice = lineTotal), not billRateValue', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		const [, items] = invoiceItemService.createBulk.mock.calls[0];
		const laborItem = items.find((item: any) => item.description === 'Brake pad replacement');
		expect(laborItem).toMatchObject({
			quantity: 2,
			price: 100,
			totalValue: 200,
			applyTax: false,
			applyDiscount: false
		});
		expect(items.some((item: any) => item.description === 'Technician labor row')).toBe(false);
	});

	it('prices parts from consumed quantity and stored unitCost', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		const [, items] = invoiceItemService.createBulk.mock.calls[0];
		const partItem = items.find((item: any) => item.description === 'ACDelco P123');
		expect(partItem).toMatchObject({
			quantity: 3,
			price: 25,
			totalValue: 75,
			applyTax: false,
			applyDiscount: false
		});
	});

	it('computes totals server-side as the sum of line totals', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		const [, input] = manager.save.mock.calls[0];
		const [, items] = invoiceItemService.createBulk.mock.calls[0];
		const lineSum = items.reduce((sum: number, item: any) => sum + item.totalValue, 0);
		expect(input.totalValue).toBe(275);
		expect(input.totalValue).toBe(lineSum);
		expect(input.amountDue).toBe(input.totalValue);
	});

	it('scopes every lookup to the current tenant and organization', async () => {
		await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(repairOrders.findOneByOrFail).toHaveBeenCalledWith({ id: REPAIR_ORDER_ID, ...SCOPE });
		expect(jobs.find).toHaveBeenCalledWith({ where: { repairOrderId: REPAIR_ORDER_ID, ...SCOPE } });
		expect(estimateLines.findOneByOrFail).toHaveBeenCalledWith({ id: ESTIMATE_LINE_ID, ...SCOPE });
	});

	it('throws without tenant/organization context', async () => {
		(RequestContext.currentTenantId as jest.Mock).mockReturnValue(null);

		await expect(service.generateForRepairOrder(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('rejects a repair order outside the current scope', async () => {
		repairOrders.findOneByOrFail.mockRejectedValueOnce(new EntityNotFoundError('RepairOrder', REPAIR_ORDER_ID));

		await expect(service.generateForRepairOrder(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(EntityNotFoundError);
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('throws for ad-hoc labor without an approved estimate line instead of mis-billing', async () => {
		labors.find.mockResolvedValue([
			{ ...completedLabor(), estimateLineId: null, description: 'Ad-hoc diagnostic time' }
		]);

		await expect(service.generateForRepairOrder(REPAIR_ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.generateForRepairOrder(REPAIR_ORDER_ID)).rejects.toThrow(
			/Ad-hoc labor without an approved estimate line cannot be invoiced yet/
		);
		expect(manager.save).not.toHaveBeenCalled();
		expect(invoiceItemService.createBulk).not.toHaveBeenCalled();
	});

	it('throws when the repair order is not READY or CLOSED', async () => {
		repairOrders.findOneByOrFail.mockResolvedValue({
			...readyRepairOrder(),
			status: RepairOrderStatusEnum.IN_PROGRESS
		});

		await expect(service.generateForRepairOrder(REPAIR_ORDER_ID)).rejects.toThrow(
			'Repair order is not ready to be invoiced.'
		);
		expect(manager.save).not.toHaveBeenCalled();
	});

	it('generates an invoice for a CLOSED repair order', async () => {
		repairOrders.findOneByOrFail.mockResolvedValue({ ...readyRepairOrder(), status: RepairOrderStatusEnum.CLOSED });

		const invoice = await service.generateForRepairOrder(REPAIR_ORDER_ID);

		expect(invoice.id).toBe(INVOICE_ID);
		expect(manager.save).toHaveBeenCalledTimes(1);
	});
});
