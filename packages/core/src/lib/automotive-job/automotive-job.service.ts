import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
	AutomotiveJobStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	ID,
	IAutomotiveJob
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { Employee } from '../employee/employee.entity';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { AutomotiveJobCategory } from '../automotive-job-category/automotive-job-category.entity';
import { AssignAutomotiveJobDTO, CreateAutomotiveJobDTO, UpdateAutomotiveJobDTO } from './dto';
import { AutomotiveJob } from './automotive-job.entity';
import { MikroOrmAutomotiveJobRepository } from './repository/mikro-orm-automotive-job.repository';
import { TypeOrmAutomotiveJobRepository } from './repository/type-orm-automotive-job.repository';

const TRANSITIONS: Record<AutomotiveJobStatusEnum, AutomotiveJobStatusEnum[]> = {
	[AutomotiveJobStatusEnum.OPEN]: [AutomotiveJobStatusEnum.ASSIGNED, AutomotiveJobStatusEnum.CANCELLED],
	[AutomotiveJobStatusEnum.ASSIGNED]: [AutomotiveJobStatusEnum.IN_PROGRESS, AutomotiveJobStatusEnum.CANCELLED],
	[AutomotiveJobStatusEnum.IN_PROGRESS]: [AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.CANCELLED],
	[AutomotiveJobStatusEnum.COMPLETED]: [],
	[AutomotiveJobStatusEnum.CANCELLED]: []
};

@Injectable()
export class AutomotiveJobService extends TenantAwareCrudService<AutomotiveJob> {
	constructor(
		typeOrmRepository: TypeOrmAutomotiveJobRepository,
		mikroOrmRepository: MikroOrmAutomotiveJobRepository,
		@InjectRepository(RepairOrder) private readonly repairOrders: Repository<RepairOrder>,
		@InjectRepository(CustomerWorkApprovalLine)
		private readonly approvalLines: Repository<CustomerWorkApprovalLine>,
		@InjectRepository(CustomerWorkApproval) private readonly approvals: Repository<CustomerWorkApproval>,
		@InjectRepository(CustomerWorkApprovalRequest)
		private readonly requests: Repository<CustomerWorkApprovalRequest>,
		@InjectRepository(Estimate) private readonly estimates: Repository<Estimate>,
		@InjectRepository(EstimateLine) private readonly estimateLines: Repository<EstimateLine>,
		@InjectRepository(Employee) private readonly employees: Repository<Employee>,
		@InjectRepository(AutomotiveJobCategory) private readonly categories: Repository<AutomotiveJobCategory>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async createForRepairOrder(repairOrderId: ID, input: CreateAutomotiveJobDTO): Promise<AutomotiveJob> {
		const scope = this.scope();
		const repairOrder = await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });
		const provenance = await this.validateAuthorizationLine(input.customerWorkApprovalLineId, repairOrder, scope);
		const duplicate = await this.typeOrmRepository.findOneBy({
			customerWorkApprovalLineId: provenance.approvalLine.id,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});
		if (duplicate) throw new ConflictException('A job already exists for this authorized work line.');

		const assignedEmployee = input.assignedEmployeeId
			? await this.findAssignableEmployee(input.assignedEmployeeId, scope)
			: undefined;
		const category = input.categoryId ? await this.findActiveCategory(input.categoryId, scope) : undefined;
		return super.create({
			repairOrderId: repairOrder.id,
			estimateId: provenance.approval.estimateId,
			estimateRevisionNumber: provenance.approval.estimateRevisionNumber,
			estimateLineId: provenance.approvalLine.estimateLineId,
			customerWorkApprovalId: provenance.approval.id,
			customerWorkApprovalLineId: provenance.approvalLine.id,
			title: provenance.approvalLine.description,
			description: provenance.approvalLine.reason,
			internalNotes: input.internalNotes,
			assignedEmployeeId: assignedEmployee?.id,
			categoryId: category?.id,
			status: assignedEmployee ? AutomotiveJobStatusEnum.ASSIGNED : AutomotiveJobStatusEnum.OPEN,
			estimatedHours: input.estimatedHours,
			organizationId: scope.organizationId
		});
	}

	async findForRepairOrder(repairOrderId: ID): Promise<AutomotiveJob[]> {
		const scope = this.scope();
		await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });
		return this.typeOrmRepository.find({
			where: { repairOrderId, ...scope },
			relations: { category: true },
			order: { createdAt: 'ASC' }
		});
	}

	async findAuthorizedWork(repairOrderId: ID): Promise<CustomerWorkApprovalLine[]> {
		const scope = this.scope();
		await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });
		const approvals = await this.approvals.find({
			where: {
				repairOrderId,
				submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED,
				...scope
			}
		});
		if (!approvals.length) return [];
		const existingJobs = await this.typeOrmRepository.find({
			where: { repairOrderId, ...scope },
			select: { customerWorkApprovalLineId: true }
		});
		const usedLineIds = new Set(existingJobs.map((job) => job.customerWorkApprovalLineId));
		const lines = await this.approvalLines.find({
			where: {
				customerWorkApprovalId: In(approvals.map((approval) => approval.id)),
				selected: true,
				...scope
			},
			order: { createdAt: 'ASC' }
		});
		const repairOrder = await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });
		const available: CustomerWorkApprovalLine[] = [];
		for (const line of lines) {
			if (usedLineIds.has(line.id) || Number(line.approvedQuantity) <= 0) continue;
			await this.validateAuthorizationLine(line.id, repairOrder, scope);
			available.push(line);
		}
		return available;
	}

	async findOneScoped(id: ID): Promise<AutomotiveJob> {
		return this.typeOrmRepository.findOneOrFail({ where: { id, ...this.scope() }, relations: { category: true } });
	}

	async updateJob(id: ID, input: UpdateAutomotiveJobDTO): Promise<AutomotiveJob> {
		const job = await this.findOneScoped(id);
		if (![AutomotiveJobStatusEnum.OPEN, AutomotiveJobStatusEnum.ASSIGNED].includes(job.status)) {
			throw new BadRequestException('Job details are locked after work begins.');
		}
		const { categoryId, ...changes } = input;
		const category = categoryId ? await this.findActiveCategory(categoryId, this.scope()) : undefined;
		await this.typeOrmRepository.update(
			{ id, ...this.scope() },
			{
				...changes,
				...(categoryId !== undefined ? { categoryId: category?.id ?? null } : {})
			}
		);
		return this.findOneScoped(id);
	}

	async assign(id: ID, input: AssignAutomotiveJobDTO): Promise<AutomotiveJob> {
		const job = await this.findOneScoped(id);
		if (![AutomotiveJobStatusEnum.OPEN, AutomotiveJobStatusEnum.ASSIGNED].includes(job.status)) {
			throw new BadRequestException('Technician assignment is locked after work begins.');
		}
		const employee = await this.findAssignableEmployee(input.employeeId, this.scope());
		await this.typeOrmRepository.update(
			{ id, ...this.scope() },
			{
				assignedEmployeeId: employee.id,
				status: AutomotiveJobStatusEnum.ASSIGNED
			}
		);
		return this.findOneScoped(id);
	}

	async updateStatus(id: ID, status: AutomotiveJobStatusEnum): Promise<AutomotiveJob> {
		const job = await this.findOneScoped(id);
		if (!TRANSITIONS[job.status]?.includes(status)) {
			throw new BadRequestException(`Invalid job status transition: ${job.status} -> ${status}.`);
		}
		if (status === AutomotiveJobStatusEnum.ASSIGNED && !job.assignedEmployeeId) {
			throw new BadRequestException('Assign a technician before assigning the job.');
		}
		await this.typeOrmRepository.update({ id, ...this.scope() }, { status });
		return this.findOneScoped(id);
	}

	private async validateAuthorizationLine(
		lineId: ID,
		repairOrder: RepairOrder,
		scope: { tenantId: ID; organizationId: ID }
	) {
		const approvalLine = await this.approvalLines.findOneByOrFail({ id: lineId, selected: true, ...scope });
		if (Number(approvalLine.approvedQuantity) <= 0) {
			throw new BadRequestException('Only positively approved work can create an automotive job.');
		}
		const approval = await this.approvals.findOneByOrFail({
			id: approvalLine.customerWorkApprovalId,
			repairOrderId: repairOrder.id,
			customerId: repairOrder.customerId,
			vehicleId: repairOrder.vehicleId,
			submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED,
			...scope
		});
		const request = await this.requests.findOneByOrFail({
			id: approval.approvalRequestId,
			status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED,
			...scope
		});
		if (
			request.repairOrderId !== repairOrder.id ||
			request.customerId !== repairOrder.customerId ||
			request.vehicleId !== repairOrder.vehicleId ||
			request.estimateId !== approval.estimateId ||
			request.estimateRevisionNumber !== approval.estimateRevisionNumber
		)
			throw new BadRequestException(
				'Customer approval provenance does not match the repair order and estimate revision.'
			);

		const estimate = await this.estimates.findOneByOrFail({ id: approval.estimateId, ...scope });
		if (
			estimate.repairOrderId !== repairOrder.id ||
			estimate.customerId !== repairOrder.customerId ||
			estimate.vehicleId !== repairOrder.vehicleId ||
			estimate.revisionNumber !== approval.estimateRevisionNumber ||
			(estimate.rootEstimateId ?? estimate.id) !== request.estimateRootId
		)
			throw new BadRequestException('Estimate does not match the approved repair order revision.');
		const estimateLine = await this.estimateLines.findOneByOrFail({
			id: approvalLine.estimateLineId,
			estimateId: approval.estimateId,
			...scope
		});
		return { approvalLine, approval, estimateLine };
	}

	private async findAssignableEmployee(id: ID, scope: { tenantId: ID; organizationId: ID }): Promise<Employee> {
		const employee = await this.employees.findOneByOrFail({ id, ...scope });
		if (employee.isActive === false || employee.isArchived) {
			throw new BadRequestException('Only active employees can be assigned to an automotive job.');
		}
		return employee;
	}

	private async findActiveCategory(
		id: ID,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<AutomotiveJobCategory> {
		const category = await this.categories.findOneByOrFail({ id, ...scope });
		if (category.isActive === false || category.isArchived) {
			throw new BadRequestException('Only active automotive job categories can be assigned.');
		}
		return category;
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
