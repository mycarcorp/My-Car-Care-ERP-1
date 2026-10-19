import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import {
	ContactType,
	CustomerFollowUpSourceEventTypeEnum,
	CustomerFollowUpTypeEnum,
	ID,
	IEmployee,
	IEstimate,
	IInvoice,
	IOrganizationContact,
	IRepairOrder,
	ITask,
	IVehicle
} from '@gauzy/contracts';
import { Store, EmployeesService, OrganizationContactService, TasksService, InvoicesService } from '@gauzy/ui-core/core';
import { EstimateApiService } from '../estimates/estimate-api.service';
import { RepairOrderApiService } from '../repair-orders/repair-order-api.service';
import { VehicleApiService } from '../vehicles/vehicle-api.service';
import { CustomerFollowUpApiService, ICustomerFollowUpView } from './customer-follow-up-api.service';

type LookupStatus = 'idle' | 'loading' | 'ready' | 'error';

@Component({
	selector: 'ga-customer-follow-up-form',
	templateUrl: './customer-follow-up-form.component.html',
	styleUrls: ['./customer-follow-up-form.component.scss'],
	standalone: false
})
export class CustomerFollowUpFormComponent implements OnInit, OnChanges {
	@Input() followUp?: ICustomerFollowUpView;
	@Input() mode: 'create' | 'edit' = 'create';
	@Output() saved = new EventEmitter<ICustomerFollowUpView>();

	private readonly fb = inject(FormBuilder);

	public readonly types = Object.values(CustomerFollowUpTypeEnum);
	public readonly sourceEventTypes = Object.values(CustomerFollowUpSourceEventTypeEnum);
	public readonly form = this.fb.group({
		title: ['', Validators.required],
		description: [''],
		type: [CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION, Validators.required],
		customerId: ['', Validators.required],
		ownerEmployeeId: ['', Validators.required],
		dueAt: [null as Date | null],
		scheduledAt: [null as Date | null],
		vehicleId: [null as ID | null],
		repairOrderId: [null as ID | null],
		estimateId: [null as ID | null],
		invoiceId: [null as ID | null],
		taskId: [null as ID | null],
		sourceEntityType: [''],
		sourceEntityId: [null as ID | null],
		sourceEventType: [CustomerFollowUpSourceEventTypeEnum.MANUAL],
		sourceEventKey: [''],
		sourceEventAt: [null as Date | null]
	});

	public customers: IOrganizationContact[] = [];
	public employees: IEmployee[] = [];
	public vehicles: IVehicle[] = [];
	public repairOrders: IRepairOrder[] = [];
	public estimates: IEstimate[] = [];
	public invoices: IInvoice[] = [];
	public tasks: ITask[] = [];
	public loadingLookups = false;
	public submitting = false;
	public lookupState: LookupStatus = 'idle';

	private readonly api = inject(CustomerFollowUpApiService);
	private readonly store = inject(Store);
	private readonly employeesService = inject(EmployeesService);
	private readonly organizationContactService = inject(OrganizationContactService);
	private readonly invoicesService = inject(InvoicesService);
	private readonly tasksService = inject(TasksService);
	private readonly vehiclesApi = inject(VehicleApiService);
	private readonly repairOrdersApi = inject(RepairOrderApiService);
	private readonly estimatesApi = inject(EstimateApiService);
	private readonly toastr = inject(NbToastrService);

	ngOnInit(): void {
		void this.loadLookups();
		this.applyFollowUp();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes.followUp && !changes.followUp.firstChange) {
			this.applyFollowUp();
		}
	}

	get titleLabel(): string {
		return this.mode === 'edit' ? 'Edit follow-up' : 'Create follow-up';
	}

	get submitLabel(): string {
		return this.mode === 'edit' ? 'Save changes' : 'Create follow-up';
	}

	get customerOptions(): IOrganizationContact[] {
		return this.customers;
	}

	get ownerOptions(): IEmployee[] {
		return this.employees;
	}

	get vehicleOptions(): IVehicle[] {
		const customerId = this.form.controls.customerId.value;
		return customerId ? this.vehicles.filter((vehicle) => vehicle.customerId === customerId) : this.vehicles;
	}

	get repairOrderOptions(): IRepairOrder[] {
		const customerId = this.form.controls.customerId.value;
		return customerId ? this.repairOrders.filter((item) => item.customerId === customerId) : this.repairOrders;
	}

	get estimateOptions(): IEstimate[] {
		const customerId = this.form.controls.customerId.value;
		return customerId ? this.estimates.filter((item) => item.customerId === customerId) : this.estimates;
	}

	get invoiceOptions(): IInvoice[] {
		const customerId = this.form.controls.customerId.value;
		return customerId ? this.invoices.filter((item) => item.organizationContactId === customerId) : this.invoices;
	}

	get taskOptions(): ITask[] {
		return this.tasks;
	}

	private async loadLookups(): Promise<void> {
		const organization = this.store.selectedOrganization;
		const tenantId = this.store.user?.tenantId;
		if (!organization || !tenantId) {
			return;
		}
		this.loadingLookups = true;
		this.lookupState = 'loading';
		try {
			const [customers, employees, vehicles, repairOrders, estimates, invoices, tasks] = await Promise.all([
				this.organizationContactService.getAll([], {
					organizationId: organization.id,
					tenantId,
					contactType: ContactType.CUSTOMER
				}),
				firstValueFrom(
					this.employeesService.getAll([], {
						organizationId: organization.id,
						tenantId
					} as any)
				),
				this.vehiclesApi.list(),
				this.repairOrdersApi.list(),
				this.estimatesApi.list(),
				this.invoicesService.getAll({ organizationId: organization.id, tenantId } as any, []),
				firstValueFrom(this.tasksService.getAllTasks({ organizationId: organization.id, tenantId } as any, []))
			]);
			this.customers = customers.items ?? [];
			this.employees = employees?.items ?? [];
			this.vehicles = vehicles.items ?? [];
			this.repairOrders = repairOrders.items ?? [];
			this.estimates = estimates.items ?? [];
			this.invoices = invoices.items ?? [];
			this.tasks = tasks.items ?? [];
			this.lookupState = 'ready';
			this.patchDefaults();
		} catch (error) {
			this.lookupState = 'error';
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to load follow-up lookup data.');
		} finally {
			this.loadingLookups = false;
		}
	}

	private patchDefaults(): void {
		if (this.mode !== 'create') {
			return;
		}
		if (!this.form.controls.ownerEmployeeId.value && this.store.selectedEmployee?.id) {
			this.form.patchValue({ ownerEmployeeId: this.store.selectedEmployee.id });
		}
		if (!this.form.controls.customerId.value && this.customerOptions.length === 1) {
			this.form.patchValue({ customerId: this.customerOptions[0].id });
		}
	}

	private applyFollowUp(): void {
		if (!this.followUp) {
			return;
		}
		this.form.patchValue({
			title: this.followUp.title,
			description: this.followUp.description ?? '',
			type: this.followUp.type,
			customerId: this.followUp.customerId,
			ownerEmployeeId: this.followUp.ownerEmployeeId ?? this.store.selectedEmployee?.id ?? '',
			dueAt: this.followUp.dueAt ? new Date(this.followUp.dueAt) : null,
			scheduledAt: this.followUp.scheduledAt ? new Date(this.followUp.scheduledAt) : null,
			vehicleId: this.followUp.vehicleId ?? null,
			repairOrderId: this.followUp.repairOrderId ?? null,
			estimateId: this.followUp.estimateId ?? null,
			invoiceId: this.followUp.invoiceId ?? null,
			taskId: this.followUp.taskId ?? null,
			sourceEntityType: this.followUp.sourceEntityType ?? '',
			sourceEntityId: this.followUp.sourceEntityId ?? null,
			sourceEventType: this.followUp.sourceEventType ?? CustomerFollowUpSourceEventTypeEnum.MANUAL,
			sourceEventKey: this.followUp.sourceEventKey ?? '',
			sourceEventAt: this.followUp.sourceEventAt ? new Date(this.followUp.sourceEventAt) : null
		});
	}

	onCustomerChanged(): void {
		this.form.patchValue({
			vehicleId: null,
			repairOrderId: null,
			estimateId: null,
			invoiceId: null
		});
	}

	trackById(_: number, item: { id: ID }): ID {
		return item.id;
	}

	vehicleLabel(vehicle: IVehicle): string {
		return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vinNormalized || vehicle.id;
	}

	repairOrderLabel(item: IRepairOrder): string {
		return item.repairOrderNumber || item.id;
	}

	estimateLabel(item: IEstimate): string {
		return `#${item.estimateNumber ?? item.id}`;
	}

	invoiceLabel(item: IInvoice): string {
		return item.invoiceNumber?.toString() || item.id;
	}

	taskLabel(item: ITask): string {
		return item.title || item.id;
	}

	async submit(): Promise<void> {
		if (this.submitting || this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		const organization = this.store.selectedOrganization;
		const tenantId = this.store.user?.tenantId;
		if (!organization || !tenantId) {
			this.toastr.danger('Missing tenant or organization context.');
			return;
		}
		const value = this.form.value;
		const payload = {
			tenantId,
			organizationId: organization.id,
			title: value.title.trim(),
			description: value.description?.trim() || undefined,
			type: value.type,
			customerId: value.customerId,
			ownerEmployeeId: value.ownerEmployeeId,
			dueAt: value.dueAt ?? undefined,
			scheduledAt: value.scheduledAt ?? undefined,
			vehicleId: value.vehicleId ?? undefined,
			repairOrderId: value.repairOrderId ?? undefined,
			estimateId: value.estimateId ?? undefined,
			invoiceId: value.invoiceId ?? undefined,
			taskId: value.taskId ?? undefined,
			sourceEntityType: value.sourceEntityType?.trim() || undefined,
			sourceEntityId: value.sourceEntityId ?? undefined,
			sourceEventType: value.sourceEventType,
			sourceEventKey: value.sourceEventKey?.trim() || undefined,
			sourceEventAt: value.sourceEventAt ?? undefined
		};
		this.submitting = true;
		try {
			const followUp = this.mode === 'edit' && this.followUp?.id
				? await this.api.update(this.followUp.id, payload)
				: await this.api.create(payload);
			this.saved.emit(followUp);
			this.toastr.success(
				this.mode === 'edit' ? 'Follow-up updated.' : 'Follow-up created.',
				'Success'
			);
			if (this.mode === 'create') {
				this.form.reset({
					type: CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION,
					sourceEventType: CustomerFollowUpSourceEventTypeEnum.MANUAL,
					ownerEmployeeId: this.store.selectedEmployee?.id ?? null
				});
			}
		} catch (error) {
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to save follow-up.');
		} finally {
			this.submitting = false;
		}
	}
}