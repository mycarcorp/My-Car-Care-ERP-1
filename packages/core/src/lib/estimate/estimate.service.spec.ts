import '../core/entities/internal';
import { BadRequestException } from '@nestjs/common';
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
	beforeEach(() => {
		const tenant = createTenantFixture();
		const repository = new InMemoryTenantRepository<Estimate>(new Set(['id', 'tenantId', 'organizationId']));
		const lines = {
			create: jest.fn((value) => value),
			save: jest.fn(async (value) => (Array.isArray(value) ? value : value)),
			find: jest.fn(async () => [])
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
});
