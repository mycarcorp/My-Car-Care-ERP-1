import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EstimateStatusEnum, ID, IEstimate, IOrganization } from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import { ServerDataSource, Store } from '@gauzy/ui-core/core';
import { PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { EstimateMutationComponent } from './estimate-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-estimates',
	templateUrl: './estimates.component.html',
	styleUrls: ['./estimates.component.scss'],
	standalone: false
})
export class EstimatesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSource: ServerDataSource;
	public estimates: IEstimate[] = [];
	public loading = false;
	public organization: IOrganization;
	public readonly statuses = EstimateStatusEnum;

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
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getEstimates()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Builds the server-backed data source for the estimate list, scoped to the current
	 * tenant/organization, with customer/vehicle/repair-order relations loaded for display.
	 */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/estimates`,
			relations: ['repairOrder'],
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * Loads the current page of estimates from the server-backed source.
	 */
	async getEstimates(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.setSmartTableSource();
			this.smartTableSource.setPaging(this.pagination.activePage, this.pagination.itemsPerPage, false);
			this.estimates = await this.smartTableSource.getElements();
		} catch (error) {
			this.toastrService.danger(
				error?.message || this.getTranslation('ESTIMATES_PAGE.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Opens the "New Estimate" dialog and refreshes the list after a successful creation.
	 */
	async createEstimate(): Promise<void> {
		const dialogRef = this.dialogService.open(EstimateMutationComponent);
		const estimate: IEstimate = await firstValueFrom(dialogRef.onClose);
		if (estimate) {
			await this.getEstimates();
		}
	}

	/**
	 * Navigates to the estimate detail page (the only row action for the list).
	 */
	view(estimate: IEstimate): void {
		this.router.navigate(['/pages/estimates', estimate.id]);
	}

	/** Vehicle display label from the related repair order's vehicle record. */
	vehicleLabel(estimate: IEstimate): string {
		const vehicle = estimate?.['repairOrder']?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Status badge color for an estimate status. */
	badgeStatus(status: EstimateStatusEnum): string {
		switch (status) {
			case EstimateStatusEnum.SENT:
				return 'info';
			case EstimateStatusEnum.FINALIZED:
				return 'primary';
			case EstimateStatusEnum.SUPERSEDED:
			case EstimateStatusEnum.CANCELLED:
				return 'danger';
			case EstimateStatusEnum.DRAFT:
			default:
				return 'basic';
		}
	}

	ngOnDestroy(): void {}
}
