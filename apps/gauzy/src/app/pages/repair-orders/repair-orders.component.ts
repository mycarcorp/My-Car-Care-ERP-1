import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Cell } from 'angular2-smart-table';
import { ID, IOrganization, IRepairOrder, RepairOrderStatusEnum } from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { ServerDataSource, Store } from '@gauzy/ui-core/core';
import { PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { RepairOrderArrivalComponent } from './repair-order-arrival.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-repair-orders',
	templateUrl: './repair-orders.component.html',
	styleUrls: ['./repair-orders.component.scss'],
	standalone: false
})
export class RepairOrdersComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSource: ServerDataSource;
	public settingsSmartTable: object;
	public repairOrders: IRepairOrder[] = [];
	public loading = false;
	public organization: IOrganization;
	public statusFilter: RepairOrderStatusEnum | '' = '';
	public readonly statuses = Object.values(RepairOrderStatusEnum);

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
				tap(() => this.getRepairOrders()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Builds the server-backed data source for the repair order list, scoped to the
	 * current tenant/organization and the active status filter.
	 */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/repair-orders`,
			relations: ['customer', 'vehicle'],
			where: {
				organizationId,
				tenantId,
				...(this.statusFilter ? { status: this.statusFilter } : {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (repairOrder: IRepairOrder) =>
				Object.assign({}, repairOrder, {
					customerName: repairOrder['customer']?.name ?? '',
					vehicleLabel: this.formatVehicle(repairOrder)
				}),
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * Configures the smart-table columns (RO number, customer, vehicle, status, arrival, created).
	 */
	private _loadSmartTableSettings(): void {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				repairOrderNumber: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.RO_NUMBER'),
					type: 'string'
				},
				customerName: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.CUSTOMER'),
					type: 'string',
					valuePrepareFunction: (_value: string, cell: Cell) => cell['customer']?.name ?? ''
				},
				vehicleLabel: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.VEHICLE'),
					type: 'string',
					valuePrepareFunction: (_value: string, cell: Cell) =>
						this.formatVehicle(cell as unknown as IRepairOrder)
				},
				status: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.STATUS'),
					type: 'string'
				},
				arrivedAt: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.ARRIVED'),
					type: 'string',
					valuePrepareFunction: (value: string) => (value ? new Date(value).toLocaleString() : '')
				},
				createdAt: {
					title: this.getTranslation('REPAIR_ORDERS_PAGE.CREATED'),
					type: 'string',
					valuePrepareFunction: (value: string) => (value ? new Date(value).toLocaleDateString() : '')
				}
			}
		};
	}

	/**
	 * Formats the vehicle column from the related vehicle record.
	 */
	private formatVehicle(repairOrder: IRepairOrder): string {
		const vehicle = repairOrder['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : (vehicle.vinNormalized ?? '');
	}

	/**
	 * Applies the status filter and reloads the list.
	 */
	onStatusChange(status: RepairOrderStatusEnum | ''): void {
		this.statusFilter = status;
		this.getRepairOrders();
	}

	/**
	 * Searches repair orders by RO number using the backend-supported where clause.
	 */
	onSearch(term: string): void {
		this.setFilter([{ field: 'repairOrderNumber', search: term }], true);
		this.getRepairOrders();
	}

	/**
	 * Loads the current page of repair orders from the server-backed source.
	 */
	async getRepairOrders(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.setSmartTableSource();
			this.smartTableSource.setPaging(this.pagination.activePage, this.pagination.itemsPerPage, false);
			this.repairOrders = await this.smartTableSource.getElements();
		} catch (error) {
			this.toastrService.danger(error?.message || 'Failed to load repair orders.', 'Error');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Opens the "Vehicle Arrival / Check-In" dialog and refreshes the list after a
	 * successful arrival.
	 */
	async openArrival(): Promise<void> {
		const dialogRef = this.dialogService.open(RepairOrderArrivalComponent);
		const repairOrder: IRepairOrder = await firstValueFrom(dialogRef.onClose);
		if (repairOrder) {
			await this.getRepairOrders();
		}
	}

	/**
	 * Navigates to the repair order detail page (the only row action for the list).
	 */
	view(repairOrder: IRepairOrder): void {
		this.router.navigate(['/pages/repair-orders', repairOrder.id]);
	}

	ngOnDestroy(): void {}
}
