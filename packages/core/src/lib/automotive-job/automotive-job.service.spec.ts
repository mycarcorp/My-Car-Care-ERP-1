import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
	AutomotiveJobStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	CustomerWorkApprovalSubmissionStateEnum
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { AutomotiveJobService } from './automotive-job.service';
import { TimeLogService } from '../time-tracking/time-log/time-log.service';
import { TimeLogCreateCommand } from '../time-tracking/time-log/commands/time-log-create.command';

const fixture = createTenantFixture();
const scope = { tenantId: fixture.tenantId, organizationId: fixture.organizationId };
const repairOrder = { id: 'ro-1', ...scope, customerId: 'customer-1', vehicleId: 'vehicle-1' };
const approvalRequest = {
	id: 'request-1',
	...scope,
	status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED,
	repairOrderId: repairOrder.id,
	customerId: repairOrder.customerId,
	vehicleId: repairOrder.vehicleId,
	estimateId: 'estimate-1',
	estimateRootId: 'root-1',
	estimateRevisionNumber: 3
};
const approval = {
	id: 'approval-1',
	...scope,
	approvalRequestId: approvalRequest.id,
	repairOrderId: repairOrder.id,
	customerId: repairOrder.customerId,
	vehicleId: repairOrder.vehicleId,
	estimateId: approvalRequest.estimateId,
	estimateRevisionNumber: approvalRequest.estimateRevisionNumber,
	submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED
};
const approvalLine = {
	id: 'approval-line-1',
	...scope,
	customerWorkApprovalId: approval.id,
	estimateLineId: 'estimate-line-1',
	selected: true,
	approvedQuantity: 1,
	description: 'Brake work',
	reason: 'Customer concern'
};
const estimate = {
	id: approvalRequest.estimateId,
	...scope,
	repairOrderId: repairOrder.id,
	customerId: repairOrder.customerId,
	vehicleId: repairOrder.vehicleId,
	rootEstimateId: approvalRequest.estimateRootId,
	revisionNumber: approvalRequest.estimateRevisionNumber
};
const estimateLine = { id: approvalLine.estimateLineId, estimateId: estimate.id, ...scope };
const employee = { id: 'employee-1', ...scope, isActive: true, isArchived: false };

describe('AutomotiveJobService', () => {
	let service: AutomotiveJobService;
	let jobs: any;
	let repairOrders: any;
	let approvalLines: any;
	let approvals: any;
	let requests: any;
	let estimates: any;
	let estimateLines: any;
	let employees: any;
	let categories: any;
	let jobLabor: any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(fixture.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(fixture.organizationId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...fixture.user,
			lastOrganizationId: fixture.organizationId
		} as never);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(TenantAwareCrudService.prototype as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);

		jobs = {
			metadata: { hasColumnWithPropertyPath: () => false },
			create: jest.fn((value) => ({ ...value, id: 'job-1' })),
			save: jest.fn(async (value) => value),
			findOneBy: jest.fn(async () => null),
			findOneByOrFail: jest.fn(async () => ({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.OPEN,
				assignedEmployeeId: undefined
			})),
			findOneOrFail: jest.fn(async ({ where }) => jobs.findOneByOrFail(where)),
			find: jest.fn(async () => []),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		repairOrders = { findOneByOrFail: jest.fn(async () => ({ ...repairOrder })) };
		approvalLines = { findOneByOrFail: jest.fn(async () => ({ ...approvalLine })) };
		approvals = { findOneByOrFail: jest.fn(async () => ({ ...approval })) };
		requests = { findOneByOrFail: jest.fn(async () => ({ ...approvalRequest })) };
		estimates = { findOneByOrFail: jest.fn(async () => ({ ...estimate })) };
		estimateLines = { findOneByOrFail: jest.fn(async () => ({ ...estimateLine })) };
		employees = { findOneByOrFail: jest.fn(async () => ({ ...employee })) };
		categories = {
			findOneByOrFail: jest.fn(async () => ({ id: 'category-1', ...scope, name: 'Brakes', isActive: true }))
		};
		jobLabor = {
			createInitialForJob: jest.fn(async () => ({ id: 'labor-1' })),
			assignDefaultTechnician: jest.fn(async () => undefined)
		};
		service = new AutomotiveJobService(
			jobs as never,
			{} as never,
			repairOrders as never,
			approvalLines as never,
			approvals as never,
			requests as never,
			estimates as never,
			estimateLines as never,
			employees as never,
			categories as never,
			jobLabor as never
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a job attached to the RO using a selected submitted approval snapshot', async () => {
		const result = await service.createForRepairOrder(repairOrder.id, {
			customerWorkApprovalLineId: approvalLine.id,
			estimatedHours: 1.5
		});
		expect(result).toMatchObject({
			id: 'job-1',
			repairOrderId: repairOrder.id,
			estimateId: estimate.id,
			estimateRevisionNumber: 3,
			estimateLineId: estimateLine.id,
			customerWorkApprovalId: approval.id,
			customerWorkApprovalLineId: approvalLine.id,
			title: approvalLine.description,
			description: approvalLine.reason,
			status: AutomotiveJobStatusEnum.OPEN,
			categoryId: undefined,
			estimatedHours: 1.5
		});
		expect(jobs.save).toHaveBeenCalledTimes(1);
		expect(jobLabor.createInitialForJob).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'job-1' }),
			expect.objectContaining({ id: approvalLine.id }),
			expect.objectContaining({ id: estimateLine.id }),
			[],
			1.5
		);
	});

	it('creates a job with an active category in the current tenant and organization', async () => {
		const result = await service.createForRepairOrder(repairOrder.id, {
			customerWorkApprovalLineId: approvalLine.id,
			categoryId: 'category-1'
		});
		expect(categories.findOneByOrFail).toHaveBeenCalledWith({ id: 'category-1', ...scope });
		expect(result.categoryId).toBe('category-1');
	});

	it('rejects inactive categories and categories outside the current scope', async () => {
		categories.findOneByOrFail.mockResolvedValueOnce({ id: 'category-1', ...scope, isActive: false });
		await expect(
			service.createForRepairOrder(repairOrder.id, {
				customerWorkApprovalLineId: approvalLine.id,
				categoryId: 'category-1'
			})
		).rejects.toBeInstanceOf(BadRequestException);
		categories.findOneByOrFail.mockRejectedValueOnce(new Error('category not found in organization'));
		await expect(
			service.createForRepairOrder(repairOrder.id, {
				customerWorkApprovalLineId: approvalLine.id,
				categoryId: 'foreign-category'
			})
		).rejects.toThrow('category not found in organization');
		expect(jobs.save).not.toHaveBeenCalled();
	});

	it('updates an optional category and retrieves it with the job', async () => {
		jobs.findOneOrFail = jest.fn(async () => ({
			id: 'job-1',
			...scope,
			status: AutomotiveJobStatusEnum.OPEN,
			category: { id: 'category-1', name: 'Brakes' }
		}));
		await service.updateJob('job-1', { categoryId: 'category-1' });
		expect(jobs.update).toHaveBeenCalledWith({ id: 'job-1', ...scope }, { categoryId: 'category-1' });
		await expect(service.findOneScoped('job-1')).resolves.toMatchObject({
			category: { id: 'category-1', name: 'Brakes' }
		});
		expect(jobs.findOneOrFail).toHaveBeenCalledWith({
			where: { id: 'job-1', ...scope },
			relations: { category: true }
		});
	});

	it('creates an assigned job for a valid same-scope active employee', async () => {
		const result = await service.createForRepairOrder(repairOrder.id, {
			customerWorkApprovalLineId: approvalLine.id,
			assignedEmployeeId: employee.id
		});
		expect(result).toMatchObject({ assignedEmployeeId: employee.id, status: AutomotiveJobStatusEnum.ASSIGNED });
	});

	it('rejects an unselected approval line', async () => {
		approvalLines.findOneByOrFail.mockRejectedValueOnce(new Error('approval line not found with selected=true'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('approval line not found with selected=true');
		expect(jobs.save).not.toHaveBeenCalled();
	});

	it('rejects zero or negative authorized quantity', async () => {
		approvalLines.findOneByOrFail.mockResolvedValueOnce({ ...approvalLine, approvedQuantity: 0 });
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects approval evidence unless the approval is submitted', async () => {
		approvals.findOneByOrFail.mockRejectedValueOnce(new Error('not submitted'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('not submitted');
	});

	it('rejects a cross-tenant repair order before authorization lookup', async () => {
		repairOrders.findOneByOrFail.mockRejectedValueOnce(new Error('RO not found in tenant'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('RO not found in tenant');
		expect(approvalLines.findOneByOrFail).not.toHaveBeenCalled();
	});

	it('rejects cross-organization repair-order scope before authorization lookup', async () => {
		repairOrders.findOneByOrFail.mockRejectedValueOnce(new Error('RO not found in organization'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('RO not found in organization');
		expect(approvalLines.findOneByOrFail).not.toHaveBeenCalled();
	});

	it('rejects approval, request, estimate or line provenance that does not match the RO', async () => {
		requests.findOneByOrFail.mockResolvedValueOnce({ ...approvalRequest, vehicleId: 'other-vehicle' });
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toBeInstanceOf(BadRequestException);
		estimates.findOneByOrFail.mockResolvedValueOnce({ ...estimate, revisionNumber: 2 });
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toBeInstanceOf(BadRequestException);
		estimateLines.findOneByOrFail.mockRejectedValueOnce(new Error('line does not belong to estimate'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('line does not belong to estimate');
	});

	it('rejects cross-tenant and cross-organization approval records', async () => {
		approvalLines.findOneByOrFail.mockRejectedValueOnce(new Error('approval line not found in tenant'));
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('approval line not found in tenant');
		approvalLines.findOneByOrFail.mockResolvedValueOnce({ ...approvalLine });
		approvals.findOneByOrFail.mockRejectedValueOnce(
			new Error('approval does not match organization or repair order')
		);
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toThrow('approval does not match organization or repair order');
		expect(jobs.save).not.toHaveBeenCalled();
	});

	it('rejects a cross-tenant employee and an inactive employee', async () => {
		employees.findOneByOrFail.mockRejectedValueOnce(new Error('employee not found in tenant'));
		await expect(
			service.createForRepairOrder(repairOrder.id, {
				customerWorkApprovalLineId: approvalLine.id,
				assignedEmployeeId: employee.id
			})
		).rejects.toThrow('employee not found in tenant');
		employees.findOneByOrFail.mockResolvedValueOnce({ ...employee, isActive: false });
		await expect(
			service.createForRepairOrder(repairOrder.id, {
				customerWorkApprovalLineId: approvalLine.id,
				assignedEmployeeId: employee.id
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects an employee from another organization', async () => {
		employees.findOneByOrFail.mockRejectedValueOnce(new Error('employee not found in organization'));
		await expect(
			service.createForRepairOrder(repairOrder.id, {
				customerWorkApprovalLineId: approvalLine.id,
				assignedEmployeeId: employee.id
			})
		).rejects.toThrow('employee not found in organization');
		expect(jobs.save).not.toHaveBeenCalled();
	});

	it('rejects duplicate jobs for an authorized work line', async () => {
		jobs.findOneBy.mockResolvedValueOnce({ id: 'existing-job' });
		await expect(
			service.createForRepairOrder(repairOrder.id, { customerWorkApprovalLineId: approvalLine.id })
		).rejects.toBeInstanceOf(ConflictException);
		expect(jobs.save).not.toHaveBeenCalled();
	});

	it('accepts the valid OPEN to ASSIGNED to IN_PROGRESS to COMPLETED lifecycle', async () => {
		jobs.findOneByOrFail
			.mockResolvedValueOnce({ id: 'job-1', ...scope, status: AutomotiveJobStatusEnum.OPEN })
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.ASSIGNED,
				assignedEmployeeId: employee.id
			})
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.ASSIGNED,
				assignedEmployeeId: employee.id
			})
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.IN_PROGRESS,
				assignedEmployeeId: employee.id
			})
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.IN_PROGRESS,
				assignedEmployeeId: employee.id
			})
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.COMPLETED,
				assignedEmployeeId: employee.id
			});
		await service.assign('job-1', { employeeId: employee.id });
		await service.updateStatus('job-1', AutomotiveJobStatusEnum.IN_PROGRESS);
		await service.updateStatus('job-1', AutomotiveJobStatusEnum.COMPLETED);
		expect(jobs.update).toHaveBeenCalledTimes(3);
	});

	it.each([
		[AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.OPEN],
		[AutomotiveJobStatusEnum.CANCELLED, AutomotiveJobStatusEnum.IN_PROGRESS],
		[AutomotiveJobStatusEnum.OPEN, AutomotiveJobStatusEnum.COMPLETED]
	])('rejects invalid or terminal transition %s -> %s', async (from, to) => {
		jobs.findOneByOrFail.mockResolvedValueOnce({
			id: 'job-1',
			...scope,
			status: from,
			assignedEmployeeId: employee.id
		});
		await expect(service.updateStatus('job-1', to)).rejects.toBeInstanceOf(BadRequestException);
		expect(jobs.update).not.toHaveBeenCalled();
	});

	it('allows cancellation before work starts and makes cancelled jobs terminal', async () => {
		jobs.findOneByOrFail
			.mockResolvedValueOnce({ id: 'job-1', ...scope, status: AutomotiveJobStatusEnum.OPEN })
			.mockResolvedValueOnce({ id: 'job-1', ...scope, status: AutomotiveJobStatusEnum.CANCELLED });
		await service.updateStatus('job-1', AutomotiveJobStatusEnum.CANCELLED);
		jobs.findOneByOrFail.mockResolvedValueOnce({
			id: 'job-1',
			...scope,
			status: AutomotiveJobStatusEnum.CANCELLED
		});
		await expect(service.updateStatus('job-1', AutomotiveJobStatusEnum.OPEN)).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('allows cancellation from an assigned job before work starts', async () => {
		jobs.findOneByOrFail
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.ASSIGNED,
				assignedEmployeeId: employee.id
			})
			.mockResolvedValueOnce({
				id: 'job-1',
				...scope,
				status: AutomotiveJobStatusEnum.CANCELLED,
				assignedEmployeeId: employee.id
			});
		await expect(service.updateStatus('job-1', AutomotiveJobStatusEnum.CANCELLED)).resolves.toMatchObject({
			status: AutomotiveJobStatusEnum.CANCELLED
		});
	});

	it('creates a manual TimeLog linked to the assigned technician on an in-progress job', async () => {
		const employeeRecord = { ...employee, organization: { futureDateAllowed: true } };
		const timeLogRepository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: {
				findOne: jest.fn(async () => ({
					id: 'job-1',
					...scope,
					status: AutomotiveJobStatusEnum.IN_PROGRESS,
					assignedEmployeeId: employee.id
				}))
			}
		};
		const commandBus = {
			execute: jest.fn(async (command) => (command instanceof TimeLogCreateCommand ? { id: 'time-log-1' } : []))
		};
		const timeLogs = new TimeLogService(
			timeLogRepository as never,
			{} as never,
			{ findOne: jest.fn(async () => employeeRecord) } as never,
			{} as never,
			{} as never,
			commandBus as never,
			{} as never
		);
		jest.spyOn(timeLogs as any, 'allowDate').mockReturnValue(true);
		await timeLogs.addManualTime({
			employeeId: employee.id,
			automotiveJobId: 'job-1',
			startedAt: new Date('2026-01-01T09:00:00Z'),
			stoppedAt: new Date('2026-01-01T10:00:00Z'),
			organizationId: fixture.organizationId
		});
		const createCommand = commandBus.execute.mock.calls.find(
			([command]) => command instanceof TimeLogCreateCommand
		)?.[0] as TimeLogCreateCommand;
		expect(createCommand.input).toMatchObject({ automotiveJobId: 'job-1', employeeId: employee.id });
	});

	it('rejects TimeLog attribution to an unrelated technician', async () => {
		const employeeRecord = { ...employee, organization: { futureDateAllowed: true } };
		const timeLogRepository = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: {
				findOne: jest.fn(async () => ({
					id: 'job-1',
					...scope,
					status: AutomotiveJobStatusEnum.IN_PROGRESS,
					assignedEmployeeId: 'other-employee'
				}))
			}
		};
		const commandBus = { execute: jest.fn() };
		const timeLogs = new TimeLogService(
			timeLogRepository as never,
			{} as never,
			{ findOne: jest.fn(async () => employeeRecord) } as never,
			{} as never,
			{} as never,
			commandBus as never,
			{} as never
		);
		await expect(
			timeLogs.addManualTime({
				employeeId: employee.id,
				automotiveJobId: 'job-1',
				startedAt: new Date('2026-01-01T09:00:00Z'),
				stoppedAt: new Date('2026-01-01T10:00:00Z'),
				organizationId: fixture.organizationId
			})
		).rejects.toBeInstanceOf(BadRequestException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});
});
