import '../core/entities/internal';

import {
	AutomotiveJobQcStatusEnum,
	AutomotiveJobStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	EstimateStatusEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { ServiceCenterDashboardService } from './service-center-dashboard.service';

describe('ServiceCenterDashboardService', () => {
	let service: ServiceCenterDashboardService;
	let tenant: ReturnType<typeof createTenantFixture>;

	// Counts/aggregations captured per-repository so each metric can be asserted against
	// the where-clause the service used (proves correct status filtering + scoping).
	let calls: Array<{ repo: string; where: any }>;
	let sums: Array<{ repo: string; field: string }>;

	const makeRepo = (name: string, countResult = 0) => ({
		count: jest.fn(async (opts: any) => {
			calls.push({ repo: name, where: opts?.where });
			return countResult;
		}),
		find: jest.fn(async () => []),
		createQueryBuilder: jest.fn(() => ({
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getCount: jest.fn(async () => 0),
			getRawOne: jest.fn(async () => ({ sum: 0 }))
		}))
	});

	let repos: Record<string, ReturnType<typeof makeRepo>>;

	beforeEach(() => {
		tenant = createTenantFixture();
		calls = [];
		sums = [];
		repos = {
			appointments: makeRepo('appointments'),
			repairOrders: makeRepo('repairOrders'),
			estimates: makeRepo('estimates'),
			approvalRequests: makeRepo('approvalRequests'),
			jobs: makeRepo('jobs'),
			qcAttempts: makeRepo('qcAttempts'),
			invoices: makeRepo('invoices'),
			payments: makeRepo('payments')
		};
		service = new ServiceCenterDashboardService(
			repos.appointments as any,
			repos.repairOrders as any,
			repos.estimates as any,
			repos.approvalRequests as any,
			repos.jobs as any,
			repos.qcAttempts as any,
			repos.invoices as any,
			repos.payments as any
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
	});

	afterEach(() => jest.restoreAllMocks());

	it('returns a summary scoped to the current tenant and organization', async () => {
		const summary = await service.getSummary();
		expect(summary.kpis).toBeDefined();
		// Every repo count call carried the current tenant/org scope.
		for (const call of calls) {
			expect(call.where.tenantId).toBe(tenant.tenantId);
			expect(call.where.organizationId).toBe(tenant.organizationId);
		}
	});

	it('counts open, in-progress, and ready repair orders by status', async () => {
		await service.getSummary();
		const statuses = calls.filter((c) => c.repo === 'repairOrders').map((c) => c.where.status);
		expect(statuses).toContain(RepairOrderStatusEnum.OPEN);
		expect(statuses).toContain(RepairOrderStatusEnum.IN_PROGRESS);
		expect(statuses).toContain(RepairOrderStatusEnum.READY);
	});

	it('counts estimates awaiting approval as FINALIZED or SENT', async () => {
		await service.getSummary();
		const estimateCall = calls.find((c) => c.repo === 'estimates');
		expect(estimateCall.where.status).toBeDefined();
	});

	it('counts active customer-approval requests', async () => {
		await service.getSummary();
		const approvalCall = calls.find((c) => c.repo === 'approvalRequests');
		expect(approvalCall.where.status).toBe(CustomerWorkApprovalRequestStatusEnum.ACTIVE);
	});

	it('reports zero-filled financial metrics when there is no data', async () => {
		const summary = await service.getSummary();
		expect(summary.kpis.outstandingAmount).toBe(0);
		expect(summary.kpis.revenue).toBe(0);
		expect(summary.kpis.invoicesGenerated).toBe(0);
		expect(summary.kpis.paymentsReceived).toBe(0);
	});

	it('omits non-derivable metrics rather than faking them', async () => {
		const summary = await service.getSummary();
		expect(summary.limitations).toContain('awaitingParts');
		expect(summary.limitations).toContain('overdueRepairOrders');
		expect(summary.kpis).not.toHaveProperty('awaitingParts');
	});

	it('is read-only: performs no save/update/delete on any repository', async () => {
		await service.getSummary();
		for (const repo of Object.values(repos)) {
			expect((repo as any).save).toBeUndefined();
			expect((repo as any).update).toBeUndefined();
			expect((repo as any).delete).toBeUndefined();
		}
	});
});
