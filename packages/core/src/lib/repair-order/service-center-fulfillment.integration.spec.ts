import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobQcStatusEnum,
	AutomotiveJobStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	EstimateLinePriorityEnum,
	EstimateStatusEnum,
	InventorySourceEnum,
	InvoiceStatusTypesEnum,
	PartStockMovementTypeEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { coreEntities } from '../core/entities';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { EmployeeAppointment } from '../employee-appointment/employee-appointment.entity';
import { RepairOrder } from './repair-order.entity';
import { RepairOrderService } from './repair-order.service';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobService } from '../automotive-job/automotive-job.service';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { AutomotiveJobLaborService } from '../automotive-job-labor/automotive-job-labor.service';
import { AutomotiveJobQcAttempt } from '../automotive-job-qc/automotive-job-qc-attempt.entity';
import { AutomotiveJobQcService } from '../automotive-job-qc/automotive-job-qc.service';
import { AutomotiveJobCategory } from '../automotive-job-category/automotive-job-category.entity';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { PartStockMovement } from '../automotive-part/part-stock-movement.entity';
import { PartStockMovementService } from '../automotive-part/part-stock-movement.service';
import { Warehouse } from '../warehouse/warehouse.entity';
import { Product } from '../product/product.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { WarehouseProduct } from '../warehouse/warehouse-product.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { RepairOrderInvoiceService } from './repair-order-invoice.service';
import { Payment } from '../payment/payment.entity';
import { PaymentService } from '../payment/payment.service';

/**
 * Real-database integration test for the post-approval Service Center fulfillment chain:
 *
 *   Approved Estimate → Job Creation → Assignment → IN_PROGRESS → Labor Completion
 *   → QC Pass → Job Completion → Repair Order Readiness (READY) → Invoice Generation
 *   → Payment → Invoice Recalculation (FULLY_PAID).
 *
 * Every stage runs its REAL service against a REAL better-sqlite3 database (temp file,
 * `synchronize: true`, full entity schema, FK enforcement on) with REAL TypeORM repositories.
 * The approval provenance chain (Estimate → EstimateLine → ApprovalRequest → Approval →
 * ApprovalLine) is seeded directly because its creation is already covered by the pre-repair
 * integration test; this test isolates the fulfillment logic.
 *
 * Narrowly stubbed (justified, unrelated to the chain under test):
 *   - `TimeLogService.stopRunningAutomotiveJobLaborLogs` — the only method `labor.complete`
 *     invokes; with no clock started there are no running TimeLogs, so a no-op is faithful.
 *     Constructing the real service would pull the CQRS command bus + ManagedEmployeeService
 *     graph for a code path that never executes here.
 *   - `InvoiceService.getHighestInvoiceNumber` — the only method `RepairOrderInvoiceService`
 *     calls; the real one needs EmailService/PdfmakerService/I18nService/OrganizationService.
 *     Stubbed to `{ max: 0 }` (the sequence starts at 1).
 *   - `EmailService` (PaymentService dep) — no email is sent on the create/recalculate path.
 *   - `RequestContext` scoping — the request-scoping mechanism every suite mocks.
 */
describe('Service Center fulfillment workflow (real DB)', () => {
	let dataSource: DataSource;
	let dbPath: string;
	let tenant: ReturnType<typeof createTenantFixture>;

	const CUSTOMER_ID = 'b1b2c3d4-1000-4000-8000-0000000000c1';
	const VEHICLE_ID = 'b1b2c3d4-1000-4000-8000-0000000000v1';
	const TECHNICIAN_ID = 'b1b2c3d4-1000-4000-8000-0000000000e1';
	const REPAIR_ORDER_ID = 'b1b2c3d4-1000-4000-8000-0000000000ro';
	const APPOINTMENT_ID = 'b1b2c3d4-1000-4000-8000-000000000ap1';
	const ESTIMATE_ID = 'b1b2c3d4-1000-4000-8000-0000000000es';
	const ESTIMATE_LINE_ID = 'b1b2c3d4-1000-4000-8000-0000000000el';
	const APPROVAL_REQUEST_ID = 'b1b2c3d4-1000-4000-8000-000000000ar';
	const APPROVAL_ID = 'b1b2c3d4-1000-4000-8000-0000000000ap';
	const APPROVAL_LINE_ID = 'b1b2c3d4-1000-4000-8000-0000000000al';
	// Parts-consumption graph (warehouse → product → variant → price + warehouse balance + profile).
	const WAREHOUSE_ID = 'b1b2c3d4-1000-4000-8000-0000000000wh';
	const PRODUCT_ID = 'b1b2c3d4-1000-4000-8000-0000000000pr';
	const VARIANT_ID = 'b1b2c3d4-1000-4000-8000-0000000000pv';
	const VARIANT_PRICE_ID = 'b1b2c3d4-1000-4000-8000-0000000000vp';
	const WAREHOUSE_PRODUCT_ID = 'b1b2c3d4-1000-4000-8000-000000000wp1';
	const WAREHOUSE_VARIANT_ID = 'b1b2c3d4-1000-4000-8000-0000000000wv';
	const PART_PROFILE_ID = 'b1b2c3d4-1000-4000-8000-0000000000pp';
	const PART_UNIT_COST = 15;
	const PART_QTY = 2;

	beforeAll(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-sc-fulfillment-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			synchronize: true,
			entities: coreEntities as any,
			logging: false
		});
		await dataSource.initialize();
		// FK integrity is real here: the full parent graph is seeded (no PRAGMA off).
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	/** Seeds tenant/org/customer/vehicle/technician, an OPEN repair order, and the APPROVED provenance chain. */
	const seedGraph = async () => {
		const t = tenant.tenantId;
		const o = tenant.organizationId;
		const tenantRel = { id: t } as any;
		const orgRel = { id: o } as any;
		const scope = { tenant: tenantRel, organization: orgRel };

		await dataSource.getRepository(Tenant).save({ id: t, name: 'Test Tenant' } as any);
		await dataSource.getRepository(Organization).save({ id: o, name: 'Test Org', currency: 'USD', ...scope } as any);
		// The acting user must exist: labor/QC write `updatedByUserId = currentUser().id` (FK to user).
		await dataSource
			.getRepository(User)
			.save(dataSource.getRepository(User).create({ id: tenant.user.id, email: 'actor@test.local', firstName: 'Actor' }) as any);
		await dataSource.getRepository(OrganizationContact).save(
			dataSource.getRepository(OrganizationContact).create({ id: CUSTOMER_ID, name: 'Ada Customer', ...scope })
		);
		await dataSource.getRepository(Vehicle).save(
			dataSource.getRepository(Vehicle).create({
				id: VEHICLE_ID,
				vinNormalized: '1HGBH41JXMN109186',
				make: 'Toyota',
				model: 'Camry',
				year: 2021,
				customerId: CUSTOMER_ID,
				...scope
			} as any)
		);
		// Technician employee (needs a User for the relation); must be assignable (isActive !== false).
		const techUser = await dataSource
			.getRepository(User)
			.save(dataSource.getRepository(User).create({ email: `${TECHNICIAN_ID}@test.local`, firstName: 'Tech' }) as any);
		await dataSource.getRepository(Employee).save(
			dataSource.getRepository(Employee).create({ id: TECHNICIAN_ID, userId: techUser.id, isActive: true, ...scope } as any)
		);

		// Appointment the repair order arrived from (appointmentId is a required FK).
		await dataSource.getRepository(EmployeeAppointment).save(
			dataSource.getRepository(EmployeeAppointment).create({
				id: APPOINTMENT_ID,
				agenda: 'Brake inspection',
				startDateTime: new Date(),
				endDateTime: new Date(Date.now() + 3600_000),
				status: 'SCHEDULED',
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				employeeId: TECHNICIAN_ID,
				...scope
			} as any)
		);

		// OPEN repair order for the vehicle/customer.
		await dataSource.getRepository(RepairOrder).save(
			dataSource.getRepository(RepairOrder).create({
				id: REPAIR_ORDER_ID,
				repairOrderNumber: 'RO-FULFILL-0001',
				appointmentId: APPOINTMENT_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				status: RepairOrderStatusEnum.OPEN,
				arrivedAt: new Date(),
				...scope
			} as any)
		);

		// APPROVED provenance chain: Estimate(SENT) → EstimateLine → ApprovalRequest(SUBMITTED)
		//   → Approval(SUBMITTED) → ApprovalLine(selected, approvedQuantity=1).
		await dataSource.getRepository(Estimate).save(
			dataSource.getRepository(Estimate).create({
				id: ESTIMATE_ID,
				repairOrderId: REPAIR_ORDER_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				estimateNumber: 1,
				revisionNumber: 1,
				status: EstimateStatusEnum.SENT,
				currency: 'USD',
				subtotal: 250,
				taxTotal: 0,
				discountTotal: 0,
				total: 250,
				...scope
			} as any)
		);
		await dataSource.getRepository(EstimateLine).save(
			dataSource.getRepository(EstimateLine).create({
				id: ESTIMATE_LINE_ID,
				estimateId: ESTIMATE_ID,
				lineNumber: 1,
				description: 'Replace front brake pads',
				reason: 'Worn below minimum thickness',
				priority: EstimateLinePriorityEnum.MUST_FIX,
				quantity: 1,
				unitPrice: 250,
				taxAmount: 0,
				discountAmount: 0,
				lineTotal: 250,
				...scope
			} as any)
		);
		await dataSource.getRepository(CustomerWorkApprovalRequest).save(
			dataSource.getRepository(CustomerWorkApprovalRequest).create({
				id: APPROVAL_REQUEST_ID,
				estimateId: ESTIMATE_ID,
				estimateRootId: ESTIMATE_ID,
				estimateRevisionNumber: 1,
				repairOrderId: REPAIR_ORDER_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				tokenHash: 'a'.repeat(64),
				expiresAt: new Date(Date.now() + 3600_000),
				status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED,
				...scope
			} as any)
		);
		await dataSource.getRepository(CustomerWorkApproval).save(
			dataSource.getRepository(CustomerWorkApproval).create({
				id: APPROVAL_ID,
				approvalRequestId: APPROVAL_REQUEST_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				repairOrderId: REPAIR_ORDER_ID,
				estimateId: ESTIMATE_ID,
				estimateRevisionNumber: 1,
				submittedAt: new Date(),
				approvedTotal: 250,
				currency: 'USD',
				submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED,
				estimateSnapshotHash: 'b'.repeat(64),
				channel: 'SMS_SECURE_LINK',
				...scope
			} as any)
		);
		await dataSource.getRepository(CustomerWorkApprovalLine).save(
			dataSource.getRepository(CustomerWorkApprovalLine).create({
				id: APPROVAL_LINE_ID,
				customerWorkApprovalId: APPROVAL_ID,
				estimateLineId: ESTIMATE_LINE_ID,
				selected: true,
				approvedQuantity: 1,
				priority: EstimateLinePriorityEnum.MUST_FIX,
				description: 'Replace front brake pads',
				reason: 'Worn below minimum thickness',
				unitPrice: 250,
				taxAmount: 0,
				discountAmount: 0,
				lineTotal: 250,
				...scope
			} as any)
		);

		// Parts-consumption graph: warehouse (service-center) → product → variant → price +
		// warehouse-product + warehouse-variant balance (qty 5) + enabled part profile.
		await dataSource.getRepository(Warehouse).save(
			dataSource.getRepository(Warehouse).create({
				id: WAREHOUSE_ID,
				name: 'Service Center Warehouse',
				code: 'SCW',
				email: 'warehouse@test.local',
				inventorySource: InventorySourceEnum.SERVICE_CENTER,
				active: true,
				...scope
			} as any)
		);
		await dataSource.getRepository(Product).save(
			dataSource.getRepository(Product).create({
				id: PRODUCT_ID,
				name: 'Front Brake Pad Set',
				code: 'PAD-FRONT',
				...scope
			} as any)
		);
		await dataSource.getRepository(ProductVariant).save(
			dataSource.getRepository(ProductVariant).create({
				id: VARIANT_ID,
				product: { id: PRODUCT_ID } as any,
				...scope
			} as any)
		);
		await dataSource.getRepository(ProductVariantPrice).save(
			dataSource.getRepository(ProductVariantPrice).create({
				id: VARIANT_PRICE_ID,
				productVariant: { id: VARIANT_ID } as any,
				unitCost: PART_UNIT_COST,
				unitCostCurrency: 'USD',
				...scope
			} as any)
		);
		await dataSource.getRepository(WarehouseProduct).save(
			dataSource.getRepository(WarehouseProduct).create({
				id: WAREHOUSE_PRODUCT_ID,
				warehouse: { id: WAREHOUSE_ID } as any,
				product: { id: PRODUCT_ID } as any,
				...scope
			} as any)
		);
		await dataSource.getRepository(WarehouseProductVariant).save(
			dataSource.getRepository(WarehouseProductVariant).create({
				id: WAREHOUSE_VARIANT_ID,
				warehouseProduct: { id: WAREHOUSE_PRODUCT_ID } as any,
				variant: { id: VARIANT_ID } as any,
				quantity: 5,
				...scope
			} as any)
		);
		await dataSource.getRepository(AutomotivePartProfile).save(
			dataSource.getRepository(AutomotivePartProfile).create({
				id: PART_PROFILE_ID,
				productVariant: { id: VARIANT_ID } as any,
				normalizedPartNumber: 'PADFRONT',
				enabled: true,
				...scope
			} as any)
		);
	};

	it('drives Job → Assignment → Labor → QC → Completion → Readiness → Invoice → Payment against the real DB', async () => {
		tenant = createTenantFixture();
		await seedGraph();

		// RequestContext scoping. currentEmployeeId starts null; flipped to the technician for
		// QC sign-off (passAttempt requires an employee) and labor completion.
		const employeeIdSpy = jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(tenant.user.id);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		// --- Wire services bottom-up (real repos throughout; narrow stubs justified above) ---
		const repairOrderService = new RepairOrderService(
			dataSource.getRepository(RepairOrder) as any,
			{} as any,
			{} as any, // employeeAppointmentService (unused on this path)
			{} as any, // organizationContactService
			{} as any, // vehicleService
			dataSource.getRepository(AutomotiveJob) as any,
			dataSource.getRepository(AutomotiveJobLabor) as any,
			dataSource.getRepository(TimeLog) as any,
			{} as any // jobQc (forwardRef; not used by evaluateReadiness/markInProgressIfOpen)
		);

		const timeLogStub = { stopRunningAutomotiveJobLaborLogs: jest.fn(async () => undefined) } as any;
		const jobLaborService = new AutomotiveJobLaborService(
			dataSource.getRepository(AutomotiveJobLabor) as any,
			{} as any,
			dataSource.getRepository(AutomotiveJob) as any,
			dataSource.getRepository(Employee) as any,
			dataSource.getRepository(EstimateLine) as any,
			dataSource.getRepository(CustomerWorkApprovalLine) as any,
			dataSource.getRepository(TimeLog) as any,
			timeLogStub
		);

		const jobQcService = new AutomotiveJobQcService(
			dataSource.getRepository(AutomotiveJobQcAttempt) as any,
			{} as any,
			dataSource.getRepository(AutomotiveJob) as any,
			dataSource.getRepository(AutomotiveJobLabor) as any,
			dataSource.getRepository(TimeLog) as any,
			dataSource.getRepository(Employee) as any,
			repairOrderService
		);

		const jobService = new AutomotiveJobService(
			dataSource.getRepository(AutomotiveJob) as any,
			{} as any,
			dataSource.getRepository(RepairOrder) as any,
			dataSource.getRepository(CustomerWorkApprovalLine) as any,
			dataSource.getRepository(CustomerWorkApproval) as any,
			dataSource.getRepository(CustomerWorkApprovalRequest) as any,
			dataSource.getRepository(Estimate) as any,
			dataSource.getRepository(EstimateLine) as any,
			dataSource.getRepository(Employee) as any,
			dataSource.getRepository(AutomotiveJobCategory) as any,
			jobLaborService,
			jobQcService,
			repairOrderService
		);

		// --- Stage 1: Job creation from the approved line ------------------------------
		const job = await jobService.createForRepairOrder(REPAIR_ORDER_ID, {
			customerWorkApprovalLineId: APPROVAL_LINE_ID,
			estimatedHours: 1
		});
		expect(job.status).toBe(AutomotiveJobStatusEnum.OPEN);
		const jobStored = await dataSource.getRepository(AutomotiveJob).findOneByOrFail({ id: job.id });
		expect(jobStored.repairOrderId).toBe(REPAIR_ORDER_ID);
		expect(jobStored.estimateLineId).toBe(ESTIMATE_LINE_ID);
		expect(jobStored.customerWorkApprovalLineId).toBe(APPROVAL_LINE_ID);
		expect(jobStored.tenantId).toBe(tenant.tenantId);
		expect(jobStored.organizationId).toBe(tenant.organizationId);
		// Initial labor was auto-created for the job.
		const laborInitial = await dataSource
			.getRepository(AutomotiveJobLabor)
			.findOneByOrFail({ automotiveJobId: job.id });
		expect(laborInitial.status).toBe(AutomotiveJobLaborStatusEnum.OPEN);

		// --- Stage 2: Assignment --------------------------------------------------------
		await jobService.assign(job.id, { employeeId: TECHNICIAN_ID });
		const jobAssigned = await dataSource.getRepository(AutomotiveJob).findOneByOrFail({ id: job.id });
		expect(jobAssigned.status).toBe(AutomotiveJobStatusEnum.ASSIGNED);
		expect(jobAssigned.assignedEmployeeId).toBe(TECHNICIAN_ID);

		// --- Stage 3: IN_PROGRESS (cascades RO OPEN → IN_PROGRESS) ----------------------
		await jobService.updateStatus(job.id, AutomotiveJobStatusEnum.IN_PROGRESS);
		const roInProgress = await dataSource.getRepository(RepairOrder).findOneByOrFail({ id: REPAIR_ORDER_ID });
		expect(roInProgress.status).toBe(RepairOrderStatusEnum.IN_PROGRESS);

		// --- Stage 3b: Parts consumption (job IN_PROGRESS; deducts stock; snapshots unit cost) ---
		const partMovementService = new PartStockMovementService(
			dataSource.getRepository(PartStockMovement) as any,
			{} as any,
			dataSource.getRepository(AutomotivePartProfile) as any
		);
		const consumeInput = {
			automotivePartProfileId: PART_PROFILE_ID,
			warehouseId: WAREHOUSE_ID,
			warehouseProductVariantId: WAREHOUSE_VARIANT_ID,
			quantity: PART_QTY,
			operationKey: 'consume-op-0001'
		};
		const consumption = await partMovementService.consumeForJob(job.id, consumeInput as any);
		// Stock deducted 5 → 3; movement records before/after + the consumption-time unit cost.
		expect(consumption.type).toBe(PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT);
		expect(Number(consumption.quantityDelta)).toBe(-PART_QTY);
		expect(Number(consumption.quantityBefore)).toBe(5);
		expect(Number(consumption.quantityAfter)).toBe(3);
		expect(Number(consumption.unitCost)).toBe(PART_UNIT_COST);
		const balanceAfterConsume = await dataSource
			.getRepository(WarehouseProductVariant)
			.findOneByOrFail({ id: WAREHOUSE_VARIANT_ID });
		expect(Number(balanceAfterConsume.quantity)).toBe(3);

		// Idempotency: replaying the same operation key returns the existing movement and does
		// NOT deduct stock again.
		const replayed = await partMovementService.consumeForJob(job.id, consumeInput as any);
		expect(replayed.id).toBe(consumption.id);
		const balanceAfterReplay = await dataSource
			.getRepository(WarehouseProductVariant)
			.findOneByOrFail({ id: WAREHOUSE_VARIANT_ID });
		expect(Number(balanceAfterReplay.quantity)).toBe(3);
		const movementCount = await dataSource
			.getRepository(PartStockMovement)
			.count({ where: { operationKey: 'consume-op-0001' } });
		expect(movementCount).toBe(1);

		// Cost snapshot: change the variant's CURRENT cost after consumption; the stored movement
		// unit cost must remain the consumption-time value (invoices read the snapshot).
		await dataSource.getRepository(ProductVariantPrice).update({ id: VARIANT_PRICE_ID }, { unitCost: 99 });
		const consumptionAfterPriceChange = await dataSource
			.getRepository(PartStockMovement)
			.findOneByOrFail({ id: consumption.id });
		expect(Number(consumptionAfterPriceChange.unitCost)).toBe(PART_UNIT_COST);

		// --- Stage 4: Labor completion (technician context) ------------------------------
		employeeIdSpy.mockReturnValue(TECHNICIAN_ID);
		await jobLaborService.complete(laborInitial.id);
		const laborDone = await dataSource.getRepository(AutomotiveJobLabor).findOneByOrFail({ id: laborInitial.id });
		expect(laborDone.status).toBe(AutomotiveJobLaborStatusEnum.COMPLETED);
		expect(laborDone.completedAt).toBeTruthy();

		// --- Stage 5: QC pass ------------------------------------------------------------
		const qcAttempt = await jobQcService.createAttempt(job.id, {});
		await jobQcService.passAttempt(qcAttempt.id);
		const qcStored = await dataSource.getRepository(AutomotiveJobQcAttempt).findOneByOrFail({ id: qcAttempt.id });
		expect(qcStored.status).toBe(AutomotiveJobQcStatusEnum.PASSED);
		expect(qcStored.checkedByEmployeeId).toBe(TECHNICIAN_ID);

		// --- Stage 6: Job completion (cascades RO IN_PROGRESS → READY) -------------------
		await jobService.updateStatus(job.id, AutomotiveJobStatusEnum.COMPLETED);
		const jobDone = await dataSource.getRepository(AutomotiveJob).findOneByOrFail({ id: job.id });
		expect(jobDone.status).toBe(AutomotiveJobStatusEnum.COMPLETED);
		const roReady = await dataSource.getRepository(RepairOrder).findOneByOrFail({ id: REPAIR_ORDER_ID });
		expect(roReady.status).toBe(RepairOrderStatusEnum.READY);
		employeeIdSpy.mockReturnValue(null);

		// --- Stage 7: Invoice generation -------------------------------------------------
		const invoiceItemService = new InvoiceItemService(
			dataSource.getRepository(InvoiceItem) as any,
			{} as any
		);
		const invoiceServiceStub = { getHighestInvoiceNumber: jest.fn(async () => ({ max: 0 })) } as any;
		const roInvoiceService = new RepairOrderInvoiceService(
			dataSource.getRepository(RepairOrder) as any,
			dataSource.getRepository(AutomotiveJob) as any,
			dataSource.getRepository(AutomotiveJobLabor) as any,
			dataSource.getRepository(EstimateLine) as any,
			dataSource.getRepository(PartStockMovement) as any,
			dataSource.getRepository(AutomotivePartProfile) as any,
			invoiceServiceStub,
			invoiceItemService
		);
		const invoice = await roInvoiceService.generateForRepairOrder(REPAIR_ORDER_ID);
		const invoiceStored = await dataSource
			.getRepository(Invoice)
			.findOneOrFail({ where: { id: invoice.id }, relations: { invoiceItems: true } });
		expect(invoiceStored.repairOrderId).toBe(REPAIR_ORDER_ID);
		expect(invoiceStored.status).toBe(InvoiceStatusTypesEnum.DRAFT);
		// Total = labor (250, from the approved estimate line) + parts (2 × consumption-time
		// unitCost 15 = 30, snapshot). The later variant price change to 99 must NOT affect it.
		expect(Number(invoiceStored.totalValue)).toBe(280);
		expect(Number(invoiceStored.amountDue)).toBe(280);
		expect(Number(invoiceStored.alreadyPaid)).toBe(0);
		expect(invoiceStored.tenantId).toBe(tenant.tenantId);
		// One labor line + one parts line.
		expect(invoiceStored.invoiceItems.length).toBe(2);
		const partsLine = invoiceStored.invoiceItems.find((item: any) => Number(item.price) === PART_UNIT_COST);
		expect(partsLine).toBeTruthy();
		expect(Number(partsLine.quantity)).toBe(PART_QTY);
		expect(Number(partsLine.totalValue)).toBe(PART_QTY * PART_UNIT_COST);

		// --- Stage 8: Payment → invoice recalculation ------------------------------------
		const paymentService = new PaymentService(
			dataSource.getRepository(Payment) as any,
			{} as any,
			{} as any, // emailService (no email on this path)
			dataSource.getRepository(Invoice) as any
		);
		const payment = await paymentService.create({
			invoiceId: invoice.id,
			amount: 280,
			currency: 'USD',
			paymentDate: new Date()
		} as any);
		const paymentStored = await dataSource.getRepository(Payment).findOneByOrFail({ id: payment.id });
		expect(paymentStored.invoiceId).toBe(invoice.id);
		expect(Number(paymentStored.amount)).toBe(280);
		// Invoice reconciled to FULLY_PAID by the transactional recalculation.
		const invoicePaid = await dataSource.getRepository(Invoice).findOneByOrFail({ id: invoice.id });
		expect(Number(invoicePaid.alreadyPaid)).toBe(280);
		expect(Number(invoicePaid.amountDue)).toBe(0);
		expect(invoicePaid.paid).toBe(true);
		expect(invoicePaid.status).toBe(InvoiceStatusTypesEnum.FULLY_PAID);
	});

	afterEach(() => jest.restoreAllMocks());
});
