import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	FinancingApplicationStatusEnum,
	ID,
	IFinancingApplication,
	IOrganization
} from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { ServerDataSource, Store } from '@gauzy/ui-core/core';
import { PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';

/**
 * Financing applications list (`/pages/financing`). Server-backed smart table scoped to the
 * current tenant/organization with a status filter. Row click opens the detail view.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-financing-list',
	templateUrl: './financing-list.component.html',
	styleUrls: ['./financing-list.component.scss'],
	standalone: false
})
export class FinancingListComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSource: ServerDataSource;
	public applications: IFinancingApplication[] = [];
	public loading = false;
	public organization: IOrganization;
	public statusFilter: FinancingApplicationStatusEnum | '' = '';
	public readonly statuses = Object.values(FinancingApplicationStatusEnum);

	constructor(
		public readonly translateService: TranslateService,
		private readonly http: HttpClient,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly router: Router
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
				tap(() => this.getApplications()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Builds the server-backed data source scoped to tenant/organization and the status filter. */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/financing`,
			relations: ['customer', 'vehicle', 'repairOrder'],
			where: {
				organizationId,
				tenantId,
				...(this.statusFilter ? { status: this.statusFilter } : {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (application: IFinancingApplication) =>
				Object.assign({}, application, {
					customerName: application['customer']?.name ?? '',
					vehicleLabel: this.formatVehicle(application),
					repairOrderNumber: application['repairOrder']?.repairOrderNumber ?? ''
				}),
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/** Applies the status filter and reloads the list. */
	onStatusChange(status: FinancingApplicationStatusEnum | ''): void {
		this.statusFilter = status;
		this.getApplications();
	}

	/** Loads the current page of financing applications from the server-backed source. */
	async getApplications(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.setSmartTableSource();
			this.smartTableSource.setPaging(this.pagination.activePage, this.pagination.itemsPerPage, false);
			this.applications = await this.smartTableSource.getElements();
		} catch (error) {
			this.toastrService.danger(error?.message || 'Failed to load financing applications.', 'Error');
		} finally {
			this.loading = false;
		}
	}

	/** Pagination change reloads the list. */
	onPageChange(): void {
		this.getApplications();
	}

	/** Navigates to the financing application detail page. */
	view(application: IFinancingApplication): void {
		this.router.navigate(['/pages/financing', application.id]);
	}

	/** Vehicle display label (year make model, falling back to VIN). */
	formatVehicle(application: IFinancingApplication): string {
		const vehicle = application?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	ngOnDestroy(): void {}
}
