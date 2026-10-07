import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { ID, IOrganization, IVehicle } from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { ServerDataSource, Store } from '@gauzy/ui-core/core';
import { PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { VehicleMutationComponent } from './vehicle-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vehicles',
	templateUrl: './vehicles.component.html',
	styleUrls: ['./vehicles.component.scss'],
	standalone: false
})
export class VehiclesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSource: ServerDataSource;
	public settingsSmartTable: object;
	public vehicles: IVehicle[] = [];
	public loading = false;
	public organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly http: HttpClient,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly dialogService: NbDialogService,
		private readonly router: Router
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.setSmartTableSource()),
				tap(() => this.getVehicles()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Builds the server-backed data source for the vehicle list, scoped to the
	 * current tenant/organization, with the customer relation loaded for display.
	 */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/vehicles/pagination`,
			relations: ['customer'],
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (vehicle: IVehicle) =>
				Object.assign({}, vehicle, {
					customerName: vehicle['customer']?.name ?? ''
				}),
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * Configures the smart-table columns (VIN, year, make, model, plate, customer, created).
	 */
	private _loadSmartTableSettings(): void {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				vinNormalized: {
					title: this.getTranslation('VEHICLES_PAGE.VIN'),
					type: 'string'
				},
				year: {
					title: this.getTranslation('VEHICLES_PAGE.YEAR'),
					type: 'string'
				},
				make: {
					title: this.getTranslation('VEHICLES_PAGE.MAKE'),
					type: 'string'
				},
				model: {
					title: this.getTranslation('VEHICLES_PAGE.MODEL'),
					type: 'string'
				},
				plate: {
					title: this.getTranslation('VEHICLES_PAGE.PLATE'),
					type: 'string'
				},
				customerName: {
					title: this.getTranslation('VEHICLES_PAGE.CUSTOMER'),
					type: 'string',
					valuePrepareFunction: (_value: string, cell: any) => cell['customer']?.name ?? ''
				},
				createdAt: {
					title: this.getTranslation('VEHICLES_PAGE.CREATED'),
					type: 'string',
					valuePrepareFunction: (value: string) => (value ? new Date(value).toLocaleDateString() : '')
				}
			}
		};
	}

	/**
	 * Searches vehicles by VIN using the backend-supported where clause.
	 */
	onSearch(term: string): void {
		this.setFilter([{ field: 'vinNormalized', search: term }], true);
		this.getVehicles();
	}

	/**
	 * Loads the current page of vehicles from the server-backed source.
	 */
	async getVehicles(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.setSmartTableSource();
			this.smartTableSource.setPaging(this.pagination.activePage, this.pagination.itemsPerPage, false);
			this.vehicles = await this.smartTableSource.getElements();
		} catch (error) {
			this.toastrService.danger(error?.message || 'Failed to load vehicles.', 'Error');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Opens the "Register Vehicle" dialog and refreshes the list after a
	 * successful registration.
	 */
	async registerVehicle(): Promise<void> {
		const dialogRef = this.dialogService.open(VehicleMutationComponent);
		const vehicle: IVehicle = await firstValueFrom(dialogRef.onClose);
		if (vehicle) {
			await this.getVehicles();
		}
	}

	/**
	 * Navigates to the vehicle detail page (the only row action for the list).
	 */
	view(vehicle: IVehicle): void {
		this.router.navigate(['/pages/vehicles', vehicle.id]);
	}

	ngOnDestroy(): void {}
}
