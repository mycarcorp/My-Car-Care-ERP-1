import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobQcStatusEnum,
	AutomotiveJobStatusEnum,
	IAutomotiveJobQcAttempt,
	ID
} from '@gauzy/contracts';
import { In, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { Employee } from '../employee/employee.entity';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { CreateAutomotiveJobQcAttemptDTO, FailAutomotiveJobQcAttemptDTO } from './dto';
import { AutomotiveJobQcAttempt } from './automotive-job-qc-attempt.entity';
import { MikroOrmAutomotiveJobQcAttemptRepository } from './repository/mikro-orm-automotive-job-qc-attempt.repository';
import { TypeOrmAutomotiveJobQcAttemptRepository } from './repository/type-orm-automotive-job-qc-attempt.repository';

@Injectable()
export class AutomotiveJobQcService extends TenantAwareCrudService<AutomotiveJobQcAttempt> {
	constructor(
		private readonly qcRepository: TypeOrmAutomotiveJobQcAttemptRepository,
		mikroOrmRepository: MikroOrmAutomotiveJobQcAttemptRepository,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(AutomotiveJobLabor) private readonly labors: Repository<AutomotiveJobLabor>,
		@InjectRepository(TimeLog) private readonly timeLogs: Repository<TimeLog>,
		@InjectRepository(Employee) private readonly employees: Repository<Employee>,
		@Inject(forwardRef(() => RepairOrderService)) private readonly repairOrderService: RepairOrderService
	) {
		super(qcRepository, mikroOrmRepository);
	}

	async createAttempt(jobId: ID, input: CreateAutomotiveJobQcAttemptDTO): Promise<AutomotiveJobQcAttempt> {
		const scope = this.scope();
		const job = await this.findJob(jobId, scope);
		if ([AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.CANCELLED].includes(job.status)) {
			throw new BadRequestException('QC cannot be started for a completed or cancelled job.');
		}
		const latest = await this.latestAttempt(jobId, scope);
		if (latest?.status === AutomotiveJobQcStatusEnum.PENDING) {
			throw new ConflictException('A QC attempt is already pending for this job.');
		}
		return this.create({
			...scope,
			automotiveJobId: job.id,
			status: AutomotiveJobQcStatusEnum.PENDING,
			notes: input.notes?.trim() || undefined
		});
	}

	async listAttempts(jobId: ID): Promise<AutomotiveJobQcAttempt[]> {
		const scope = this.scope();
		await this.findJob(jobId, scope);
		return this.qcRepository.find({
			where: { automotiveJobId: jobId, ...scope },
			order: { createdAt: 'ASC' },
			relations: { checkedByEmployee: { user: true } }
		});
	}

	async passAttempt(id: ID): Promise<AutomotiveJobQcAttempt> {
		const scope = this.scope();
		const attempt = await this.findAttempt(id, scope);
		this.assertPending(attempt);
		const job = await this.findJob(attempt.automotiveJobId, scope);
		this.assertActiveJob(job);
		const employeeId = await this.requireEmployee(scope);
		attempt.status = AutomotiveJobQcStatusEnum.PASSED;
		attempt.checkedByEmployeeId = employeeId;
		attempt.checkedAt = new Date();
		attempt.updatedByUserId = RequestContext.currentUser()?.id;
		return this.save(attempt);
	}

	async failAttempt(id: ID, input: FailAutomotiveJobQcAttemptDTO): Promise<AutomotiveJobQcAttempt> {
		const scope = this.scope();
		const attempt = await this.findAttempt(id, scope);
		this.assertPending(attempt);
		const job = await this.findJob(attempt.automotiveJobId, scope);
		this.assertActiveJob(job);
		const employeeId = await this.requireEmployee(scope);
		attempt.status = AutomotiveJobQcStatusEnum.FAILED;
		attempt.reason = input.reason.trim();
		attempt.notes = input.notes?.trim() || attempt.notes;
		attempt.checkedByEmployeeId = employeeId;
		attempt.checkedAt = new Date();
		attempt.updatedByUserId = RequestContext.currentUser()?.id;
		if (job.status !== AutomotiveJobStatusEnum.IN_PROGRESS) {
			await this.jobs.update({ id: job.id, ...scope }, { status: AutomotiveJobStatusEnum.IN_PROGRESS });
			await this.repairOrderService.markRework(job.repairOrderId, scope);
		}
		return this.save(attempt);
	}

	async assertCanCompleteJob(jobId: ID, scope = this.scope()): Promise<void> {
		const job = await this.findJob(jobId, scope);
		if (job.status !== AutomotiveJobStatusEnum.IN_PROGRESS) {
			throw new BadRequestException('Only an in-progress job can be completed.');
		}
		const laborRows = await this.labors.find({ where: { automotiveJobId: jobId, ...scope }, select: { id: true, status: true } });
		if (laborRows.some((labor) => labor.status !== AutomotiveJobLaborStatusEnum.COMPLETED)) {
			throw new BadRequestException('All automotive job labor must be completed before the job can be completed.');
		}
		if (laborRows.length) {
			const runningLog = await this.timeLogs.findOne({
				where: { automotiveJobLaborId: In(laborRows.map((labor) => labor.id)), isRunning: true, ...scope }
			});
			if (runningLog) throw new BadRequestException('Running labor TimeLogs must be stopped before the job can be completed.');
		}
		const latest = await this.latestAttempt(jobId, scope);
		if (!latest || latest.status !== AutomotiveJobQcStatusEnum.PASSED) {
			throw new BadRequestException('A passed QC attempt is required before the job can be completed.');
		}
	}

	private async latestAttempt(jobId: ID, scope: { tenantId: ID; organizationId: ID }) {
		return this.qcRepository.findOne({ where: { automotiveJobId: jobId, ...scope }, order: { createdAt: 'DESC' } });
	}

	private async findAttempt(id: ID, scope: { tenantId: ID; organizationId: ID }) {
		const attempt = await this.qcRepository.findOne({ where: { id, ...scope } });
		if (!attempt) throw new NotFoundException('Automotive job QC attempt not found in this organization.');
		return attempt;
	}

	private async findJob(id: ID, scope: { tenantId: ID; organizationId: ID }) {
		const job = await this.jobs.findOneBy({ id, ...scope });
		if (!job) throw new NotFoundException('Automotive job not found in this organization.');
		return job;
	}

	private assertPending(attempt: AutomotiveJobQcAttempt): void {
		if (attempt.status !== AutomotiveJobQcStatusEnum.PENDING) {
			throw new BadRequestException('Only pending QC attempts can be completed.');
		}
	}

	private assertActiveJob(job: AutomotiveJob): void {
		if ([AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.CANCELLED].includes(job.status)) {
			throw new BadRequestException('QC cannot change a completed or cancelled job.');
		}
	}

	private async requireEmployee(scope: { tenantId: ID; organizationId: ID }): Promise<ID> {
		const employeeId = RequestContext.currentEmployeeId();
		if (!employeeId) throw new BadRequestException('An employee context is required for QC sign-off.');
		const employee = await this.employees.findOneBy({ id: employeeId, ...scope });
		if (!employee) throw new BadRequestException('QC sign-off employee is not in this organization.');
		return employeeId;
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}