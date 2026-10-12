import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import {
	FinancingApplicationStatusEnum,
	FINANCING_ACTIVE_KEY,
	InvoiceStatusTypesEnum,
	PaymentMethodEnum
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { coreEntities } from '../core/entities';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FinancingApplication } from './financing-application.entity';
import { FinancingApplicationService } from './financing-application.service';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';
import { PaymentService } from '../payment/payment.service';

/**
 * Real-database integration test for the financing funding financial seam: an ACCEPTED
 * financing application funds its repair order's invoice by recording a REAL payment through
 * the REAL `PaymentService` (which authoritatively recalculates the invoice's alreadyPaid /
 * amountDue / status), all inside one TypeORM transaction against a real better-sqlite3
 * database built from the real entity schema (`synchronize`).
 *
 * This is the cross-module handoff the per-module unit suites stub out: it proves the funding
 * path persists a payment row, that the invoice's financial state is recomputed from real
 * payment rows (not trusted from the caller), and that the atomic claim flips ACCEPTED → FUNDED
 * exactly once. The funding service's other neighbors (RepairOrderService/EstimateService) are
 * inert stand-ins because `fund()` never calls them.
 */
describe('FinancingApplicationService funding (real DB)', () => {
	const RO_ID = '1b2c3d4e-0000-4000-8000-aaaaaaaaaaa1';
	const INVOICE_ID = '1b2c3d4e-0000-4000-8000-aaaaaaaaaaa2';

	let dataSource: DataSource;
	let dbPath: string;
	let tenant: ReturnType<typeof createTenantFixture>;
	let service: FinancingApplicationService;

	const seedInvoice = (overrides: Record<string, unknown> = {}) =>
		dataSource.getRepository(Invoice).save(
			dataSource.getRepository(Invoice).create({
				id: INVOICE_ID,
				repairOrderId: RO_ID,
				tenant: { id: tenant.tenantId } as any,
				organization: { id: tenant.organizationId } as any,
				fromOrganizationId: tenant.organizationId,
				invoiceNumber: 1001,
				invoiceDate: new Date(),
				dueDate: new Date(),
				currency: 'USD',
				discountValue: 0,
				tax: 0,
				tax2: 0,
				terms: '',
				paid: false,
				totalValue: 1500,
				alreadyPaid: 0,
				amountDue: 1500,
				status: InvoiceStatusTypesEnum.SENT,
				...overrides
			})
		);

	const seedAcceptedApplication = (approvedAmount = 2000) =>
		dataSource.getRepository(FinancingApplication).save(
			dataSource.getRepository(FinancingApplication).create({
				repairOrderId: RO_ID,
				estimateId: 'est-1',
				customerId: 'customer-1',
				vehicleId: 'vehicle-1',
				customerWorkApprovalId: 'approval-1',
				currency: 'USD',
				requestedAmount: 1500,
				approvedAmount,
				status: FinancingApplicationStatusEnum.ACCEPTED,
				activeKey: FINANCING_ACTIVE_KEY,
				tenant: { id: tenant.tenantId } as any,
				organization: { id: tenant.organizationId } as any
			})
		);

	beforeAll(async () => {
		// A real temp file (not :memory:) so the schema and behavior match how the app runs.
		dbPath = path.join(os.tmpdir(), `gauzy-financing-fund-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			synchronize: true,
			entities: coreEntities as any,
			logging: false
		});
		await dataSource.initialize();
		// This test verifies the funding financial handoff (payment → invoice recalculation →
		// atomic claim), not referential integrity across the whole reference graph. FK enforcement is
		// disabled ONLY to avoid seeding the entire referenced entity graph
		// (Organization→User→Employee→Contact→Vehicle→RepairOrder); this test does not validate FK
		// integrity — the migration tests cover the FK constraints themselves.
		await dataSource.query('PRAGMA foreign_keys = OFF');
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	beforeEach(async () => {
		tenant = createTenantFixture();
		// Seed the real Tenant and Organization parents so the tenant/org *relations* resolve.
		await dataSource.getRepository(Tenant).save({ id: tenant.tenantId, name: 'Test Tenant' } as any);
		await dataSource
			.getRepository(Organization)
			.save({ id: tenant.organizationId, name: 'Test Org', currency: 'USD', tenant: { id: tenant.tenantId } as any } as any);

		await dataSource.getRepository(Payment).clear();
		await dataSource.getRepository(Invoice).clear();
		await dataSource.getRepository(FinancingApplication).clear();

		// The REAL PaymentService with real repositories — the invoice recalculation is genuine.
		const paymentService = new PaymentService(
			dataSource.getRepository(Payment) as any,
			{} as any,
			{} as any, // EmailService is unused by the funding path
			dataSource.getRepository(Invoice) as any
		);

		service = new FinancingApplicationService(
			dataSource.getRepository(FinancingApplication) as any,
			{} as any,
			{} as any, // RepairOrderService — not called by fund()
			{} as any, // EstimateService — not called by fund()
			{} as any, // OrganizationContactService
			{} as any, // VehicleService
			{} as any, // approvals repository — not read by fund()
			dataSource.getRepository(Invoice) as any,
			paymentService
		);

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(tenant.user.id);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('funds an ACCEPTED application, records a real payment, and recalculates the invoice balance', async () => {
		await seedInvoice();
		const application = await seedAcceptedApplication(2000);

		const result = await service.fund(application.id);

		// The application is FUNDED with the server-computed balance and the invoice linked.
		expect(result.status).toBe(FinancingApplicationStatusEnum.FUNDED);
		expect(result.fundedAmount).toBe(1500);
		expect(result.invoiceId).toBe(INVOICE_ID);

		// A real payment row was persisted for the funding amount against the invoice.
		const payments = await dataSource.getRepository(Payment).find({ where: { invoiceId: INVOICE_ID } });
		expect(payments).toHaveLength(1);
		expect(Number(payments[0].amount)).toBe(1500);
		expect(payments[0].paymentMethod).toBe(PaymentMethodEnum.BANK_TRANSFER);

		// The invoice's financial state was recomputed from the real payment rows: fully paid.
		const invoice = await dataSource.getRepository(Invoice).findOneByOrFail({ id: INVOICE_ID });
		expect(Number(invoice.alreadyPaid)).toBe(1500);
		expect(Number(invoice.amountDue)).toBe(0);
		expect(invoice.status).toBe(InvoiceStatusTypesEnum.FULLY_PAID);

		// The persisted application row (re-read from the real DB, not the returned object) carries
		// the funded state: FUNDED, the settled amount, the linked invoice, and a cleared sentinel.
		const stored = await dataSource
			.getRepository(FinancingApplication)
			.findOneByOrFail({ id: application.id });
		expect(stored.status).toBe(FinancingApplicationStatusEnum.FUNDED);
		expect(Number(stored.fundedAmount)).toBe(1500);
		expect(stored.invoiceId).toBe(INVOICE_ID);
		expect(stored.activeKey).toBeNull();
	});

	it('funds only the remaining balance after a prior partial customer payment', async () => {
		// A real customer payment of 600 against the 1500 invoice, recorded through the real engine.
		await seedInvoice();
		const paymentService = (service as any).paymentService as PaymentService;
		await paymentService.create({
			amount: 600,
			currency: 'USD',
			invoiceId: INVOICE_ID,
			paymentDate: new Date(),
			paymentMethod: PaymentMethodEnum.CASH
		} as any);
		// The invoice now reflects the partial payment before funding.
		let invoice = await dataSource.getRepository(Invoice).findOneByOrFail({ id: INVOICE_ID });
		expect(Number(invoice.amountDue)).toBe(900);
		expect(invoice.status).toBe(InvoiceStatusTypesEnum.PARTIALLY_PAID);

		const application = await seedAcceptedApplication(2000);
		const result = await service.fund(application.id);

		// Funding covers exactly the remaining 900, not the original 1500.
		expect(result.fundedAmount).toBe(900);
		invoice = await dataSource.getRepository(Invoice).findOneByOrFail({ id: INVOICE_ID });
		expect(Number(invoice.amountDue)).toBe(0);
		expect(invoice.status).toBe(InvoiceStatusTypesEnum.FULLY_PAID);
		expect(await dataSource.getRepository(Payment).count({ where: { invoiceId: INVOICE_ID } })).toBe(2);
	});

	it('rejects a second funding of the same application (atomic claim fails closed)', async () => {
		await seedInvoice();
		const application = await seedAcceptedApplication(2000);

		await service.fund(application.id);
		// The row is now FUNDED; the atomic claim's `status: ACCEPTED` predicate matches zero rows.
		await expect(service.fund(application.id)).rejects.toBeInstanceOf(ConflictException);
		// Exactly one payment exists — no duplicate funding payment was recorded.
		expect(await dataSource.getRepository(Payment).count({ where: { invoiceId: INVOICE_ID } })).toBe(1);
	});

	it('rejects funding when the approved offer cannot cover the remaining balance', async () => {
		await seedInvoice(); // amountDue 1500
		const application = await seedAcceptedApplication(500); // approved only 500

		await expect(service.fund(application.id)).rejects.toThrow(/does not cover/i);
		// No payment was recorded and the application is untouched.
		expect(await dataSource.getRepository(Payment).count({ where: { invoiceId: INVOICE_ID } })).toBe(0);
		const stored = await dataSource
			.getRepository(FinancingApplication)
			.findOneByOrFail({ id: application.id });
		expect(stored.status).toBe(FinancingApplicationStatusEnum.ACCEPTED);
	});
});
