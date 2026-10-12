import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ContactType, IOrganization, IOrganizationContact, IVehicle } from '@gauzy/contracts';
import { OrganizationContactService, Store } from '@gauzy/ui-core/core';
import { VehicleApiService } from './vehicle-api.service';

/**
 * "Register / Edit Vehicle" dialog: minimal registration form (VIN, year, make,
 * model, customer, plate, color, mileage) backed by the authoritative vehicle
 * endpoints (`POST /vehicles`, `PUT /vehicles/:id`, both ALL_ORG_EDIT). When a
 * `vehicle` is passed via the dialog context the dialog edits it; otherwise it
 * registers a new vehicle.
 */
@Component({
	selector: 'ga-vehicle-mutation',
	templateUrl: './vehicle-mutation.component.html',
	styleUrls: ['./vehicle-mutation.component.scss'],
	standalone: false
})
export class VehicleMutationComponent implements OnInit {
	public vehicle: IVehicle;
	public customers: IOrganizationContact[] = [];
	public vinNormalized: string;
	public year: number;
	public make: string;
	public model: string;
	public customerId: string;
	public plate: string;
	public color: string;
	public currentMileage: number;
	public loading = false;
	public submitting = false;
	public organization: IOrganization;

	private readonly dialogRef = inject<NbDialogRef<VehicleMutationComponent>>(NbDialogRef);
	private readonly api = inject(VehicleApiService);
	private readonly organizationContactService = inject(OrganizationContactService);
	private readonly store = inject(Store);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	/**
	 * Translates a key using the current language.
	 */
	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	/** True when editing an existing vehicle (passed via dialog context). */
	get isEdit(): boolean {
		return !!this.vehicle?.id;
	}

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		if (this.vehicle) {
			this.vinNormalized = this.vehicle.vinNormalized;
			this.year = this.vehicle.year;
			this.make = this.vehicle.make;
			this.model = this.vehicle.model;
			this.customerId = this.vehicle.customerId;
			this.plate = this.vehicle.plate;
			this.color = this.vehicle.color;
			this.currentMileage = this.vehicle.currentMileage;
		}
		this.loadCustomers();
	}

	/**
	 * Loads the current organization/tenant's contacts of type CUSTOMER for the
	 * required customer select.
	 */
	private async loadCustomers(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		try {
			const { items } = await this.organizationContactService.getAll([], {
				organizationId,
				tenantId,
				contactType: ContactType.CUSTOMER
			});
			this.customers = items ?? [];
		} catch (error) {
			this.toastr.danger(
				error?.message || this.getTranslation('VEHICLES_PAGE.MUTATION.LOAD_CUSTOMERS_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Submits the form: validates required fields, creates or updates the vehicle,
	 * and closes the dialog with the resulting record.
	 */
	async submit(): Promise<void> {
		if (!this.vinNormalized?.trim() || !this.model?.trim() || !this.customerId) {
			this.toastr.warning(
				this.getTranslation('VEHICLES_PAGE.MUTATION.REQUIRED_FIELDS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const body: Partial<IVehicle> = {
			organizationId,
			tenantId,
			vinNormalized: this.vinNormalized.trim(),
			make: this.make?.trim(),
			model: this.model.trim(),
			customerId: this.customerId
		};
		if (this.year !== undefined && this.year !== null && !Number.isNaN(Number(this.year))) {
			body.year = Number(this.year);
		}
		if (this.plate?.trim()) {
			body.plate = this.plate.trim();
		}
		if (this.color?.trim()) {
			body.color = this.color.trim();
		}
		if (
			this.currentMileage !== undefined &&
			this.currentMileage !== null &&
			!Number.isNaN(Number(this.currentMileage))
		) {
			body.currentMileage = Number(this.currentMileage);
		}
		this.submitting = true;
		try {
			const vehicle: IVehicle = this.isEdit
				? await this.api.update(this.vehicle.id, body)
				: await this.api.create(body);
			this.toastr.success(
				this.getTranslation('VEHICLES_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(vehicle);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('VEHICLES_PAGE.MUTATION.FAILED'),
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
