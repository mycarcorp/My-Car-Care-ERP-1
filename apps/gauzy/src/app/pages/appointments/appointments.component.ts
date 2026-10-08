import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmployeeAppointmentStatus, IEmployeeAppointment, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { EmployeeAppointmentService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { AppointmentMutationComponent } from './appointment-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-appointments',
	templateUrl: './appointments.component.html',
	styleUrls: ['./appointments.component.scss'],
	standalone: false
})
export class AppointmentsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public appointments: IEmployeeAppointment[] = [];
	public loading = false;
	public organization: IOrganization;
	public readonly statuses = EmployeeAppointmentStatus;

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly appointmentService: EmployeeAppointmentService,
		private readonly toastrService: NbToastrService,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getAppointments()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads the current organization/tenant's appointments with customer/vehicle relations.
	 * Scoped to the current tenant/organization via the backend's tenant-aware query.
	 */
	async getAppointments(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const { items } = await firstValueFrom(
				this.appointmentService.getAll(['customer', 'vehicle', 'employee'])
			);
			this.appointments = items ?? [];
		} catch (error) {
			this.toastrService.danger(
				error?.message || this.getTranslation('APPOINTMENTS_PAGE.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Opens the "New Appointment" dialog and refreshes the list after a successful creation. */
	async createAppointment(): Promise<void> {
		const dialogRef = this.dialogService.open(AppointmentMutationComponent);
		const appointment: IEmployeeAppointment = await firstValueFrom(dialogRef.onClose);
		if (appointment) {
			await this.getAppointments();
		}
	}

	/** Vehicle display label from the related vehicle record. */
	vehicleLabel(appointment: IEmployeeAppointment): string {
		const vehicle = appointment?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Advisor display label from the related employee record. */
	advisorLabel(appointment: IEmployeeAppointment): string {
		const user = appointment?.['employee']?.['user'];
		return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
	}

	/** Status badge color. */
	badgeStatus(status: EmployeeAppointmentStatus): string {
		switch (status) {
			case EmployeeAppointmentStatus.COMPLETED:
				return 'success';
			case EmployeeAppointmentStatus.CANCELLED:
				return 'danger';
			case EmployeeAppointmentStatus.SCHEDULED:
			default:
				return 'info';
		}
	}

	ngOnDestroy(): void {}
}
