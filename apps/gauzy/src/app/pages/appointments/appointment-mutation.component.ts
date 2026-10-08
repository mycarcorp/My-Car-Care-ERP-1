import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
	ContactType,
	IEmployee,
	IEmployeeAppointment,
	IEmployeeAppointmentCreateInput,
	IOrganization,
	IOrganizationContact,
	IVehicle
} from '@gauzy/contracts';
import { EmployeeAppointmentService, EmployeesService, OrganizationContactService, Store } from '@gauzy/ui-core/core';
import { VehicleApiService } from '../vehicles/vehicle-api.service';

/**
 * "New Appointment" dialog for the Service Center: customer → vehicle (filtered to the
 * customer) → concern → service type (agenda) → date/time → advisor. Creates the appointment
 * via the existing `EmployeeAppointmentService.create` (`POST /employee-appointment`), which
 * enforces the automotive customer/vehicle/concern validation and tenant/org scoping.
 */
@Component({
	selector: 'ga-appointment-mutation',
	templateUrl: './appointment-mutation.component.html',
	styleUrls: ['./appointment-mutation.component.scss'],
	standalone: false
})
export class AppointmentMutationComponent implements OnInit {
	public customers: IOrganizationContact[] = [];
	public vehicles: IVehicle[] = [];
	public advisors: IEmployee[] = [];
	public customerId: string;
	public vehicleId: string;
	public originalConcern = '';
	public agenda = '';
	public startDateTime: Date;
	public endDateTime: Date;
	public employeeId: string;
	public loading = false;
	public submitting = false;
	public organization: IOrganization;

	private readonly dialogRef = inject<NbDialogRef<AppointmentMutationComponent>>(NbDialogRef);
	private readonly appointmentService = inject(EmployeeAppointmentService);
	private readonly organizationContactService = inject(OrganizationContactService);
	private readonly vehicleApi = inject(VehicleApiService);
	private readonly employeesService = inject(EmployeesService);
	private readonly store = inject(Store);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		this.loadLookups();
	}

	/** Loads customers, vehicles, and advisors for the selects. */
	private async loadLookups(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		try {
			const [customersRes, vehiclesRes, advisorsRes] = await Promise.all([
				this.organizationContactService.getAll([], { organizationId, tenantId, contactType: ContactType.CUSTOMER }),
				this.vehicleApi.list(),
				firstValueFrom(this.employeesService.getAll(['user'], { organizationId, tenantId }))
			]);
			this.customers = customersRes.items ?? [];
			this.vehicles = (vehiclesRes.items ?? []) as IVehicle[];
			this.advisors = advisorsRes.items ?? [];
		} catch (error) {
			this.toastr.danger(
				error?.message || this.getTranslation('APPOINTMENTS_PAGE.MUTATION.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Vehicles filtered to the selected customer (vehicle selection restricted to the customer). */
	get customerVehicles(): IVehicle[] {
		if (!this.customerId) {
			return [];
		}
		return this.vehicles.filter((v) => v.customerId === this.customerId);
	}

	/** Resets the vehicle selection when the customer changes. */
	onCustomerChange(): void {
		this.vehicleId = undefined;
	}

	vehicleLabel(vehicle: IVehicle): string {
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	advisorLabel(employee: IEmployee): string {
		const user = employee?.['user'];
		return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || employee.id;
	}

	/**
	 * Submits the form: validates required fields (customer, vehicle, concern, agenda, valid
	 * date/time range), creates the appointment, and closes with the created record. The
	 * backend applies the SCHEDULED default and the automotive customer/vehicle validation.
	 */
	async submit(): Promise<void> {
		if (
			!this.customerId ||
			!this.vehicleId ||
			!this.originalConcern.trim() ||
			!this.agenda.trim() ||
			!this.startDateTime ||
			!this.endDateTime
		) {
			this.toastr.warning(
				this.getTranslation('APPOINTMENTS_PAGE.MUTATION.REQUIRED_FIELDS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const start = new Date(this.startDateTime);
		const end = new Date(this.endDateTime);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
			this.toastr.warning(
				this.getTranslation('APPOINTMENTS_PAGE.MUTATION.INVALID_TIME'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const body: IEmployeeAppointmentCreateInput = {
			tenantId,
			organizationId,
			customerId: this.customerId,
			vehicleId: this.vehicleId,
			originalConcern: this.originalConcern.trim(),
			agenda: this.agenda.trim(),
			startDateTime: start,
			endDateTime: end,
			...(this.employeeId ? { employeeId: this.employeeId } : {})
		};
		this.submitting = true;
		try {
			const appointment: IEmployeeAppointment = await this.appointmentService.create(body);
			this.toastr.success(
				this.getTranslation('APPOINTMENTS_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(appointment);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('APPOINTMENTS_PAGE.MUTATION.FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.submitting = false;
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}
