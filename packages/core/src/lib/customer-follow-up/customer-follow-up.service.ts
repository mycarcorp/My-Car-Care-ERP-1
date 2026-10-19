import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CustomerFollowUp } from '../core/entities/internal';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	CustomerFollowUpStatusEnum,
	ID,
	ICustomerFollowUp,
	ICustomerFollowUpCreateInput,
	ICustomerFollowUpTransitionInput,
	ICustomerFollowUpUpdateInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { TypeOrmCustomerFollowUpRepository } from './repository/type-orm-customer-follow-up.repository';
import { MikroOrmCustomerFollowUpRepository } from './repository/mikro-orm-customer-follow-up.repository';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { EstimateService } from '../estimate/estimate.service';
import { InvoiceService } from '../invoice/invoice.service';
import { TaskService } from '../tasks/task.service';
import { EmployeeService } from '../employee/employee.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { RequestContext } from '../core/context';

const TRANSITIONS: Record<CustomerFollowUpStatusEnum, CustomerFollowUpStatusEnum[]> = {
	[CustomerFollowUpStatusEnum.OPEN]: [
		CustomerFollowUpStatusEnum.SCHEDULED,
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.SCHEDULED]: [
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.ACTIVE]: [
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.DEFERRED]: [
		CustomerFollowUpStatusEnum.SCHEDULED,
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.OVERDUE]: [
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.COMPLETED]: [],
	[CustomerFollowUpStatusEnum.CANCELLED]: []
};

@Injectable()
export class CustomerFollowUpService extends TenantAwareCrudService<CustomerFollowUp> {
	constructor(
		readonly typeOrmCustomerFollowUpRepository: TypeOrmCustomerFollowUpRepository,
		readonly mikroOrmCustomerFollowUpRepository: MikroOrmCustomerFollowUpRepository,
		private readonly organizationContacts: OrganizationContactService,
		private readonly vehicles: VehicleService,
		private readonly repairOrders: RepairOrderService,
		private readonly estimates: EstimateService,
		private readonly invoices: InvoiceService,
		private readonly tasks: TaskService,
		private readonly employees: EmployeeService,
		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmCustomerFollowUpRepository, mikroOrmCustomerFollowUpRepository);
	}

	async createFollowUp(input: ICustomerFollowUpCreateInput): Promise<CustomerFollowUp> {
		const scope = this.scope(input);
		const existing = input.sourceEventKey
			? await this.typeOrmCustomerFollowUpRepository.findOne({
				where: { sourceEventKey: input.sourceEventKey, tenantId: scope.tenantId, organizationId: scope.organizationId }
			})
			: null;
		if (existing) {
			return existing;
		}

		const resolved = await this.resolveContext(input, scope);
		const ownerEmployeeId = input.ownerEmployeeId ?? RequestContext.currentEmployeeId();
		if (!ownerEmployeeId) {
			throw new BadRequestException('A follow-up owner is required.');
		}
		await this.ensureEmployeeInScope(ownerEmployeeId, scope);

		const status = input.status ?? CustomerFollowUpStatusEnum.OPEN;
		this.assertCreateStatusAllowed(status);

		const entity = await this.typeOrmCustomerFollowUpRepository.manager.transaction(async (manager) => {
			const repository = manager.getRepository(CustomerFollowUp);
			const id = (input as any).id ?? randomUUID();
			return repository.save(
				repository.create({
					id,
					...resolved,
					...input,
					status,
					ownerEmployeeId,
					tenantId: scope.tenantId,
					organizationId: scope.organizationId
				})
			);
		});

		this.logActivity(ActionTypeEnum.Created, entity, undefined, input);
		return entity;
	}

	async updateFollowUp(id: ID, input: ICustomerFollowUpUpdateInput): Promise<CustomerFollowUp> {
		const scope = this.scope(input);
		const followUp = await this.findScoped(id, scope);
		if (input.status && input.status !== followUp.status) {
			throw new BadRequestException('Use a status transition endpoint to change follow-up status.');
		}
		const resolved = await this.resolveContext({ ...followUp, ...input }, scope, followUp);
		const updated = await this.typeOrmCustomerFollowUpRepository.save(
			this.typeOrmCustomerFollowUpRepository.merge(followUp, {
				...input,
				...resolved,
				id
			})
		);
		this.logActivity(ActionTypeEnum.Updated, updated, followUp, input);
		return updated;
	}

	async assign(id: ID, ownerEmployeeId: ID): Promise<CustomerFollowUp> {
		const scope = this.scope();
		await this.ensureEmployeeInScope(ownerEmployeeId, scope);
		const followUp = await this.findScoped(id, scope);
		if (followUp.ownerEmployeeId === ownerEmployeeId) {
			return followUp;
		}
		const updated = await this.typeOrmCustomerFollowUpRepository.save(
			this.typeOrmCustomerFollowUpRepository.merge(followUp, { ownerEmployeeId })
		);
		this.logActivity(ActionTypeEnum.Updated, updated, followUp, { ownerEmployeeId });
		return updated;
	}

	async transition(id: ID, input: ICustomerFollowUpTransitionInput): Promise<CustomerFollowUp> {
		const scope = this.scope();
		const followUp = await this.findScoped(id, scope);
		this.assertTransitionAllowed(followUp.status, input.status);
		const patch: Partial<ICustomerFollowUp> = { status: input.status };
		if (input.statusReason !== undefined) patch.statusReason = input.statusReason;
		if (input.dueAt !== undefined) patch.dueAt = input.dueAt;
		if (input.deferredUntil !== undefined) patch.deferredUntil = input.deferredUntil;
		if (input.status === CustomerFollowUpStatusEnum.COMPLETED) {
			patch.completedAt = new Date();
		}
		const updated = await this.typeOrmCustomerFollowUpRepository.save(
			this.typeOrmCustomerFollowUpRepository.merge(followUp, patch)
		);
		this.logActivity(ActionTypeEnum.Updated, updated, followUp, patch);
		return updated;
	}

	async complete(id: ID, statusReason?: string): Promise<CustomerFollowUp> {
		return this.transition(id, { status: CustomerFollowUpStatusEnum.COMPLETED, statusReason });
	}

	async defer(id: ID, deferredUntil: Date, statusReason?: string): Promise<CustomerFollowUp> {
		return this.transition(id, {
			status: CustomerFollowUpStatusEnum.DEFERRED,
			deferredUntil,
			dueAt: deferredUntil,
			statusReason
		});
	}

	async markOverdue(id: ID, statusReason?: string): Promise<CustomerFollowUp> {
		return this.transition(id, { status: CustomerFollowUpStatusEnum.OVERDUE, statusReason });
	}

	private async findScoped(id: ID, scope: { tenantId: ID; organizationId: ID }): Promise<CustomerFollowUp> {
		const followUp = await this.findOneByIdString(id);
		if (followUp.tenantId !== scope.tenantId || followUp.organizationId !== scope.organizationId) {
			throw new BadRequestException('Follow-up does not belong to the current tenant or organization.');
		}
		return followUp;
	}

	private async ensureEmployeeInScope(
		employeeId: ID,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<void> {
		if (!employeeId) return;
		const employee = await this.employees.findOneByIdString(employeeId);
		if (employee.tenantId !== scope.tenantId || employee.organizationId !== scope.organizationId) {
			throw new BadRequestException('Employee must belong to the current tenant and organization.');
		}
	}

	private assertCreateStatusAllowed(status: CustomerFollowUpStatusEnum): void {
		if ([CustomerFollowUpStatusEnum.COMPLETED, CustomerFollowUpStatusEnum.CANCELLED].includes(status)) {
			throw new BadRequestException('A new follow-up cannot be created in a terminal state.');
		}
	}

	private assertTransitionAllowed(
		currentStatus: CustomerFollowUpStatusEnum,
		nextStatus: CustomerFollowUpStatusEnum
	): void {
		if (currentStatus === nextStatus) {
			return;
		}
		if (!TRANSITIONS[currentStatus]?.includes(nextStatus)) {
			throw new BadRequestException(`Cannot transition follow-up from ${currentStatus} to ${nextStatus}.`);
		}
	}

	private async resolveContext(
		input: ICustomerFollowUpCreateInput,
		scope: { tenantId: ID; organizationId: ID },
		existing?: CustomerFollowUp
	): Promise<Partial<ICustomerFollowUp>> {
		const [vehicle, repairOrder, estimate, invoice, task] = await Promise.all([
			input.vehicleId ? this.vehicles.findOneByIdString(input.vehicleId) : undefined,
			input.repairOrderId ? this.repairOrders.findOneByIdString(input.repairOrderId) : undefined,
			input.estimateId ? this.estimates.findOneByIdString(input.estimateId) : undefined,
			input.invoiceId ? this.invoices.findOneByIdString(input.invoiceId) : undefined,
			input.taskId ? this.tasks.findOneByIdString(input.taskId) : undefined
		]);

		const customerId =
			input.customerId ??
			vehicle?.customerId ??
			repairOrder?.customerId ??
			estimate?.customerId ??
			invoice?.organizationContactId;
		if (!customerId) {
			throw new BadRequestException('A customer is required or must be inferable from linked records.');
		}
		const customer = await this.organizationContacts.findOneByIdString(customerId);
		this.assertScope(customer, scope, 'Customer');

		if (vehicle) this.assertScope(vehicle, scope, 'Vehicle');
		if (repairOrder) this.assertScope(repairOrder, scope, 'Repair order');
		if (estimate) this.assertScope(estimate, scope, 'Estimate');
		if (invoice) this.assertScope(invoice, scope, 'Invoice');
		if (task) this.assertScope(task, scope, 'Task');

		const resolvedVehicleId = input.vehicleId ?? vehicle?.id ?? repairOrder?.vehicleId ?? estimate?.vehicleId;
		const resolvedRepairOrderId = input.repairOrderId ?? repairOrder?.id ?? estimate?.repairOrderId;
		const resolvedEstimateId = input.estimateId ?? estimate?.id;
		const resolvedInvoiceId = input.invoiceId ?? invoice?.id;

		if (vehicle && vehicle.customerId !== customer.id) {
			throw new BadRequestException('Vehicle must belong to the selected customer.');
		}
		if (repairOrder) {
			if (repairOrder.customerId !== customer.id) {
				throw new BadRequestException('Repair order must belong to the selected customer.');
			}
			if (resolvedVehicleId && repairOrder.vehicleId !== resolvedVehicleId) {
				throw new BadRequestException('Repair order must belong to the selected vehicle.');
			}
		}
		if (estimate) {
			if (estimate.customerId !== customer.id) {
				throw new BadRequestException('Estimate must belong to the selected customer.');
			}
			if (resolvedRepairOrderId && estimate.repairOrderId !== resolvedRepairOrderId) {
				throw new BadRequestException('Estimate must belong to the selected repair order.');
			}
			if (resolvedVehicleId && estimate.vehicleId !== resolvedVehicleId) {
				throw new BadRequestException('Estimate must belong to the selected vehicle.');
			}
		}
		if (invoice && invoice.organizationContactId !== customer.id) {
			throw new BadRequestException('Invoice must belong to the selected customer.');
		}
		if (existing?.taskId && resolvedVehicleId === undefined && resolvedRepairOrderId === undefined && resolvedEstimateId === undefined && resolvedInvoiceId === undefined) {
			// no-op; the existing task association already belongs to the scoped follow-up.
		}

		return {
			customerId: customer.id,
			vehicleId: resolvedVehicleId,
			repairOrderId: resolvedRepairOrderId,
			estimateId: resolvedEstimateId,
			invoiceId: resolvedInvoiceId,
			taskId: input.taskId ?? task?.id ?? existing?.taskId,
			sourceEntityType: input.sourceEntityType,
			sourceEntityId: input.sourceEntityId,
			sourceEventType: input.sourceEventType,
			sourceEventKey: input.sourceEventKey,
			sourceEventAt: input.sourceEventAt,
			scheduledAt: input.scheduledAt,
			dueAt: input.dueAt
		};
	}

	private assertScope(entity: { tenantId?: ID; organizationId?: ID }, scope: { tenantId: ID; organizationId: ID }, label: string): void {
		if (entity.tenantId !== scope.tenantId || entity.organizationId !== scope.organizationId) {
			throw new BadRequestException(`${label} must belong to the current tenant and organization.`);
		}
	}

	private logActivity(
		action: ActionTypeEnum,
		followUp: CustomerFollowUp,
		previousValues?: Partial<ICustomerFollowUp>,
		updatedValues?: Partial<ICustomerFollowUp>
	): void {
		const currentUser = RequestContext.currentUser();
		const actorType = currentUser ? ActorTypeEnum.User : ActorTypeEnum.System;
		this.activityLogService.logActivity<CustomerFollowUp>(
			BaseEntityEnum.CustomerFollowUp,
			action,
			actorType,
			followUp.id,
			followUp.title,
			followUp,
			followUp.organizationId,
			followUp.tenantId,
			previousValues,
			updatedValues
		);
	}

	private scope(input?: { tenantId?: ID; organizationId?: ID }): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId() ?? input?.tenantId;
		const organizationId = RequestContext.currentOrganizationId() ?? input?.organizationId;
		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and organization context are required.');
		}
		return { tenantId, organizationId };
	}
}