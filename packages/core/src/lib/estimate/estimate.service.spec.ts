import '../core/entities/internal';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstimateLinePriorityEnum, EstimateStatusEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Estimate } from './estimate.entity';
import { EstimateService } from './estimate.service';

describe('EstimateService', () => {
	let service: EstimateService;
	let repository: InMemoryTenantRepository<Estimate>;
	let lines: {
		create: jest.Mock;
		save: jest.Mock;
		find: jest.Mock;
		findOneByOrFail: jest.Mock;
	};
	const LINE_ID = 'line-1';
	let tenant: ReturnType<typeof createTenantFixture>;

	// Seeds an estimate row directly for lifecycle/immutability tests (defaults to the
	// current tenant/organization scope so scoped reads find it).
	const seedEstimate = (overrides: Partial<Estimate> = {}): Estimate =>
		repository.seed({
			repairOrderId: 'ro',
			customerId: 'customer',
			vehicleId: 'vehicle',
			currency: 'USD',
			estimateNumber: 1,
			revisionNumber: 1,
			status: EstimateStatusEnum.DRAFT,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			...overrides
		} as Estimate);

	beforeEach(() => {
		tenant = createTenantFixture();
		repository = new InMemoryTenantRepository<Estimate>(
			new Set([
				'id',
				'tenantId',
				'organizationId',
				'status',
				'rootEstimateId',
				'revisionNumber',
				'estimateNumber'
			])
		);
		// TenantAwareCrudService.update() calls the repository's update(); provide a passthrough
		// that applies the partial so lifecycle writes reflect in the store.
		(repository as any).update = jest.fn(async (criteria: any, partial: any) => {
			const where = typeof criteria === 'object' ? criteria : { id: criteria };
			const row = (repository as any).all().find((r: any) => r.id === where.id);
			if (row) Object.assign(row, partial);
			return { affected: row ? 1 : 0, raw: [], generatedMaps: [] };
		});
		lines = {
			create: jest.fn((value) => value),
			save: jest.fn(async (value) => (Array.isArray(value) ? value : value)),
			find: jest.fn(async () => []),
			findOneByOrFail: jest.fn(async ({ id }: any) => {
				if (id !== LINE_ID) throw new Error('EntityNotFoundError');
				return { id: LINE_ID, estimateId: undefined, lineNumber: 1 };
			})
		};
		const repairOrders = {
			findOneByIdString: jest.fn(async () => ({
				id: 'ro',
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				customerId: 'customer',
				vehicleId: 'vehicle'
			}))
		};
		const inspections = { findOneByIdString: jest.fn() };
		const diagnostics = { findOneByIdString: jest.fn() };
		const approvalRequests = { update: jest.fn() };
		service = new EstimateService(
			repository as never,
			{} as never,
			lines as never,
			repairOrders as never,
			inspections as never,
			diagnostics as never,
			approvalRequests as never
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as never);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(
			TenantAwareCrudService.prototype as unknown as {
				assertNestedGraphNotForeign: (entities: unknown[], tenantId: string | null) => Promise<void>;
			},
			'assertNestedGraphNotForeign'
		).mockResolvedValue(undefined);
	});
	afterEach(() => jest.restoreAllMocks());
	it('calculates totals from MUST_FIX and RECOMMENDED lines', async () => {
		const estimate = await service.createEstimate({
			repairOrderId: 'ro',
			customerId: 'customer',
			vehicleId: 'vehicle',
			currency: 'USD',
			lines: [
				{
					description: 'Brakes',
					reason: 'Safety',
					priority: EstimateLinePriorityEnum.MUST_FIX,
					quantity: 2,
					unitPrice: 100,
					taxAmount: 10,
					discountAmount: 5
				},
				{
					description: 'Filter',
					reason: 'Maintenance',
					priority: EstimateLinePriorityEnum.RECOMMENDED,
					quantity: 1,
					unitPrice: 45,
					taxAmount: 0
				}
			]
		});
		expect(estimate).toMatchObject({
			subtotal: 245,
			taxTotal: 10,
			discountTotal: 5,
			total: 250,
			status: EstimateStatusEnum.DRAFT
		});
	});
	it('rejects a mismatched customer', async () => {
		await expect(
			service.createEstimate({
				repairOrderId: 'ro',
				customerId: 'other',
				vehicleId: 'vehicle',
				currency: 'USD',
				lines: [
					{
						description: 'x',
						reason: 'x',
						priority: EstimateLinePriorityEnum.MUST_FIX,
						quantity: 1,
						unitPrice: 1,
						taxAmount: 0
					}
				]
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	// ---- Finalize lifecycle ----
	it('finalizes a draft estimate (DRAFT → FINALIZED)', async () => {
		const existing = seedEstimate({ status: EstimateStatusEnum.DRAFT });
		const updated = await service.finalize(existing.id);
		expect(updated.status).toBe(EstimateStatusEnum.FINALIZED);
	});
	it.each([
		EstimateStatusEnum.FINALIZED,
		EstimateStatusEnum.SENT,
		EstimateStatusEnum.VIEWED,
		EstimateStatusEnum.SUPERSEDED,
		EstimateStatusEnum.EXPIRED,
		EstimateStatusEnum.CANCELLED
	])('rejects finalizing a %s estimate', async (status) => {
		const existing = seedEstimate({ status });
		await expect(service.finalize(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	// ---- Send lifecycle ----
	it('sends a finalized estimate (FINALIZED → SENT)', async () => {
		const existing = seedEstimate({ status: EstimateStatusEnum.FINALIZED });
		const updated = await service.send(existing.id);
		expect(updated.status).toBe(EstimateStatusEnum.SENT);
	});
	it.each([
		EstimateStatusEnum.DRAFT,
		EstimateStatusEnum.SENT,
		EstimateStatusEnum.VIEWED,
		EstimateStatusEnum.SUPERSEDED,
		EstimateStatusEnum.EXPIRED,
		EstimateStatusEnum.CANCELLED
	])('rejects sending a %s estimate', async (status) => {
		const existing = seedEstimate({ status });
		await expect(service.send(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	// ---- Immutability (existing DRAFT-only edit rule) ----
	it.each([EstimateStatusEnum.FINALIZED, EstimateStatusEnum.SENT])(
		'rejects updating a %s estimate',
		async (status) => {
			const existing = seedEstimate({ status });
			await expect(
				service.updateEstimate(existing.id, { status: EstimateStatusEnum.DRAFT })
			).rejects.toBeInstanceOf(BadRequestException);
		}
	);
	it.each([EstimateStatusEnum.FINALIZED, EstimateStatusEnum.SENT])(
		'rejects adding a line to a %s estimate',
		async (status) => {
			const existing = seedEstimate({ status });
			await expect(
				service.addLine(existing.id, {
					description: 'x',
					reason: 'x',
					priority: EstimateLinePriorityEnum.MUST_FIX,
					quantity: 1,
					unitPrice: 1,
					taxAmount: 0
				})
			).rejects.toBeInstanceOf(BadRequestException);
		}
	);

	// ---- Scoping ----
	it('cannot finalize an estimate from another tenant', async () => {
		const foreign = seedEstimate({
			tenantId: 'b7a1f2c4-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
			status: EstimateStatusEnum.DRAFT
		});
		await expect(service.finalize(foreign.id)).rejects.toBeInstanceOf(NotFoundException);
	});
	it('cannot send an estimate from another tenant', async () => {
		const foreign = seedEstimate({
			tenantId: 'b7a1f2c4-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
			status: EstimateStatusEnum.FINALIZED
		});
		await expect(service.send(foreign.id)).rejects.toBeInstanceOf(NotFoundException);
	});
});
