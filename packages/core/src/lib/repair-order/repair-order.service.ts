import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IRepairOrderArrivalInput, RepairOrderStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeAppointmentService } from '../employee-appointment/employee-appointment.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { MikroOrmRepairOrderRepository } from './repository/mikro-orm-repair-order.repository';
import { TypeOrmRepairOrderRepository } from './repository/type-orm-repair-order.repository';
import { RepairOrder } from './repair-order.entity';

@Injectable()
export class RepairOrderService extends TenantAwareCrudService<RepairOrder> {
	constructor(
		typeOrmRepairOrderRepository: TypeOrmRepairOrderRepository,
		mikroOrmRepairOrderRepository: MikroOrmRepairOrderRepository,
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly vehicleService: VehicleService
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
}
