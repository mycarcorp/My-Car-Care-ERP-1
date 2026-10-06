import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurrenciesEnum, InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';

describe('PaymentService (payment hardening)', () => {
	const TENANT_ID = '11111111-1111-4111-8111-111111111111';
	const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
	const INVOICE_ID = '99999999-9999-4999-8999-999999999999';
	const FOREIGN_INVOICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const SCOPE = { tenantId: TENANT_ID, organizationId: ORGANIZATION_ID };

	let service: PaymentService;
	let manager: {
		findOne: jest.Mock;
		find: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		delete: jest.Mock;
		transaction: jest.Mock;
	};
	let typeOrmPaymentRepository: { manager: typeof manager; findOneBy: jest.Mock };
	let mikroOrmPaymentRepository: Record<string, never>;
	let emailService: { sendPaymentReceipt: jest.Mock };
	let invoices: { findOneBy: jest.Mock };

	let invoiceRows: any[];
	let paymentRows: any[];
	let paymentSequence: number;

	const matches = (row: any, where: any = {}) =>
		Object.entries(where).every(([key, value]) => row[key] === value);

	const invoiceRow = () => invoiceRows.find((row) => row.id === INVOICE_ID);

	beforeEach(() => {
		paymentRows = [];
		paymentSequence = 0;
		invoiceRows = [
			{
				id: INVOICE_ID,
				totalValue: 200,
				alreadyPaid: 0,
				amountDue: 200,
				status: InvoiceStatusTypesEnum.DRAFT,
				currency: CurrenciesEnum.USD,
				paid: false,
				...SCOPE
			}
		];

		manager = {
			findOne: jest.fn(async (entity: unknown, options: any) => {
				if (entity === Invoice) {
					return invoiceRows.find((row) => matches(row, options.where)) ?? null;
				}
				if (entity === Payment) {
					return paymentRows.find((row) => matches(row, options.where)) ?? null;
				}
				return null;
			}),
			find: jest.fn(async (entity: unknown, options: any) => {
				if (entity === Payment) {
					return paymentRows.filter((row) => matches(row, options.where));
				}
				return [];
			}),
			create: jest.fn((_entity: unknown, input: any) => ({ ...input })),
			save: jest.fn(async (entity: unknown, input: any) => {
				if (entity === Payment) {
					const index = paymentRows.findIndex((row) => row.id === input.id);
					if (index >= 0) {
						paymentRows[index] = { ...paymentRows[index], ...input };
						return paymentRows[index];
					}
					const row = { id: input.id ?? `payment-${++paymentSequence}`, ...input };
					paymentRows.push(row);
					return row;
				}
				if (entity === Invoice) {
					const index = invoiceRows.findIndex((row) => row.id === input.id);
					if (index >= 0) {
						invoiceRows[index] = { ...invoiceRows[index], ...input };
					}
					return input;
				}
				return input;
			}),
			delete: jest.fn(async (entity: unknown, criteria: any) => {
				if (entity === Payment) {
					const before = paymentRows.length;
					paymentRows = paymentRows.filter((row) => !matches(row, criteria));
					return { affected: before - paymentRows.length, raw: [] };
				}
				return { affected: 0, raw: [] };
			}),
			transaction: jest.fn(async (callback: (m: any) => Promise<any>) => {
				// Model rollback: restore the in-memory rows when the callback throws.
				const paymentSnapshot = [...paymentRows];
				const invoiceSnapshot = invoiceRows.map((row) => ({ ...row }));
				try {
					return await callback(manager);
				} catch (error) {
					paymentRows = paymentSnapshot;
					invoiceRows = invoiceSnapshot;
					throw error;
				}
			})
		};

		typeOrmPaymentRepository = {
			manager,
			findOneBy: jest.fn(async (where: any) => paymentRows.find((row) => matches(row, where)) ?? null)
		};
		mikroOrmPaymentRepository = {};
		emailService = { sendPaymentReceipt: jest.fn() };
		invoices = {
			findOneBy: jest.fn(async (where: any) => invoiceRows.find((row) => matches(row, where)) ?? null)
		};

		service = new PaymentService(
			typeOrmPaymentRepository as any,
			mikroOrmPaymentRepository as any,
			emailService as any,
			invoices as any
		);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('marks the invoice FULLY_PAID when a payment covers the total', async () => {
		await service.create({ amount: 200, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		expect(paymentRows).toHaveLength(1);
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 200,
			amountDue: 0,
			paid: true,
			status: InvoiceStatusTypesEnum.FULLY_PAID
		});
	});

	it('marks the invoice PARTIALLY_PAID with amountDue > 0 for a partial payment', async () => {
		await service.create({ amount: 50, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 50,
			amountDue: 150,
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('accumulates multiple payments on the same invoice', async () => {
		await service.create({ amount: 50, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });
		await service.create({ amount: 75, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 125,
			amountDue: 75,
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('marks the invoice OVERPAID with a negative amountDue when payments exceed the total', async () => {
		await service.create({ amount: 250, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 250,
			amountDue: -50,
			paid: true,
			status: InvoiceStatusTypesEnum.OVERPAID
		});
	});

	it('transitions PARTIALLY_PAID to FULLY_PAID when a second payment completes the total', async () => {
		await service.create({ amount: 100, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });
		expect(invoiceRow()?.status).toBe(InvoiceStatusTypesEnum.PARTIALLY_PAID);

		await service.create({ amount: 100, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 200,
			amountDue: 0,
			paid: true,
			status: InvoiceStatusTypesEnum.FULLY_PAID
		});
	});

	it('recalculates from the remaining rows when a payment is deleted', async () => {
		const first = await service.create({ amount: 100, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });
		await service.create({ amount: 100, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });
		expect(invoiceRow()?.status).toBe(InvoiceStatusTypesEnum.FULLY_PAID);

		const result = await service.delete(first.id);

		expect(result.affected).toBe(1);
		expect(paymentRows).toHaveLength(1);
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 100,
			amountDue: 100,
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('throws NotFoundException when deleting a payment outside the current scope', async () => {
		await expect(service.delete('missing-payment-id')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('recalculates from actual rows when a payment amount is updated (controller upsert path)', async () => {
		const payment = await service.create({ amount: 60, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD });

		// The controller's update path calls create({ ...entity, id }).
		await service.create({ id: payment.id, amount: 150 });

		expect(paymentRows).toHaveLength(1);
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 150,
			amountDue: 50,
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('rejects a zero amount', async () => {
		await expect(
			service.create({ amount: 0, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paymentRows).toHaveLength(0);
	});

	it('rejects a negative amount', async () => {
		await expect(
			service.create({ amount: -25, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paymentRows).toHaveLength(0);
	});

	it('rejects a payment for an invoice outside the current tenant/organization scope', async () => {
		invoiceRows.push({
			id: FOREIGN_INVOICE_ID,
			totalValue: 100,
			alreadyPaid: 0,
			amountDue: 100,
			status: InvoiceStatusTypesEnum.DRAFT,
			currency: CurrenciesEnum.USD,
			paid: false,
			tenantId: 'other-tenant',
			organizationId: 'other-organization'
		});

		await expect(
			service.create({ amount: 10, invoiceId: FOREIGN_INVOICE_ID, currency: CurrenciesEnum.USD })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paymentRows).toHaveLength(0);
	});

	it('rejects a payment whose currency does not match the invoice currency', async () => {
		await expect(
			service.create({ amount: 10, invoiceId: INVOICE_ID, currency: CurrenciesEnum.EUR })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paymentRows).toHaveLength(0);
	});

	it('rejects a payment for a VOID invoice', async () => {
		invoiceRow()!.status = InvoiceStatusTypesEnum.VOID;

		await expect(
			service.create({ amount: 10, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paymentRows).toHaveLength(0);
	});

	it('ignores client-supplied alreadyPaid/amountDue/status and recomputes from real sums', async () => {
		const entity: any = {
			amount: 50,
			invoiceId: INVOICE_ID,
			currency: CurrenciesEnum.USD,
			alreadyPaid: 9999,
			amountDue: -9999,
			status: InvoiceStatusTypesEnum.OVERPAID
		};

		const payment = await service.create(entity);

		expect(entity.alreadyPaid).toBeUndefined();
		expect(entity.amountDue).toBeUndefined();
		expect(entity.status).toBeUndefined();
		expect((payment as any).alreadyPaid).toBeUndefined();
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 50,
			amountDue: 150,
			paid: false,
			status: InvoiceStatusTypesEnum.PARTIALLY_PAID
		});
	});

	it('creates a payment without an invoiceId without touching any invoice', async () => {
		const payment = await service.create({ amount: 80, currency: CurrenciesEnum.USD });

		expect(payment.id).toBeDefined();
		expect(paymentRows).toHaveLength(1);
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 0,
			amountDue: 200,
			paid: false,
			status: InvoiceStatusTypesEnum.DRAFT
		});
	});

	it('requires tenant and organization context for every mutation', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null as any);

		await expect(service.create({ amount: 10, currency: CurrenciesEnum.USD })).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(paymentRows).toHaveLength(0);
	});

	it('rolls back the invoice recalculation when the payment save fails', async () => {
		manager.save.mockImplementationOnce(async () => {
			throw new Error('database unavailable');
		});

		await expect(
			service.create({ amount: 200, invoiceId: INVOICE_ID, currency: CurrenciesEnum.USD })
		).rejects.toThrow('database unavailable');

		expect(paymentRows).toHaveLength(0);
		expect(invoiceRow()).toMatchObject({
			alreadyPaid: 0,
			amountDue: 200,
			paid: false,
			status: InvoiceStatusTypesEnum.DRAFT
		});
	});
});
