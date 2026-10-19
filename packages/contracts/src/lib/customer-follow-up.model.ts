import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export enum CustomerFollowUpTypeEnum {
	POST_SERVICE_SATISFACTION = 'POST_SERVICE_SATISFACTION',
	DECLINED_WORK = 'DECLINED_WORK',
	MAINTENANCE_REMINDER = 'MAINTENANCE_REMINDER',
	INVOICE_PAYMENT = 'INVOICE_PAYMENT'
}

export enum CustomerFollowUpStatusEnum {
	OPEN = 'OPEN',
	SCHEDULED = 'SCHEDULED',
	ACTIVE = 'ACTIVE',
	DEFERRED = 'DEFERRED',
	OVERDUE = 'OVERDUE',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED'
}

export enum CustomerFollowUpSourceEventTypeEnum {
	MANUAL = 'MANUAL',
	REPAIR_ORDER_CLOSED = 'REPAIR_ORDER_CLOSED',
	ESTIMATE_DECLINED = 'ESTIMATE_DECLINED',
	MAINTENANCE_DUE = 'MAINTENANCE_DUE',
	INVOICE_OVERDUE = 'INVOICE_OVERDUE',
	INVOICE_PAYMENT_DUE = 'INVOICE_PAYMENT_DUE',
	TASK_CREATED = 'TASK_CREATED'
}

export interface ICustomerFollowUp extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	type: CustomerFollowUpTypeEnum;
	status: CustomerFollowUpStatusEnum;
	dueAt?: Date;
	scheduledAt?: Date;
	completedAt?: Date;
	deferredUntil?: Date;
	statusReason?: string;
	sourceEntityType?: string;
	sourceEntityId?: ID;
	sourceEventType?: CustomerFollowUpSourceEventTypeEnum;
	sourceEventKey?: string;
	sourceEventAt?: Date;
	customerId: ID;
	vehicleId?: ID;
	repairOrderId?: ID;
	estimateId?: ID;
	invoiceId?: ID;
	taskId?: ID;
	ownerEmployeeId?: ID;
}

export interface ICustomerFollowUpCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description?: string;
	type: CustomerFollowUpTypeEnum;
	dueAt?: Date;
	scheduledAt?: Date;
	status?: CustomerFollowUpStatusEnum;
	statusReason?: string;
	sourceEntityType?: string;
	sourceEntityId?: ID;
	sourceEventType?: CustomerFollowUpSourceEventTypeEnum;
	sourceEventKey?: string;
	sourceEventAt?: Date;
	customerId?: ID;
	vehicleId?: ID;
	repairOrderId?: ID;
	estimateId?: ID;
	invoiceId?: ID;
	taskId?: ID;
	ownerEmployeeId?: ID;
}

export type ICustomerFollowUpUpdateInput = Partial<ICustomerFollowUpCreateInput>;

export interface ICustomerFollowUpAssignInput {
	ownerEmployeeId: ID;
}

export interface ICustomerFollowUpTransitionInput {
	status: CustomerFollowUpStatusEnum;
	statusReason?: string;
	dueAt?: Date;
	deferredUntil?: Date;
}