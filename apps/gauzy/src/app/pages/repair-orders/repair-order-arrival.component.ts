import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { IEmployeeAppointment, IOrganization, IRepairOrder, IRepairOrderArrivalInput } from '@gauzy/contracts';
import { EmployeeAppointmentService, Store } from '@gauzy/ui-core/core';
import { RepairOrderApiService } from './repair-order-api.service';

/**
 * "Vehicle Arrival / Check-In" dialog: select an existing appointment, optionally
 * record the arrival odometer, and create the Repair Order via the authoritative
 * backend arrival endpoint (`POST /repair-orders/arrival`).
 */
@Component({
	selector: 'ga-repair-order-arrival',
	templateUrl: './repair-order-arrival.component.html',
	styleUrls: ['./repair-order-arrival.component.scss'],
	standalone: false
})
export class RepairOrderArrivalComponent implements OnInit {
	public appointments: IEmployeeAppointment[] = [];
	public selectedAppointmentId: string;
	public arrivalOdometer: number;
	public loading = false;
	public submitting = false;
	public organization: IOrganization;

	private readonly dialogRef = inject<NbDialogRef<RepairOrderArrivalComponent>>(NbDialogRef);
	private readonly appointmentService = inject(EmployeeAppointmentService);
	private readonly api = inject(RepairOrderApiService);
	private readonly store = inject(Store);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	/**
	 * Translates a key using the current language.
	 */
	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		this.loadAppointments();
	}

	/**
	 * Loads the current organization/tenant's appointments (with customer/vehicle relations)
	 * so the user can pick the one being checked in.
	 */
	private async loadAppointments(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const { items } = await firstValueFrom(this.appointmentService.getAll(['customer', 'vehicle']));
			this.appointments = items ?? [];
		} catch (error) {
			this.toastr.danger(
				error?.message || this.getTranslation('REPAIR_ORDERS_PAGE.ARRIVAL.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Builds a distinguishing label for an appointment option (customer, vehicle, date/time, status).
	 */
	appointmentLabel(appointment: IEmployeeAppointment): string {
		const customer = appointment['customer']?.name ?? '';
		const vehicle = this.appointmentVehicleLabel(appointment);
		const when = appointment.startDateTime ? new Date(appointment.startDateTime).toLocaleString() : '';
		const status = appointment.status ?? '';
		return [customer, vehicle, when, status].filter(Boolean).join(' — ');
	}

	private appointmentVehicleLabel(appointment: IEmployeeAppointment): string {
		const vehicle = appointment['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : (vehicle.vinNormalized ?? '');
	}

	/**
	 * Submits the arrival: validates a selection, includes the odometer only when entered,
	 * calls the authoritative arrival endpoint, and closes with the created Repair Order.
	 */
	async submit(): Promise<void> {
		if (!this.selectedAppointmentId) {
			this.toastr.warning(
				this.getTranslation('REPAIR_ORDERS_PAGE.ARRIVAL.SELECT_APPOINTMENT'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const input: IRepairOrderArrivalInput = { appointmentId: this.selectedAppointmentId };
		if (
			this.arrivalOdometer !== undefined &&
			this.arrivalOdometer !== null &&
			!Number.isNaN(Number(this.arrivalOdometer))
		) {
			input.arrivalOdometer = Number(this.arrivalOdometer);
		}
		this.submitting = true;
		try {
			const repairOrder: IRepairOrder = await this.api.arrive(input);
			this.toastr.success(
				this.getTranslation('REPAIR_ORDERS_PAGE.ARRIVAL.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(repairOrder);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('REPAIR_ORDERS_PAGE.ARRIVAL.FAILED'),
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
