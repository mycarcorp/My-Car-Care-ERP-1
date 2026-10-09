import '../core/entities/internal';

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
	CustomerWorkApprovalSubmissionStateEnum,
	FinancingApplicationStatusEnum
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { FinancingApplication } from './financing-application.entity';
import { FinancingApplicationService } from './financing-application.service';

describe('FinancingApplicationService', () => {
	const RO_ID = 'ro-1';
	const ESTIMATE_ID = 'est-1';
	const APPROVAL_ID = 'approval-1';
	const CUSTOMER_ID = 'customer-1';
	const VEHICLE_ID = 'vehicle-1';
	let service: FinancingApplicationService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let repository: InMemoryTenantRepository<FinancingApplication>;
	let approvals: { findOne: jest.Mock };
	let repairOrders: { findOneByIdString: jest.Mock };
	let estimates: { findOneByIdString: jest.Mock };
	let hasPermission: jest.SpyInstance;

	const validInput = () => ({
		repairOrderId: RO_ID,
		estimateId: ESTIMATE_ID,
		customerWorkApprovalId: APPROVAL_ID,
		requestedAmount: 1200,
		currency: 'USD'
	});

	beforeEach(() => {
		tenant = createTenantFixture();
		repairOrders = {
			findOneByIdString: jest.fn(async () => ({
				id: RO_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID
			}))
		};
		estimates = {
			findOneByIdString: jest.fn(async () => ({
				id: ESTIMATE_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				repairOrderId: RO_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID
			}))
		};
		approvals = {
			findOne: jest.fn(async () => ({
				id: APPROVAL_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				repairOrderId: RO_ID,
				estimateId: ESTIMATE_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID,
				submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED
			}))
		};
		repository = new InMemoryTenantRepository<FinancingApplication>(
			new Set(['id', 'tenantId', 'organizationId', 'repairOrderId', 'status', 'activeKey'])
		);
		// update passthrough so transition/activeKey writes reflect in the store.
		(repository as any).update = jest.fn(async (criteria: any, partial: any) => {
			const where = typeof criteria === 'object' ? criteria : { id: criteria };
			const row = (repository as any).all().find((r: any) => r.id === where.id);
			if (row) Object.assign(row, partial);
			return { affected: row ? 1 : 0, raw: [], generatedMaps: [] };
		});
		service = new FinancingApplicationService(
			repository as any,
			{} as any,
			repairOrders as any,
			estimates as any,
			{} as any,
			{} as any,
			approvals as any
		);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		hasPermission = jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a DRAFT application with the full valid relationship chain', async () => {
		const app = await service.createApplication(validInput());
		expect(app).toMatchObject({
			repairOrderId: RO_ID,
			estimateId: ESTIMATE_ID,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			status: FinancingApplicationStatusEnum.DRAFT
		});
	});

	it('rejects creation without a SUBMITTED customer approval', async () => {
		approvals.findOne.mockResolvedValue(null);
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects creation when the estimate belongs to a different repair order', async () => {
		estimates.findOneByIdString.mockResolvedValue({
			id: ESTIMATE_ID,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			repairOrderId: 'other-ro',
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID
		});
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects creation when the approval belongs to another tenant', async () => {
		approvals.findOne.mockResolvedValue(null); // tenant-scoped lookup finds nothing for a foreign approval
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a second active application for the same repair order', async () => {
		await service.createApplication(validInput());
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(ConflictException);
	});

	it('allows resubmission after the prior application reaches a terminal state', async () => {
		const first = await service.createApplication(validInput());
		await service.transition(first.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await service.transition(first.id, { status: FinancingApplicationStatusEnum.CANCELLED });
		const second = await service.createApplication(validInput());
		expect(second.id).not.toBe(first.id);
	});

	it('walks the allowed lifecycle DRAFT → SUBMITTED → PENDING → APPROVED → ACCEPTED', async () => {
		hasPermission.mockReturnValue(true);
		const app = await service.createApplication(validInput());
		let current = await service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		expect(current.status).toBe(FinancingApplicationStatusEnum.SUBMITTED);
		current = await service.transition(app.id, { status: FinancingApplicationStatusEnum.PENDING });
		expect(current.status).toBe(FinancingApplicationStatusEnum.PENDING);
		current = await service.transition(app.id, { status: FinancingApplicationStatusEnum.APPROVED, approvedAmount: 1000 });
		expect(current.status).toBe(FinancingApplicationStatusEnum.APPROVED);
		expect(current.approvedAmount).toBe(1000);
		current = await service.transition(app.id, { status: FinancingApplicationStatusEnum.ACCEPTED });
		expect(current.status).toBe(FinancingApplicationStatusEnum.ACCEPTED);
	});

	it('rejects an invalid transition (DRAFT → APPROVED)', async () => {
		hasPermission.mockReturnValue(true);
		const app = await service.createApplication(validInput());
		await expect(service.transition(app.id, { status: FinancingApplicationStatusEnum.APPROVED })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('terminal CANCELLED accepts no further transitions', async () => {
		const app = await service.createApplication(validInput());
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.CANCELLED });
		await expect(service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('cannot reach FUNDED through any Phase 1 transition', async () => {
		const app = await service.createApplication(validInput());
		await expect(service.transition(app.id, { status: 'FUNDED' as any })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects editing a non-DRAFT application', async () => {
		const app = await service.createApplication(validInput());
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await expect(service.updateApplication(app.id, { requestedAmount: 500 })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('cannot read an application belonging to another tenant', async () => {
		const foreign = repository.seed({
			repairOrderId: RO_ID,
			estimateId: ESTIMATE_ID,
			customerId: CUSTOMER_ID,
			vehicleId: VEHICLE_ID,
			status: FinancingApplicationStatusEnum.DRAFT,
			tenantId: 'b7a1f2c4-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
			organizationId: tenant.organizationId
		} as any);
		await expect(service.transition(foreign.id, { status: FinancingApplicationStatusEnum.SUBMITTED })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('rejects a third application when a terminal and an active application coexist', async () => {
		const first = await service.createApplication(validInput());
		await service.transition(first.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await service.transition(first.id, { status: FinancingApplicationStatusEnum.CANCELLED }); // terminal
		const second = await service.createApplication(validInput()); // new active
		expect(second.id).not.toBe(first.id);
		// A further application must be rejected even though a terminal historical row exists.
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(ConflictException);
	});

	it('maps a unique-constraint violation on insert to ConflictException without leaking internals', async () => {
		const originalSave = repository.save.bind(repository);
		jest.spyOn(repository, 'save').mockImplementation(async (entity: any) => {
			const duplicate = repository
				.all()
				.find(
					(row: any) =>
						row.tenantId === entity.tenantId &&
						row.repairOrderId === entity.repairOrderId &&
						row.activeKey != null &&
						row.activeKey === entity.activeKey
				);
			if (duplicate) {
				const err: any = new Error('duplicate key');
				err.code = 'SQLITE_CONSTRAINT_UNIQUE';
				throw err;
			}
			return originalSave(entity);
		});
		await service.createApplication(validInput());
		// The pre-check sees an active row, but the constraint is the final enforcement; force the
		// path by clearing the store-visible active marker check via a fresh findOne that misses it.
		jest.spyOn(service['typeOrmRepository'], 'findOne').mockResolvedValue(null as any);
		await expect(service.createApplication(validInput())).rejects.toBeInstanceOf(ConflictException);
	});

	it('enforces organization isolation on transition (same tenant, different org)', async () => {
		const app = await service.createApplication(validInput());
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('a1b2c3d4-0000-4000-8000-differentorg');
		await expect(service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('enforces organization isolation on update (same tenant, different org)', async () => {
		const app = await service.createApplication(validInput());
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('a1b2c3d4-0000-4000-8000-differentorg');
		await expect(service.updateApplication(app.id, { requestedAmount: 500 })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('requires ORG_FINANCING_APPROVE for decision transitions', async () => {
		hasPermission.mockReturnValue(false); // employee without APPROVE
		const app = await service.createApplication(validInput());
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.PENDING });
		await expect(
			service.transition(app.id, { status: FinancingApplicationStatusEnum.APPROVED })
		).rejects.toBeInstanceOf(ForbiddenException);
		// But an employee with EDIT may cancel.
		const cancelled = await service.transition(app.id, { status: FinancingApplicationStatusEnum.CANCELLED });
		expect(cancelled.status).toBe(FinancingApplicationStatusEnum.CANCELLED);
	});

	it('stores the rejection reason on a DECLINED decision', async () => {
		hasPermission.mockReturnValue(true);
		const app = await service.createApplication(validInput());
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.SUBMITTED });
		await service.transition(app.id, { status: FinancingApplicationStatusEnum.PENDING });
		const declined = await service.transition(app.id, {
			status: FinancingApplicationStatusEnum.DECLINED,
			rejectionReason: 'Insufficient credit history'
		});
		expect(declined.status).toBe(FinancingApplicationStatusEnum.DECLINED);
		expect(declined.rejectionReason).toBe('Insufficient credit history');
	});
});
