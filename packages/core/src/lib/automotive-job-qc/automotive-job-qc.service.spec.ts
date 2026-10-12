import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AutomotiveJobLaborStatusEnum, AutomotiveJobQcStatusEnum, AutomotiveJobStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../core/utils';
import { AutomotiveJobQcService } from './automotive-job-qc.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const job = { id: 'job-1', ...scope, status: AutomotiveJobStatusEnum.IN_PROGRESS };
const employee = { id: 'employee-1', ...scope };

describe('AutomotiveJobQcService', () => {
	let service: AutomotiveJobQcService;
	let qc: any;
	let jobs: any;
	let labors: any;
	let timeLogs: any;
	let employees: any;
	let repairOrderService: any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(scope.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(scope.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employee.id);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(TenantAwareCrudService.prototype as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
		qc = {
			create: jest.fn(async (value) => ({ ...value, id: `qc-${Date.now()}` })),
			find: jest.fn(async () => []),
			findOne: jest.fn(async () => null),
			save: jest.fn(async (value) => value)
		};
		jobs = { findOneBy: jest.fn(async () => ({ ...job })), update: jest.fn(async () => ({ affected: 1 })) };
		labors = { find: jest.fn(async () => []) };
		timeLogs = { findOne: jest.fn(async () => null) };
		employees = { findOneBy: jest.fn(async () => ({ ...employee })) };
		repairOrderService = { markRework: jest.fn(async () => undefined) };
		service = new AutomotiveJobQcService(
			qc as never,
			{} as never,
			jobs as never,
			labors as never,
			timeLogs as never,
			employees as never,
			repairOrderService as never
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a pending attempt and preserves attempt history', async () => {
		const attempt = await service.createAttempt(job.id, { notes: 'Ready for QC' });
		expect(attempt).toMatchObject({ ...scope, automotiveJobId: job.id, status: AutomotiveJobQcStatusEnum.PENDING });
		expect(qc.create).toHaveBeenCalledWith(expect.objectContaining({ status: AutomotiveJobQcStatusEnum.PENDING }));
	});

	it('rejects a second pending attempt', async () => {
		qc.findOne.mockResolvedValueOnce({ status: AutomotiveJobQcStatusEnum.PENDING });
		await expect(service.createAttempt(job.id, {})).rejects.toBeInstanceOf(ConflictException);
	});

	it('passes and fails only pending attempts with an authenticated employee', async () => {
		qc.findOne.mockResolvedValueOnce({
			id: 'qc-1',
			...scope,
			automotiveJobId: job.id,
			status: AutomotiveJobQcStatusEnum.PENDING
		});
		await expect(service.passAttempt('qc-1')).resolves.toMatchObject({
			status: AutomotiveJobQcStatusEnum.PASSED,
			checkedByEmployeeId: employee.id
		});
		qc.findOne.mockResolvedValueOnce({
			id: 'qc-2',
			...scope,
			automotiveJobId: job.id,
			status: AutomotiveJobQcStatusEnum.PENDING
		});
		await expect(service.failAttempt('qc-2', { reason: 'Brake noise remains' })).resolves.toMatchObject({
			status: AutomotiveJobQcStatusEnum.FAILED,
			reason: 'Brake noise remains'
		});
	});

	it('requires all labor complete, no running log, and latest passed QC to complete', async () => {
		labors.find.mockResolvedValueOnce([{ id: 'labor-1', status: AutomotiveJobLaborStatusEnum.COMPLETED }]);
		timeLogs.findOne.mockResolvedValueOnce(null);
		qc.findOne.mockResolvedValueOnce({ status: AutomotiveJobQcStatusEnum.PASSED });
		await expect(service.assertCanCompleteJob(job.id)).resolves.toBeUndefined();
		labors.find.mockResolvedValueOnce([{ id: 'labor-1', status: AutomotiveJobLaborStatusEnum.OPEN }]);
		await expect(service.assertCanCompleteJob(job.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects cancelled labor, running logs, pending QC, and failed QC', async () => {
		labors.find.mockResolvedValueOnce([{ id: 'labor-1', status: AutomotiveJobLaborStatusEnum.CANCELLED }]);
		await expect(service.assertCanCompleteJob(job.id)).rejects.toBeInstanceOf(BadRequestException);
		labors.find.mockResolvedValueOnce([{ id: 'labor-1', status: AutomotiveJobLaborStatusEnum.COMPLETED }]);
		timeLogs.findOne.mockResolvedValueOnce({ id: 'log-1' });
		await expect(service.assertCanCompleteJob(job.id)).rejects.toBeInstanceOf(BadRequestException);
		labors.find.mockResolvedValueOnce([{ id: 'labor-1', status: AutomotiveJobLaborStatusEnum.COMPLETED }]);
		timeLogs.findOne.mockResolvedValueOnce(null);
		qc.findOne.mockResolvedValueOnce({ status: AutomotiveJobQcStatusEnum.PENDING });
		await expect(service.assertCanCompleteJob(job.id)).rejects.toBeInstanceOf(BadRequestException);
		qc.findOne.mockResolvedValueOnce({ status: AutomotiveJobQcStatusEnum.FAILED });
		await expect(service.assertCanCompleteJob(job.id)).rejects.toBeInstanceOf(BadRequestException);
	});
});
