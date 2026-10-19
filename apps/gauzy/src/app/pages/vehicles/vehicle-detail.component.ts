import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { ID, IServiceHistoryRecord, IVehicle, PermissionsEnum, RepairOrderStatusEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { RepairOrderApiService } from '../repair-orders/repair-order-api.service';
import { VehicleApiService } from './vehicle-api.service';
import { VehicleMutationComponent } from './vehicle-mutation.component';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vehicle-detail',
	templateUrl: './vehicle-detail.component.html',
	styleUrls: ['./vehicle-detail.component.scss'],
	standalone: false
})
export class VehicleDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public vehicle: IVehicle;
	public serviceHistory: IServiceHistoryRecord[] = [];
	public canViewServiceHistory = false;
	public serviceHistoryError: string | null = null;
	public loading = false;
	public historyLoading = false;
	public notFound = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: VehicleApiService,
		private readonly repairOrderApi: RepairOrderApiService,
		private readonly toastrService: NbToastrService,
		private readonly dialogService: NbDialogService,
		private readonly permissions: NgxPermissionsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.paramMap
			.pipe(
				filter((params) => !!params.get('id')),
				tap(() => (this.loading = true)),
				tap(async (params) => await this.load(params.get('id'))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads the vehicle by id; a missing/invalid id surfaces as not-found.
	 * Also loads the read-only service history for the vehicle.
	 */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.vehicle = await this.api.getById(id);
			await this.loadServiceHistory(id);
		} catch (error) {
			this.notFound = true;
			this.vehicle = undefined;
			this.toastrService.danger(
				this.getTranslation('VEHICLES_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Loads the read-only service history records for this vehicle.
	 * History failures do not mark the vehicle itself as not-found.
	 */
	private async loadServiceHistory(id: ID): Promise<void> {
		this.historyLoading = true;
		this.serviceHistoryError = null;
		try {
			this.canViewServiceHistory = await this.permissions.hasPermission(PermissionsEnum.ORG_REPAIR_ORDER_VIEW);
			if (!this.canViewServiceHistory) {
				this.serviceHistory = [];
				return;
			}
			this.serviceHistory = await this.repairOrderApi.getVehicleServiceHistory(id);
		} catch (error) {
			this.serviceHistory = [];
			this.serviceHistoryError = error?.error?.message || error?.message || this.getTranslation('VEHICLES_PAGE.HISTORY.LOAD_FAILED');
			this.toastrService.danger(
				this.serviceHistoryError,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.historyLoading = false;
		}
	}

	async reloadServiceHistory(): Promise<void> {
		if (!this.vehicle) {
			return;
		}
		await this.loadServiceHistory(this.vehicle.id);
	}

	/**
	 * Opens the edit dialog for this vehicle (ALL_ORG_EDIT-gated in the template)
	 * and refreshes the page data after a successful update.
	 */
	async edit(): Promise<void> {
		if (!this.vehicle) {
			return;
		}
		const dialogRef = this.dialogService.open(VehicleMutationComponent, {
			context: { vehicle: this.vehicle }
		});
		const vehicle: IVehicle = await firstValueFrom(dialogRef.onClose);
		if (vehicle) {
			this.vehicle = vehicle;
		}
	}

	/** Vehicle display title (year make model, falling back to the VIN). */
	get vehicleTitle(): string {
		if (!this.vehicle) {
			return '';
		}
		const parts = [this.vehicle.year, this.vehicle.make, this.vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : (this.vehicle.vinNormalized ?? '');
	}

	/** Returns to the vehicle list. */
	back(): void {
		this.router.navigate(['/pages/vehicles']);
	}

	/** Status badge color for a service-history repair order status. */
	historyBadgeStatus(status: RepairOrderStatusEnum): string {
		switch (status) {
			case RepairOrderStatusEnum.READY:
				return 'success';
			case RepairOrderStatusEnum.IN_PROGRESS:
				return 'info';
			case RepairOrderStatusEnum.CLOSED:
				return 'primary';
			case RepairOrderStatusEnum.CANCELLED:
				return 'danger';
			default:
				return 'basic';
		}
	}

	ngOnDestroy(): void {}
}
