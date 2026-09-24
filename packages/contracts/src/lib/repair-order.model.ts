import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeAppointment } from './employee-appointment.model';
import { IEmployee } from './employee.model';
import { IOrganizationContact } from './organization-contact.model';
import { IVehicle } from './vehicle.model';

export enum RepairOrderStatusEnum {
	OPEN = 'OPEN',
	IN_PROGRESS = 'IN_PROGRESS',
	READY = 'READY',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED'
}

export interface IRepairOrder extends IBasePerTenantAndOrganizationEntityModel {
	repairOrderNumber: string;
	status: RepairOrderStatusEnum;
	arrivedAt: Date;
	arrivalOdometer?: number;
	originalConcern?: string;
	appointmentId: ID;
	appointment?: IEmployeeAppointment;
	customerId: ID;
	customer?: IOrganizationContact;
	vehicleId: ID;
	vehicle?: IVehicle;
	serviceAdvisorEmployeeId?: ID;
	serviceAdvisor?: IEmployee;
}

export interface IRepairOrderArrivalInput {
	appointmentId: ID;
	arrivalOdometer?: number;
}
