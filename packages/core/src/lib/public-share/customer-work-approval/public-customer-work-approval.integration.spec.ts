import '../../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
	CustomerWorkApprovalRequestStatusEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	CustomerWorkApprovalChannelEnum,
	EstimateLinePriorityEnum,
	EstimateStatusEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { coreEntities } from '../../core/entities';
import { Tenant } from '../../tenant/tenant.entity';
import { Organization } from '../../organization/organization.entity';
import { OrganizationContact } from '../../organization-contact/organization-contact.entity';
import { Vehicle } from '../../vehicle/vehicle.entity';
import { User } from '../../user/user.entity';
import { Employee } from '../../employee/employee.entity';
import { EmployeeAppointment } from '../../employee-appointment/employee-appointment.entity';
import { RepairOrder } from '../../repair-order/repair-order.entity';
import { Estimate } from '../../estimate/estimate.entity';
import { EstimateLine } from '../../estimate/estimate-line.entity';
import { CustomerWorkApproval } from '../../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalRequest } from '../../customer-work-approval/customer-work-approval-request.entity';
import { signPurposeToken, TokenPurposeEnum } from '../../auth/purpose-token';
import { hashApprovalToken } from '../../customer-work-approval/customer-work-approval-request.service';
import { PublicCustomerWorkApprovalService } from './public-customer-work-approval.service';

/**
 * Real-database integration test for the public Customer Work Approval response projection.
 *
 * Verifies that `view()` and `confirmation()` return only customer-safe fields and exclude
 * internal identifiers and metadata: tenantId/organizationId, internal user ids
 * (createdByUserId/updatedByUserId/deletedByUserId), deletion metadata (deletedAt), audit flags
 * (isActive/isArchived), and unrelated linkage ids (inspectionId/diagnosticId/rootEstimateId).
 *
 * Token validation runs for real: a genuine purpose-token is signed with the test JWT secret and
 * bound to a seeded CustomerWorkApprovalRequest via its stored tokenHash. The submission service
 * is a thin stub because submission is covered elsewhere; this test isolates the read projection.
 */
describe('Public Customer Work Approval — response projection (real DB)', () => {
	let dataSource: DataSource;
	let dbPath: string;
	let tenant: ReturnType<typeof createTenantFixture>;

	const CUSTOMER_ID = 'c1b2c3d4-1000-4000-8000-0000000000c1';
	const VEHICLE_ID = 'c1b2c3d4-1000-4000-8000-0000000000v1';
	const TECHNICIAN_ID = 'c1b2c3d4-1000-4000-8000-0000000000e1';
	const APPOINTMENT_ID = 'c1b2c3d4-1000-4000-8000-000000000ap1';
	const REPAIR_ORDER_ID = 'c1b2c3d4-1000-4000-8000-0000000000ro';
	const ESTIMATE_ID = 'c1b2c3d4-1000-4000-8000-0000000000es';
	const ESTIMATE_LINE_ID = 'c1b2c3d4-1000-4000-8000-0000000000el';
	const REQUEST_ID = 'c1b2c3d4-1000-4000-8000-00000000000r';
	const APPROVAL_ID = 'c1b2c3d4-1000-4000-8000-0000000000ap';
	const APPROVAL_LINE_ID = 'c1b2c3d4-1000-4000-8000-0000000000al';
	const TOKEN_SECRET = 'raw-approval-secret-0123456789';

	beforeAll(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-cwa-projection-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			synchronize: true,
			entities: coreEntities as any,
			logging: false
		});
		await dataSource.initialize();
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const seed = async (requestStatus: CustomerWorkApprovalRequestStatusEnum) => {
		tenant = createTenantFixture();
		const t = tenant.tenantId;
		const o = tenant.organizationId;
		const scope = { tenant: { id: t } as any, organization: { id: o } as any };

		await dataSource.getRepository(Tenant).save({ id: t, name: 'Test Tenant' } as any);
		await dataSource
			.getRepository(Organization)
			.save({ id: o, name: 'Test Org', currency: 'USD', ...scope } as any);
		await dataSource
			.getRepository(OrganizationContact)
			.save(
				dataSource
					.getRepository(OrganizationContact)
					.create({ id: CUSTOMER_ID, name: 'Ada Customer', ...scope })
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
		const techUser = await dataSource
			.getRepository(User)
			.save(
				dataSource
					.getRepository(User)
					.create({ email: `${TECHNICIAN_ID}@test.local`, firstName: 'Tech' }) as any
			);
		await dataSource
			.getRepository(Employee)
			.save(
				dataSource
					.getRepository(Employee)
					.create({ id: TECHNICIAN_ID, userId: techUser.id, isActive: true, ...scope } as any)
			);
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
		await dataSource.getRepository(RepairOrder).save(
			dataSource.getRepository(RepairOrder).create({
				id: REPAIR_ORDER_ID,
				repairOrderNumber: 'RO-PROJ-0001',
				appointmentId: APPOINTMENT_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				status: RepairOrderStatusEnum.IN_PROGRESS,
				arrivedAt: new Date(),
				...scope
			} as any)
		);
		await dataSource.getRepository(Estimate).save(
			dataSource.getRepository(Estimate).create({
				id: ESTIMATE_ID,
				repairOrderId: REPAIR_ORDER_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				estimateNumber: 7,
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
				id: REQUEST_ID,
				estimateId: ESTIMATE_ID,
				estimateRootId: ESTIMATE_ID,
				estimateRevisionNumber: 1,
				repairOrderId: REPAIR_ORDER_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				tokenHash: hashApprovalToken(TOKEN_SECRET),
				expiresAt: new Date(Date.now() + 3600_000),
				status: requestStatus,
				...scope
			} as any)
		);
	};

	const buildToken = () =>
		signPurposeToken(TokenPurposeEnum.CUSTOMER_WORK_APPROVAL, {
			requestId: REQUEST_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			repairOrderId: REPAIR_ORDER_ID,
			estimateId: ESTIMATE_ID,
			estimateRootId: ESTIMATE_ID,
			estimateRevisionNumber: '1',
			secret: TOKEN_SECRET
		});

	const buildService = () =>
		new PublicCustomerWorkApprovalService(
			dataSource.getRepository(CustomerWorkApprovalRequest) as any,
			dataSource.getRepository(CustomerWorkApproval) as any,
			dataSource.getRepository(CustomerWorkApprovalLine) as any,
			dataSource.getRepository(Estimate) as any,
			dataSource.getRepository(EstimateLine) as any,
			{} as any // submissionService — not exercised by view/confirmation
		);

	it('view() returns customer-safe estimate + lines and excludes internal fields', async () => {
		await seed(CustomerWorkApprovalRequestStatusEnum.ACTIVE);
		const service = buildService();
		const result = (await service.view(REQUEST_ID, buildToken())) as any;

		// Request projection
		expect(result.request).toEqual({
			id: REQUEST_ID,
			status: CustomerWorkApprovalRequestStatusEnum.ACTIVE,
			expiresAt: expect.any(Date),
			estimateRevisionNumber: 1
		});

		// Required customer-visible estimate fields present
		expect(result.estimate).toMatchObject({
			id: ESTIMATE_ID,
			estimateNumber: 7,
			revisionNumber: 1,
			currency: 'USD',
			total: 250
		});
		// Vehicle label (year/make/model only)
		expect(result.estimate.repairOrder?.vehicle).toEqual({ year: 2021, make: 'Toyota', model: 'Camry' });

		// Internal estimate fields excluded
		for (const forbidden of [
			'tenantId',
			'organizationId',
			'createdByUserId',
			'updatedByUserId',
			'deletedByUserId',
			'deletedAt',
			'isActive',
			'isArchived',
			'inspectionId',
			'diagnosticId',
			'rootEstimateId',
			'repairOrderId',
			'customerId',
			'vehicleId',
			'status'
		]) {
			expect(result.estimate).not.toHaveProperty(forbidden);
		}

		// Required customer-visible line fields present
		expect(result.lines).toHaveLength(1);
		expect(result.lines[0]).toMatchObject({
			id: ESTIMATE_LINE_ID,
			estimateId: ESTIMATE_ID,
			lineNumber: 1,
			description: 'Replace front brake pads',
			priority: EstimateLinePriorityEnum.MUST_FIX,
			unitPrice: 250,
			lineTotal: 250
		});
		// Internal line fields excluded
		for (const forbidden of [
			'tenantId',
			'organizationId',
			'createdByUserId',
			'updatedByUserId',
			'deletedByUserId',
			'deletedAt',
			'isActive',
			'isArchived'
		]) {
			expect(result.lines[0]).not.toHaveProperty(forbidden);
		}
	});

	it('confirmation() returns customer-safe approval + lines and excludes internal fields', async () => {
		await seed(CustomerWorkApprovalRequestStatusEnum.SUBMITTED);
		// Seed the approval + approval line for the confirmation view.
		const scope = {
			tenant: { id: tenant.tenantId } as any,
			organization: { id: tenant.organizationId } as any
		};
		await dataSource.getRepository(CustomerWorkApproval).save(
			dataSource.getRepository(CustomerWorkApproval).create({
				id: APPROVAL_ID,
				approvalRequestId: REQUEST_ID,
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
				channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK,
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

		const service = buildService();
		const result = (await service.confirmation(REQUEST_ID, buildToken())) as any;

		// Required confirmation fields present
		expect(result).toMatchObject({
			id: APPROVAL_ID,
			estimateRevisionNumber: 1,
			approvedTotal: 250,
			currency: 'USD',
			submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED
		});
		expect(result.submittedAt).toBeTruthy();

		// Internal approval fields excluded (incl. evidence + snapshot hash + linkage ids)
		for (const forbidden of [
			'tenantId',
			'organizationId',
			'approvalRequestId',
			'customerId',
			'vehicleId',
			'repairOrderId',
			'estimateId',
			'estimateSnapshotHash',
			'ipHash',
			'userAgent',
			'channel',
			'createdByUserId',
			'updatedByUserId',
			'deletedByUserId',
			'deletedAt',
			'isActive',
			'isArchived'
		]) {
			expect(result).not.toHaveProperty(forbidden);
		}

		// Confirmation lines: customer-visible fields present, internal fields excluded
		expect(result.lines).toHaveLength(1);
		expect(result.lines[0]).toMatchObject({
			id: APPROVAL_LINE_ID,
			estimateLineId: ESTIMATE_LINE_ID,
			selected: true,
			lineTotal: 250
		});
		for (const forbidden of [
			'tenantId',
			'organizationId',
			'createdByUserId',
			'deletedAt',
			'isActive',
			'isArchived'
		]) {
			expect(result.lines[0]).not.toHaveProperty(forbidden);
		}
	});

	it('rejects an invalid / mismatched token (regression: validation preserved)', async () => {
		await seed(CustomerWorkApprovalRequestStatusEnum.ACTIVE);
		const service = buildService();
		// Wrong secret → hash mismatch.
		const badToken = signPurposeToken(TokenPurposeEnum.CUSTOMER_WORK_APPROVAL, {
			requestId: REQUEST_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			repairOrderId: REPAIR_ORDER_ID,
			estimateId: ESTIMATE_ID,
			estimateRootId: ESTIMATE_ID,
			estimateRevisionNumber: '1',
			secret: 'wrong-secret'
		});
		await expect(service.view(REQUEST_ID, badToken)).rejects.toThrow('Invalid approval link.');
		// Mismatched requestId in URL vs claims.
		await expect(service.view(ESTIMATE_ID, buildToken())).rejects.toThrow();
	});

	afterEach(() => jest.restoreAllMocks());
});
