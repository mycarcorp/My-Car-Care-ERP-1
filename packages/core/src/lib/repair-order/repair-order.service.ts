import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import {
	AutomotiveJobStatusEnum,
	ID,
	IRepairOrderArrivalInput,
	IRepairOrderCancelInput,
	IRepairOrderCloseInput,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { AutomotiveJobQcService } from '../automotive-job-qc/automotive-job-qc.service';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { EmployeeAppointmentService } from '../employee-appointment/employee-appointment.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { MikroOrmRepairOrderRepository } from './repository/mikro-orm-repair-order.repository';
import { TypeOrmRepairOrderRepository } from './repository/type-orm-repair-order.repository';
import { RepairOrder } from './repair-order.entity';

const RO_TRANSITIONS: Record<RepairOrderStatusEnum, RepairOrderStatusEnum[]> = {
	[RepairOrderStatusEnum.OPEN]: [RepairOrderStatusEnum.IN_PROGRESS, RepairOrderStatusEnum.CANCELLED],
	[RepairOrderStatusEnum.IN_PROGRESS]: [RepairOrderStatusEnum.READY, RepairOrderStatusEnum.CANCELLED],
	[RepairOrderStatusEnum.READY]: [RepairOrderStatusEnum.IN_PROGRESS, RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED],
	[RepairOrderStatusEnum.CLOSED]: [],
	[RepairOrderStatusEnum.CANCELLED]: []
};

@Injectable()
export class RepairOrderService extends TenantAwareCrudService<RepairOrder> {
	constructor(
		private readonly typeOrmRepairOrderRepository: TypeOrmRepairOrderRepository,
		mikroOrmRepairOrderRepository: MikroOrmRepairOrderRepository,
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly vehicleService: VehicleService,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(AutomotiveJobLabor) private readonly labors: Repository<AutomotiveJobLabor>,
		@InjectRepository(TimeLog) private readonly timeLogs: Repository<TimeLog>,
		private readonly jobQc: AutomotiveJobQcService
	) {
		super(typeOrmRepairOrderRepository, mikroOrmRepairOrderRepository);
	}

	async arrive(input: IRepairOrderArrivalInput): Promise<RepairOrder> {
		const appointment = await this.employeeAppointmentService.findOneByIdString(input.appointmentId);
		if (!appointment.customerId || !appointment.vehicleId) {
			throw new BadRequestException('A My Car Care appointment must have a customer and vehicle before arrival.');
		}

		const [customer, vehicle, existingRepairOrders] = await Promise.all([
			this.organizationContactService.findOneByIdString(appointment.customerId),
			this.vehicleService.findOneByIdString(appointment.vehicleId),
			this.findAll({ where: { appointmentId: appointment.id } })
		]);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? appointment.organizationId;

		if (
			(tenantId &&
				(appointment.tenantId !== tenantId ||
					customer.tenantId !== tenantId ||
					vehicle.tenantId !== tenantId)) ||
			(organizationId &&
				(appointment.organizationId !== organizationId ||
					customer.organizationId !== organizationId ||
					vehicle.organizationId !== organizationId)) ||
			vehicle.customerId !== customer.id
		) {
			throw new BadRequestException(
				'Appointment customer and vehicle must belong to the current tenant and organization, and the vehicle must belong to the customer.'
			);
		}

		if (existingRepairOrders.items.length) {
			throw new BadRequestException('A repair order already exists for this appointment.');
		}

		return super.create({
			appointmentId: appointment.id,
			customerId: customer.id,
			vehicleId: vehicle.id,
			serviceAdvisorEmployeeId: appointment.employeeId,
			originalConcern: appointment.originalConcern,
			arrivalOdometer: input.arrivalOdometer,
			arrivedAt: new Date(),
			status: RepairOrderStatusEnum.OPEN,
			repairOrderNumber: `RO-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
			organizationId: appointment.organizationId
		});
	}

	async markInProgressIfOpen(repairOrderId: ID, scope = this.scope()): Promise<void> {
		const repairOrder = await this.findScoped(repairOrderId, scope);
		if ([RepairOrderStatusEnum.IN_PROGRESS, RepairOrderStatusEnum.READY].includes(repairOrder.status)) {
			return;
		}
		if (repairOrder.status !== RepairOrderStatusEnum.OPEN) {
			throw new BadRequestException('A closed or cancelled repair order cannot start work.');
		}
		await this.typeOrmRepairOrderRepository.update(
			{ id: repairOrder.id, ...scope },
			{ status: RepairOrderStatusEnum.IN_PROGRESS }
		);
	}

	async evaluateReadiness(repairOrderId: ID, scope = this.scope()): Promise<RepairOrder> {
		const repairOrder = await this.findScoped(repairOrderId, scope);
		if (repairOrder.status !== RepairOrderStatusEnum.IN_PROGRESS) {
			return repairOrder;
		}
		const jobs = await this.jobs.find({
			where: { repairOrderId: repairOrder.id, ...scope },
			select: { id: true, status: true }
		});
		const nonCancelledJobs = jobs.filter((job) => job.status !== AutomotiveJobStatusEnum.CANCELLED);
		if (
			!nonCancelledJobs.length ||
			nonCancelledJobs.some((job) => job.status !== AutomotiveJobStatusEnum.COMPLETED)
		) {
			return repairOrder;
		}
		const laborRows = await this.labors.find({
			where: { automotiveJobId: In(nonCancelledJobs.map((job) => job.id)), ...scope },
			select: { id: true }
		});
		if (laborRows.length) {
			const runningLog = await this.timeLogs.findOne({
				where: {
					automotiveJobLaborId: In(laborRows.map((labor) => labor.id)),
					isRunning: true,
					...scope
				}
			});
			if (runningLog) return repairOrder;
		}
		repairOrder.status = RepairOrderStatusEnum.READY;
		return this.typeOrmRepairOrderRepository.save(repairOrder);
	}

	async close(id: ID, input: IRepairOrderCloseInput): Promise<RepairOrder> {
		const repairOrder = await this.findScoped(id);
		if (repairOrder.status === RepairOrderStatusEnum.CLOSED) {
			return repairOrder;
		}
		if (repairOrder.status !== RepairOrderStatusEnum.READY) {
			throw new BadRequestException('Only a ready repair order can be closed.');
		}
		repairOrder.status = RepairOrderStatusEnum.CLOSED;
		return this.typeOrmRepairOrderRepository.save(repairOrder);
	}

	async cancel(id: ID, input: IRepairOrderCancelInput): Promise<RepairOrder> {
		if (!input.cancelReason?.trim()) {
			throw new BadRequestException('A cancellation reason is required.');
		}
		const scope = this.scope();
		const repairOrder = await this.findScoped(id, scope);
		if (repairOrder.status === RepairOrderStatusEnum.CANCELLED) {
			return repairOrder;
		}
		if (repairOrder.status === RepairOrderStatusEnum.CLOSED) {
			throw new BadRequestException('A closed repair order cannot be cancelled.');
		}
		const jobs = await this.jobs.find({
			where: { repairOrderId: repairOrder.id, ...scope },
			select: { id: true, status: true }
		});
		if (
			jobs.some((job) =>
				[
					AutomotiveJobStatusEnum.OPEN,
					AutomotiveJobStatusEnum.ASSIGNED,
					AutomotiveJobStatusEnum.IN_PROGRESS
				].includes(job.status)
			)
		) {
			throw new ConflictException(
				'Cannot cancel a repair order with active or pending jobs. Complete or cancel the jobs first.'
			);
		}
		if (jobs.length) {
			const laborRows = await this.labors.find({
				where: { automotiveJobId: In(jobs.map((job) => job.id)), ...scope },
				select: { id: true }
			});
			if (laborRows.length) {
				const runningLog = await this.timeLogs.findOne({
					where: {
						automotiveJobLaborId: In(laborRows.map((labor) => labor.id)),
						isRunning: true,
						...scope
					}
				});
				if (runningLog) {
					throw new ConflictException(
						'Cannot cancel a repair order with running labor time logs. Stop the timers first.'
					);
				}
			}
		}
		repairOrder.status = RepairOrderStatusEnum.CANCELLED;
		return this.typeOrmRepairOrderRepository.save(repairOrder);
	}

	async markRework(repairOrderId: ID, scope = this.scope()): Promise<void> {
		const repairOrder = await this.findScoped(repairOrderId, scope);
		if ([RepairOrderStatusEnum.OPEN, RepairOrderStatusEnum.IN_PROGRESS].includes(repairOrder.status)) {
			return;
		}
		if (!RO_TRANSITIONS[repairOrder.status]?.includes(RepairOrderStatusEnum.IN_PROGRESS)) {
			throw new BadRequestException('A closed or cancelled repair order cannot return to in-progress.');
		}
		await this.typeOrmRepairOrderRepository.update(
			{ id: repairOrder.id, ...scope },
			{ status: RepairOrderStatusEnum.IN_PROGRESS }
		);
	}

	private async findScoped(id: ID, scope = this.scope()): Promise<RepairOrder> {
		const repairOrder = await this.typeOrmRepairOrderRepository.findOneBy({ id, ...scope });
		if (!repairOrder) throw new NotFoundException('Repair order not found in this organization.');
		return repairOrder;
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
