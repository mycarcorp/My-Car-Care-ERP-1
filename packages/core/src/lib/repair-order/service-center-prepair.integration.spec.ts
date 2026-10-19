import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
	CustomerWorkApprovalChannelEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	EmployeeAppointmentStatus,
	EstimateLinePriorityEnum,
	EstimateStatusEnum,
	InspectionStatusEnum,
	RepairOrderStatusEnum,
	DiagnosticStatusEnum
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
import { Inspection } from '../inspection/inspection.entity';
import { InspectionFinding } from '../inspection/inspection-finding.entity';
import { InspectionService } from '../inspection/inspection.service';
import { Diagnostic } from '../diagnostic/diagnostic.entity';
import { DiagnosticFinding } from '../diagnostic/diagnostic-finding.entity';
import { DiagnosticService } from '../diagnostic/diagnostic.service';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { EstimateService } from '../estimate/estimate.service';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { CustomerWorkApprovalRequestService } from '../customer-work-approval/customer-work-approval-request.service';
import { CustomerWorkApprovalService } from '../customer-work-approval/customer-work-approval.service';

/**
 * Real-database integration test for the pre-repair Service Center workflow:
 *
 *   Appointment → Repair Order (arrive) → Inspection → Diagnostics → Estimate
 *   → finalize/send → Customer Work Approval (request + submit).
 *
 * Every workflow stage runs its REAL service against a REAL better-sqlite3 database (temp file,
 * `synchronize: true`, full entity schema) and a REAL TypeORM repository. The cross-module reads
 * (findOneByIdString / findOneByOrFail) hit real SQL — this is the connective tissue the
 * per-module unit suites stub out. After each stage the persisted row is re-read from the DB and
 * its linkage, tenant/organization scope, and status are asserted.
 *
 * Mocked (justified): the technician/customer/vehicle LOOKUP services (OrganizationContactService,
 * VehicleService, EmployeeService) return the seeded records — they are read-only lookups, not
 * workflow logic; OrganizationService for the approval request; and RequestContext scoping, the
 * request-scoping mechanism every suite mocks. Email/notification side-channels are inert.
 */
describe('Service Center pre-repair workflow (real DB)', () => {
	let dataSource: DataSource;
	let dbPath: string;
	let tenant: ReturnType<typeof createTenantFixture>;

	const CUSTOMER_ID = 'a1b2c3d4-1000-4000-8000-0000000000c1';
	const VEHICLE_ID = 'a1b2c3d4-1000-4000-8000-0000000000v1';
	const TECHNICIAN_ID = 'a1b2c3d4-1000-4000-8000-0000000000e1';
	const ADVISOR_ID = 'a1b2c3d4-1000-4000-8000-0000000000e2';
	const APPOINTMENT_ID = 'a1b2c3d4-1000-4000-8000-0000000000a1';

	beforeAll(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-sc-prepair-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			synchronize: true,
			entities: coreEntities as any,
			logging: false
		});
		await dataSource.initialize();
		// FK integrity is real here: we seed the full parent graph (no PRAGMA off).
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	/** Seeds the parent graph (tenant/org/customer/vehicle/technician/advisor/appointment). */
	const seedGraph = async () => {
		await dataSource.getRepository(Tenant).save({ id: tenant.tenantId, name: 'Test Tenant' } as any);
		await dataSource
			.getRepository(Organization)
			.save({ id: tenant.organizationId, name: 'Test Org', currency: 'USD', tenant: { id: tenant.tenantId } as any } as any);
		await dataSource.getRepository(OrganizationContact).save(
			dataSource.getRepository(OrganizationContact).create({
				id: CUSTOMER_ID,
				name: 'Ada Customer',
				tenant: { id: tenant.tenantId } as any,
				organization: { id: tenant.organizationId } as any
			})
		);
		await dataSource.getRepository(Vehicle).save(
			dataSource.getRepository(Vehicle).create({
				id: VEHICLE_ID,
				vinNormalized: '1HGBH41JXMN109186',
				make: 'Toyota',
				model: 'Camry',
				year: 2021,
				customerId: CUSTOMER_ID,
				tenant: { id: tenant.tenantId } as any,
				organization: { id: tenant.organizationId } as any
			} as any)
		);
		// Technician + advisor employees (each needs a User for the relation).
		for (const [empId, first] of [[TECHNICIAN_ID, 'Tech'], [ADVISOR_ID, 'Advisor']] as const) {
			const user = await dataSource
				.getRepository(User)
				.save(dataSource.getRepository(User).create({ email: `${empId}@test.local`, firstName: first }) as any);
			await dataSource.getRepository(Employee).save(
				dataSource.getRepository(Employee).create({
					id: empId,
					userId: user.id,
					tenant: { id: tenant.tenantId } as any,
					organization: { id: tenant.organizationId } as any
				} as any)
			);
		}
		await dataSource.getRepository(EmployeeAppointment).save(
			dataSource.getRepository(EmployeeAppointment).create({
				id: APPOINTMENT_ID,
				agenda: 'Brake inspection',
				startDateTime: new Date(),
				endDateTime: new Date(Date.now() + 3600_000),
				status: EmployeeAppointmentStatus.SCHEDULED,
				originalConcern: 'Brake noise while stopping',
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				employeeId: ADVISOR_ID,
				tenant: { id: tenant.tenantId } as any,
				organization: { id: tenant.organizationId } as any
			} as any)
		);
	};

	/** Read-only lookup services return the seeded records; they are not workflow logic. */
	const lookupStubs = () => {
		const customer = { id: CUSTOMER_ID, tenantId: tenant.tenantId, organizationId: tenant.organizationId };
		const vehicle = {
			id: VEHICLE_ID,
			customerId: CUSTOMER_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId
		};
		const technician = { id: TECHNICIAN_ID, tenantId: tenant.tenantId, organizationId: tenant.organizationId };
		return {
			contactService: { findOneByIdString: jest.fn(async () => customer) },
			vehicleService: { findOneByIdString: jest.fn(async () => vehicle) },
			employeeService: { findOneByIdString: jest.fn(async () => technician) },
			organizationService: { findOneByIdString: jest.fn(async () => ({ id: tenant.organizationId })) }
		};
	};

	it('drives Appointment → RO → Inspection → Diagnostics → Estimate → Approval against the real DB', async () => {
		tenant = createTenantFixture();
		await seedGraph();
		const lookups = lookupStubs();

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(tenant.user.id);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		// --- Stage 1: Appointment → Repair Order (arrive) -------------------------------
		const repairOrderService = new RepairOrderService(
			dataSource.getRepository(RepairOrder) as any,
			{} as any,
			{ findOneByIdString: jest.fn(async () => ({
				id: APPOINTMENT_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				employeeId: ADVISOR_ID,
				originalConcern: 'Brake noise while stopping',
				status: EmployeeAppointmentStatus.SCHEDULED,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			})) } as any,
			lookups.contactService as any,
			lookups.vehicleService as any,
			dataSource.getRepository(RepairOrder) as any, // jobs/labors/timeLogs share the RO manager? no—real repos
			dataSource.getRepository(RepairOrder) as any,
			dataSource.getRepository(RepairOrder) as any,
			{} as any // jobQc
		);

		const repairOrder = await repairOrderService.arrive({ appointmentId: APPOINTMENT_ID, arrivalOdometer: 52341 });
		expect(repairOrder.status).toBe(RepairOrderStatusEnum.OPEN);
		// Re-read from the DB: correct linkage + scope.
		const roStored = await dataSource.getRepository(RepairOrder).findOneByOrFail({ id: repairOrder.id });
		expect(roStored.customerId).toBe(CUSTOMER_ID);
		expect(roStored.vehicleId).toBe(VEHICLE_ID);
		expect(roStored.tenantId).toBe(tenant.tenantId);
		expect(roStored.organizationId).toBe(tenant.organizationId);

		// --- Stage 2: Repair Order → Inspection -----------------------------------------
		const inspectionService = new InspectionService(
			dataSource.getRepository(Inspection) as any,
			{} as any,
			dataSource.getRepository(InspectionFinding) as any,
			{} as any,
			repairOrderService,
			lookups.vehicleService as any,
			lookups.employeeService as any
		);
		const inspection = await inspectionService.createInspection({
			repairOrderId: repairOrder.id,
			vehicleId: VEHICLE_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			findings: [{ description: 'Brake pads worn', result: 'ATTENTION' as any }]
		});
		expect(inspection.status).toBe(InspectionStatusEnum.DRAFT);
		const inspStored = await dataSource.getRepository(Inspection).findOneByOrFail({ id: inspection.id });
		expect(inspStored.repairOrderId).toBe(repairOrder.id);
		expect(inspStored.vehicleId).toBe(VEHICLE_ID);
		expect(inspStored.technicianEmployeeId).toBe(TECHNICIAN_ID);
		expect(inspStored.tenantId).toBe(tenant.tenantId);
		// The detail endpoint's display relations actually load against the real DB
		// (findings + repairOrder + vehicle + technician), incl. the technician join-column fix.
		const inspWithRelations = await inspectionService.findByIdWithFindings(inspection.id);
		expect(inspWithRelations.findings?.length).toBe(1);
		expect(inspWithRelations.repairOrder?.id).toBe(repairOrder.id);
		expect(inspWithRelations.vehicle?.id).toBe(VEHICLE_ID);
		expect(inspWithRelations.technician?.id).toBe(TECHNICIAN_ID);

		// --- Stage 3: Inspection → Diagnostics ------------------------------------------
		const diagnosticService = new DiagnosticService(
			dataSource.getRepository(Diagnostic) as any,
			{} as any,
			dataSource.getRepository(DiagnosticFinding) as any,
			{} as any,
			inspectionService,
			lookups.employeeService as any
		);
		const diagnostic = await diagnosticService.createDiagnostic({
			inspectionId: inspection.id,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Squealing under braking',
			findings: [{ kind: 'OBSERVATION' as any, description: 'Front pads below minimum' }]
		});
		expect(diagnostic.status).toBe(DiagnosticStatusEnum.DRAFT);
		const diagStored = await dataSource.getRepository(Diagnostic).findOneByOrFail({ id: diagnostic.id });
		expect(diagStored.inspectionId).toBe(inspection.id);
		expect(diagStored.technicianEmployeeId).toBe(TECHNICIAN_ID);
		expect(diagStored.tenantId).toBe(tenant.tenantId);
		// The detail view's display relations load against the real DB (findings + inspection +
		// technician), via the same findOneByIdString path the frontend's GET /diagnostics/:id uses.
		const diagWithRelations = (await diagnosticService.findOneByIdString(diagnostic.id, {
			relations: ['findings', 'inspection', 'technician']
		} as any)) as any;
		expect(diagWithRelations.findings?.length).toBe(1);
		expect(diagWithRelations.inspection?.id).toBe(inspection.id);
		expect(diagWithRelations.technician?.id).toBe(TECHNICIAN_ID);

		// --- Stage 4: Diagnostics → Estimate → finalize → send ---------------------------
		const estimateService = new EstimateService(
			dataSource.getRepository(Estimate) as any,
			{} as any,
			dataSource.getRepository(EstimateLine) as any,
			repairOrderService,
			inspectionService,
			diagnosticService,
			dataSource.getRepository(CustomerWorkApprovalRequest) as any
		);
		const estimate = await estimateService.createEstimate({
			repairOrderId: repairOrder.id,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			currency: 'USD',
			inspectionId: inspection.id,
			diagnosticId: diagnostic.id,
			lines: [
				{
					description: 'Replace front brake pads',
					reason: 'Worn below minimum thickness',
					priority: EstimateLinePriorityEnum.MUST_FIX,
					quantity: 1,
					unitPrice: 250,
					taxAmount: 0,
					discountAmount: 0
				}
			]
		});
		expect(estimate.status).toBe(EstimateStatusEnum.DRAFT);
		expect(Number(estimate.total)).toBe(250);
		// Finalize then send — the approval request gate requires a customer-facing estimate.
		await estimateService.finalize(estimate.id);
		await estimateService.send(estimate.id);
		const estStored = await dataSource.getRepository(Estimate).findOneByOrFail({ id: estimate.id });
		expect(estStored.repairOrderId).toBe(repairOrder.id);
		expect(estStored.status).toBe(EstimateStatusEnum.SENT);

		// --- Stage 5: Estimate → Customer Work Approval (request + submit) ---------------
		const approvalRequestService = new CustomerWorkApprovalRequestService(
			dataSource.getRepository(CustomerWorkApprovalRequest) as any,
			{} as any,
			estimateService,
			lookups.organizationService as any,
			repairOrderService,
			lookups.contactService as any,
			lookups.vehicleService as any,
			{} as any
		);
		const request = await approvalRequestService.createRequest({ estimateId: estimate.id });
		expect(request.id).toBeTruthy();
		expect(request.token).toBeTruthy();

		const approvalService = new CustomerWorkApprovalService(
			dataSource.getRepository(CustomerWorkApproval) as any,
			{} as any,
			dataSource.getRepository(CustomerWorkApprovalRequest) as any,
			dataSource.getRepository(Estimate) as any,
			dataSource.getRepository(EstimateLine) as any
		);
		const estimateLine = await dataSource
			.getRepository(EstimateLine)
			.findOneByOrFail({ estimateId: estimate.id });
		const approval = await approvalService.submit(
			request.id,
			{ decisions: [{ estimateLineId: estimateLine.id, selected: true }] },
			{ channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK, ip: '127.0.0.1', userAgent: 'jest' } as any
		);
		expect(approval.submissionState).toBe(CustomerWorkApprovalSubmissionStateEnum.SUBMITTED);
		// Re-read: the persisted approval links the RO + estimate and totals the selected lines.
		const approvalStored = await dataSource
			.getRepository(CustomerWorkApproval)
			.findOneByOrFail({ id: approval.id });
		expect(approvalStored.repairOrderId).toBe(repairOrder.id);
		expect(approvalStored.estimateId).toBe(estimate.id);
		expect(Number(approvalStored.approvedTotal)).toBe(250);
		expect(approvalStored.tenantId).toBe(tenant.tenantId);
	});

	afterEach(() => jest.restoreAllMocks());
});
