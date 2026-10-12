import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobStatusEnum,
	ID,
	IAutomotiveJobLaborView,
	PermissionsEnum
} from '@gauzy/contracts';
import { In, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { Employee } from '../employee/employee.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { TimeLogService } from '../time-tracking/time-log/time-log.service';
import { CreateAutomotiveJobLaborDTO, UpdateAutomotiveJobLaborDTO } from './dto';
import { AutomotiveJobLabor } from './automotive-job-labor.entity';
import { MikroOrmAutomotiveJobLaborRepository } from './repository/mikro-orm-automotive-job-labor.repository';
import { TypeOrmAutomotiveJobLaborRepository } from './repository/type-orm-automotive-job-labor.repository';

@Injectable()
export class AutomotiveJobLaborService extends TenantAwareCrudService<AutomotiveJobLabor> {
	constructor(
		private readonly laborRepository: TypeOrmAutomotiveJobLaborRepository,
		mikroOrmRepository: MikroOrmAutomotiveJobLaborRepository,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(Employee) private readonly employees: Repository<Employee>,
		@InjectRepository(EstimateLine) private readonly estimateLines: Repository<EstimateLine>,
		@InjectRepository(CustomerWorkApprovalLine)
		private readonly approvalLines: Repository<CustomerWorkApprovalLine>,
		@InjectRepository(TimeLog) private readonly timeLogs: Repository<TimeLog>,
		private readonly timeLogService: TimeLogService
	) {
		super(laborRepository, mikroOrmRepository);
	}

	async createInitialForJob(
		job: AutomotiveJob,
		approvalLine: CustomerWorkApprovalLine,
		estimateLine: EstimateLine,
		assignedEmployeeIds: ID[],
		billedHours?: number
	): Promise<AutomotiveJobLabor> {
		const scope = this.scope();
		const persistedJob = await this.findJob(job.id, scope);
		if (
			approvalLine.id !== persistedJob.customerWorkApprovalLineId ||
			estimateLine.id !== persistedJob.estimateLineId
		) {
			throw new BadRequestException('Labor source lines must match the automotive job.');
		}
		const sourceLine = await this.validateSourceLines(persistedJob, scope);
		const assignedEmployees = assignedEmployeeIds.length
			? await this.findAssignableEmployees(assignedEmployeeIds, scope)
			: [];
		return this.create({
			...scope,
			automotiveJobId: persistedJob.id,
			estimateLineId: persistedJob.estimateLineId,
			customerWorkApprovalLineId: persistedJob.customerWorkApprovalLineId,
			description: sourceLine.description,
			assignedEmployees,
			billedHours,
			status: AutomotiveJobLaborStatusEnum.OPEN
		});
	}

	async listForJob(jobId: ID): Promise<IAutomotiveJobLaborView[]> {
		const scope = this.scope();
		await this.findJob(jobId, scope);
		const where: Record<string, unknown> = { automotiveJobId: jobId, ...scope };
		const labors = await this.laborRepository.find({
			where,
			relations: { assignedEmployees: { user: true } },
			order: { createdAt: 'ASC' }
		});
		const employeeId = RequestContext.currentEmployeeId();
		const canViewAll = this.canViewAllEmployees();
		const visibleLabors = canViewAll
			? labors
			: employeeId
				? labors.filter((labor) => labor.assignedEmployees?.some((employee) => employee.id === employeeId))
				: [];
		if (!visibleLabors.length) return [];
		const logs = await this.timeLogs.find({
			where: { automotiveJobLaborId: In(visibleLabors.map((labor) => labor.id)), ...scope }
		});
		const now = Date.now();
		return visibleLabors.map((labor) => {
			const laborLogs = logs.filter((log) => log.automotiveJobLaborId === labor.id);
			const activeLogs = laborLogs.filter((log) => log.isRunning);
			return {
				...labor,
				assignedEmployeeIds: (labor.assignedEmployees ?? []).map((employee) => employee.id),
				actualSeconds: laborLogs.reduce((total, log) => {
					const start = new Date(log.startedAt).getTime();
					const end = log.isRunning ? now : new Date(log.stoppedAt ?? log.startedAt).getTime();
					return total + Math.max(0, Math.floor((end - start) / 1000));
				}, 0),
				activeEmployeeIds: activeLogs.map((log) => log.employeeId),
				activeTimeLogIds: activeLogs.map((log) => log.id)
			};
		});
	}

	async createLabor(jobId: ID, input: CreateAutomotiveJobLaborDTO): Promise<AutomotiveJobLabor> {
		const scope = this.scope();
		const job = await this.findJob(jobId, scope);
		if (job.status === AutomotiveJobStatusEnum.COMPLETED || job.status === AutomotiveJobStatusEnum.CANCELLED) {
			throw new BadRequestException('Labor cannot be added to a completed or cancelled job.');
		}
		await this.validateSourceLines(job, scope);
		const initialEmployeeIds = input.assignedEmployeeIds?.length
			? input.assignedEmployeeIds
			: job.assignedEmployeeId
				? [job.assignedEmployeeId]
				: [];
		const assignedEmployees = initialEmployeeIds.length
			? await this.findAssignableEmployees(initialEmployeeIds, scope)
			: [];
		return this.create({
			...scope,
			automotiveJobId: job.id,
			estimateLineId: job.estimateLineId,
			customerWorkApprovalLineId: job.customerWorkApprovalLineId,
			description: input.description.trim(),
			assignedEmployees,
			billedHours: input.billedHours,
			status: AutomotiveJobLaborStatusEnum.OPEN
		});
	}

	async updateLabor(id: ID, input: UpdateAutomotiveJobLaborDTO): Promise<AutomotiveJobLabor> {
		const scope = this.scope();
		const labor = await this.findLabor(id, scope);
		if ([AutomotiveJobLaborStatusEnum.COMPLETED, AutomotiveJobLaborStatusEnum.CANCELLED].includes(labor.status)) {
			throw new BadRequestException('Completed or cancelled labor is locked.');
		}
		if (input.assignedEmployeeIds !== undefined) {
			const activeLog = await this.timeLogs.findOneBy({
				automotiveJobLaborId: id,
				isRunning: true,
				...scope
			});
			if (activeLog) throw new ConflictException('Stop the active labor clock before changing its technician.');
			labor.assignedEmployees = input.assignedEmployeeIds.length
				? await this.findAssignableEmployees(input.assignedEmployeeIds, scope)
				: [];
		}
		if (input.description !== undefined) labor.description = input.description.trim();
		if (input.billedHours !== undefined) labor.billedHours = input.billedHours;
		labor.updatedByUserId = RequestContext.currentUser()?.id;
		return this.save(labor);
	}

	async markInProgress(id: ID): Promise<AutomotiveJobLabor> {
		const scope = this.scope();
		const labor = await this.findLabor(id, scope);
		if (
			labor.status === AutomotiveJobLaborStatusEnum.COMPLETED ||
			labor.status === AutomotiveJobLaborStatusEnum.CANCELLED
		) {
			throw new BadRequestException('Completed or cancelled labor cannot be started.');
		}
		labor.status = AutomotiveJobLaborStatusEnum.IN_PROGRESS;
		return this.save(labor);
	}

	async assignDefaultTechnician(jobId: ID, employeeId: ID): Promise<void> {
		const scope = this.scope();
		await this.findJob(jobId, scope);
		const employee = await this.findAssignableEmployees([employeeId], scope).then(([item]) => item);
		const jobLabors = await this.laborRepository.find({
			where: { automotiveJobId: jobId, ...scope },
			relations: { assignedEmployees: true }
		});
		for (const labor of jobLabors) {
			if (labor.assignedEmployees?.length) continue;
			const activeLog = await this.timeLogs.findOneBy({
				automotiveJobLaborId: labor.id,
				isRunning: true,
				...scope
			});
			if (activeLog) continue;
			labor.assignedEmployees = [employee];
			await this.save(labor);
		}
	}

	async complete(id: ID): Promise<AutomotiveJobLabor> {
		const scope = this.scope();
		const labor = await this.findLabor(id, scope);
		const employeeId = RequestContext.currentEmployeeId();
		if (
			employeeId &&
			!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
			!RequestContext.hasPermission(PermissionsEnum.ALL_ORG_EDIT)
		) {
			if (!labor.assignedEmployees?.some((employee) => employee.id === employeeId)) {
				throw new BadRequestException('Only the assigned technician can complete this labor.');
			}
		}
		if (labor.status === AutomotiveJobLaborStatusEnum.CANCELLED) {
			throw new BadRequestException('Cancelled labor cannot be completed.');
		}
		if (labor.status !== AutomotiveJobLaborStatusEnum.COMPLETED) {
			await this.timeLogService.stopRunningAutomotiveJobLaborLogs(id);
			labor.status = AutomotiveJobLaborStatusEnum.COMPLETED;
			labor.completedAt = new Date();
			labor.updatedByUserId = RequestContext.currentUser()?.id;
			await this.save(labor);
		}
		return labor;
	}

	async findLabor(id: ID, scope = this.scope()): Promise<AutomotiveJobLabor> {
		const labor = await this.laborRepository.findOne({
			where: { id, ...scope },
			relations: { assignedEmployees: true }
		});
		if (!labor) throw new NotFoundException('Automotive job labor not found in this organization.');
		return labor;
	}

	async findJob(id: ID, scope = this.scope()): Promise<AutomotiveJob> {
		const job = await this.jobs.findOneBy({ id, ...scope });
		if (!job) throw new NotFoundException('Automotive job not found in this organization.');
		return job;
	}

	private async validateSourceLines(
		job: AutomotiveJob,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<CustomerWorkApprovalLine> {
		const [estimateLine, approvalLine] = await Promise.all([
			this.estimateLines.findOneBy({ id: job.estimateLineId, estimateId: job.estimateId, ...scope }),
			this.approvalLines.findOneBy({
				id: job.customerWorkApprovalLineId,
				customerWorkApprovalId: job.customerWorkApprovalId,
				estimateLineId: job.estimateLineId,
				...scope
			})
		]);
		if (!estimateLine || !approvalLine) {
			throw new BadRequestException('Labor source lines do not match the job or its tenant and organization.');
		}
		return approvalLine;
	}

	private async findAssignableEmployees(ids: ID[], scope: { tenantId: ID; organizationId: ID }): Promise<Employee[]> {
		const uniqueIds = [...new Set(ids)];
		const employees = await this.employees.find({ where: { id: In(uniqueIds), ...scope } });
		if (employees.length !== uniqueIds.length)
			throw new NotFoundException('Employee not found in this organization.');
		if (employees.some((employee) => employee.isActive === false || employee.isArchived)) {
			throw new BadRequestException('Only active employees can be assigned to automotive job labor.');
		}
		return employees;
	}

	private canViewAllEmployees(): boolean {
		return (
			RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ||
			RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)
		);
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
