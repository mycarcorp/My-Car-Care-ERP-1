import '../core/entities/internal';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../core/utils';
import { AutomotiveJobLaborService } from './automotive-job-labor.service';

const scope = { tenantId: 'tenant-1', organizationId: 'organization-1' };
const employee = { id: 'employee-1', ...scope, isActive: true, isArchived: false };
const secondEmployee = { id: 'employee-2', ...scope, isActive: true, isArchived: false };
const job = {
	id: 'job-1',
	...scope,
	status: 'IN_PROGRESS',
	assignedEmployeeId: employee.id,
	estimateId: 'estimate-1',
	estimateLineId: 'estimate-line-1',
	customerWorkApprovalId: 'approval-1',
	customerWorkApprovalLineId: 'approval-line-1'
};

describe('AutomotiveJobLaborService', () => {
	let service: AutomotiveJobLaborService;
	let labors: any;
	let jobs: any;
	let employees: any;
	let estimateLines: any;
	let approvalLines: any;
	let timeLogs: any;
	let timeLogService: any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(scope.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(scope.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employee.id);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(TenantAwareCrudService.prototype as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
		labors = {
			create: jest.fn((input) => ({ ...input, id: 'labor-1' })),
			save: jest.fn(async (value) => value),
			find: jest.fn(async () => []),
			findOne: jest.fn(async () => ({
				id: 'labor-1',
				...scope,
				automotiveJobId: job.id,
				assignedEmployees: [employee, secondEmployee],
				status: 'OPEN'
			}))
		};
		jobs = { findOneBy: jest.fn(async () => ({ ...job })) };
		employees = { find: jest.fn(async () => [employee, secondEmployee]) };
		estimateLines = { findOneBy: jest.fn(async () => ({ id: job.estimateLineId, ...scope })) };
		approvalLines = {
			findOneBy: jest.fn(async () => ({ id: job.customerWorkApprovalLineId, description: 'Approved work', ...scope }))
		};
		timeLogs = { find: jest.fn(async () => []), findOneBy: jest.fn(async () => null) };
		timeLogService = { stopRunningAutomotiveJobLaborLogs: jest.fn(async () => undefined) };
		service = new AutomotiveJobLaborService(
			labors as never,
			{} as never,
			jobs as never,
			employees as never,
			estimateLines as never,
			approvalLines as never,
			timeLogs as never,
			timeLogService as never
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('assigns multiple technicians to a labor row in authenticated tenant and organization scope', async () => {
		await service.createLabor(job.id, {
			description: 'Additional diagnostic labor',
			assignedEmployeeIds: [employee.id, secondEmployee.id]
		});
		expect(jobs.findOneBy).toHaveBeenCalledWith({ id: job.id, ...scope });
		expect(labors.create).toHaveBeenCalledWith(
			expect.objectContaining({
				automotiveJobId: job.id,
				assignedEmployees: [employee, secondEmployee],
				...scope
			})
		);
	});

	it('rejects labor creation for a job from another organization', async () => {
		jobs.findOneBy.mockResolvedValueOnce(null);
		await expect(service.createLabor(job.id, { description: 'Labor' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('rejects initial labor creation when the supplied job is outside the current scope', async () => {
		jobs.findOneBy.mockResolvedValueOnce(null);
		await expect(
			service.createInitialForJob(job as never, { id: 'approval-1' } as never, { id: 'estimate-1' } as never, [])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(labors.create).not.toHaveBeenCalled();
	});

	it('creates initial labor using the scoped approved source line', async () => {
		employees.find.mockResolvedValueOnce([employee]);
		await service.createInitialForJob(
			job as never,
			{ id: job.customerWorkApprovalLineId, description: 'Untrusted description' } as never,
			{ id: job.estimateLineId } as never,
			[employee.id]
		);
		expect(labors.create).toHaveBeenCalledWith(
			expect.objectContaining({
				...scope,
				automotiveJobId: job.id,
				estimateLineId: job.estimateLineId,
				customerWorkApprovalLineId: job.customerWorkApprovalLineId,
				description: 'Approved work',
				assignedEmployees: [employee]
			})
		);
	});

	it('rejects source lines from a different scope or estimate lineage', async () => {
		estimateLines.findOneBy.mockResolvedValueOnce(null);
		await expect(service.createLabor(job.id, { description: 'Labor' })).rejects.toBeInstanceOf(BadRequestException);
		expect(estimateLines.findOneBy).toHaveBeenCalledWith({
			id: job.estimateLineId,
			estimateId: job.estimateId,
			...scope
		});
		approvalLines.findOneBy.mockResolvedValueOnce(null);
		await expect(service.createLabor(job.id, { description: 'Labor' })).rejects.toBeInstanceOf(BadRequestException);
		expect(approvalLines.findOneBy).toHaveBeenCalledWith({
			id: job.customerWorkApprovalLineId,
			customerWorkApprovalId: job.customerWorkApprovalId,
			estimateLineId: job.estimateLineId,
			...scope
		});
		expect(labors.create).not.toHaveBeenCalled();
	});

	it('rejects initial labor when source lines differ from the persisted job', async () => {
		await expect(
			service.createInitialForJob(job as never, { id: 'other-line' } as never, { id: job.estimateLineId } as never, [])
		).rejects.toBeInstanceOf(BadRequestException);
		expect(labors.create).not.toHaveBeenCalled();
	});

	it('rejects cross-organization or inactive technician assignment', async () => {
		employees.find.mockResolvedValueOnce([]);
		await expect(
			service.createLabor(job.id, { description: 'Labor', assignedEmployeeIds: ['foreign'] })
		).rejects.toBeInstanceOf(NotFoundException);
		employees.find.mockResolvedValueOnce([{ ...employee, isActive: false }]);
		await expect(
			service.createLabor(job.id, { description: 'Labor', assignedEmployeeIds: [employee.id] })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects an employee from another tenant on initial labor creation', async () => {
		employees.find.mockResolvedValueOnce([]);
		await expect(
			service.createInitialForJob(
				job as never,
				{ id: job.customerWorkApprovalLineId } as never,
				{ id: job.estimateLineId } as never,
				['foreign-employee']
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(employees.find).toHaveBeenCalledWith({ where: { id: expect.anything(), ...scope } });
		expect(labors.create).not.toHaveBeenCalled();
	});

	it('lists labor with actual tracked seconds and active sessions by technician', async () => {
		labors.find.mockResolvedValueOnce([
			{ id: 'labor-1', ...scope, automotiveJobId: job.id, assignedEmployees: [employee, secondEmployee] }
		]);
		timeLogs.find.mockResolvedValueOnce([
			{
				id: 'log-1',
				employeeId: employee.id,
				automotiveJobLaborId: 'labor-1',
				startedAt: new Date(0),
				stoppedAt: new Date(3600000),
				isRunning: false
			},
			{
				id: 'log-2',
				employeeId: secondEmployee.id,
				automotiveJobLaborId: 'labor-1',
				startedAt: new Date(7200000),
				stoppedAt: new Date(7200000),
				isRunning: true
			},
			{
				id: 'log-3',
				employeeId: employee.id,
				automotiveJobLaborId: 'labor-1',
				startedAt: new Date(10800000),
				stoppedAt: new Date(10800000),
				isRunning: true
			}
		]);
		const result = await service.listForJob(job.id);
		expect(result[0]).toMatchObject({
			id: 'labor-1',
			actualSeconds: expect.any(Number),
			activeTimeLogIds: ['log-2', 'log-3'],
			activeEmployeeIds: [secondEmployee.id, employee.id],
			assignedEmployeeIds: [employee.id, secondEmployee.id]
		});
		expect(result[0].actualSeconds).toBeGreaterThanOrEqual(3600);
	});

	it('filters labor to the current technician unless employee-wide access is granted', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		labors.find.mockResolvedValueOnce([
			{ id: 'labor-1', ...scope, automotiveJobId: job.id, assignedEmployees: [secondEmployee] }
		]);
		const result = await service.listForJob(job.id);
		expect(labors.find).toHaveBeenCalledWith(
			expect.objectContaining({ where: { automotiveJobId: job.id, ...scope } })
		);
		expect(service['canViewAllEmployees']()).toBe(false);
		expect(result).toEqual([]);
	});

	it('blocks technician reassignment while a labor clock is running', async () => {
		timeLogs.findOneBy.mockResolvedValueOnce({ id: 'log-1' });
		await expect(
			service.updateLabor('labor-1', { assignedEmployeeIds: [employee.id, secondEmployee.id] })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('stops active labor clocks before marking labor complete', async () => {
		const result = await service.complete('labor-1');
		expect(timeLogService.stopRunningAutomotiveJobLaborLogs).toHaveBeenCalledWith('labor-1');
		expect(labors.save).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) })
		);
		expect(result.status).toBe('COMPLETED');
	});

	it('tracks labor work-in-progress separately from the parent job status', async () => {
		jobs.findOneBy.mockResolvedValueOnce({ ...job, status: 'OPEN' });
		labors.findOne.mockResolvedValueOnce({
			id: 'labor-1',
			...scope,
			automotiveJobId: job.id,
			assignedEmployees: [employee, secondEmployee],
			status: 'OPEN'
		});
		await service.markInProgress('labor-1');
		expect(labors.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));
	});
});
