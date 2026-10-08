import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { ID, IInspection, IRepairOrder, RepairOrderStatusEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { RepairOrderApiService } from './repair-order-api.service';
import { InspectionApiService } from '../inspections/inspection-api.service';
import { InspectionMutationComponent } from '../inspections/inspection-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-repair-order-detail',
	templateUrl: './repair-order-detail.component.html',
	styleUrls: ['./repair-order-detail.component.scss'],
	standalone: false
})
export class RepairOrderDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public repairOrder: IRepairOrder;
	public loading = false;
	public notFound = false;
	public readonly statuses = RepairOrderStatusEnum;

	private readonly dialogService = inject(NbDialogService);
	private readonly inspectionApi = inject(InspectionApiService);

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: RepairOrderApiService,
		private readonly toastrService: NbToastrService
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
	 * Loads the repair order by id; a missing/invalid id surfaces as not-found.
	 */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.repairOrder = await this.api.getById(id);
		} catch (error) {
			this.notFound = true;
			this.repairOrder = undefined;
			this.toastrService.danger(
				this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Closes the repair order (READY → CLOSED) via the authoritative backend action.
	 */
	async close(): Promise<void> {
		if (!this.canClose()) {
			return;
		}
		await this.runLifecycle(() => this.api.close(this.repairOrder.id, {}));
	}

	/**
	 * Cancels the repair order via the authoritative backend action (with confirmation).
	 */
	async cancel(): Promise<void> {
		if (!this.canCancel()) {
			return;
		}
		const reason = window.prompt(this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.CANCEL_REASON_PROMPT'));
		if (!reason || !reason.trim()) {
			return;
		}
		if (!window.confirm(this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.CONFIRM_CANCEL'))) {
			return;
		}
		await this.runLifecycle(() => this.api.cancel(this.repairOrder.id, { cancelReason: reason.trim() }));
	}

	/**
	 * Generates the DRAFT invoice for this repair order via the authoritative backend action.
	 */
	async generateInvoice(): Promise<void> {
		if (!this.canGenerateInvoice()) {
			return;
		}
		try {
			await this.api.generateInvoice(this.repairOrder.id);
			this.toastrService.success(
				this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.INVOICE_GENERATED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.INVOICE_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/**
	 * Runs a lifecycle action and surfaces success/error via the existing toastr pattern.
	 */
	private async runLifecycle(action: () => Promise<IRepairOrder>): Promise<void> {
		try {
			this.repairOrder = await action();
			this.toastrService.success(
				this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.ACTION_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('REPAIR_ORDERS_PAGE.DETAIL.ACTION_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/** Close is only allowed from READY. */
	canClose(): boolean {
		return this.repairOrder?.status === RepairOrderStatusEnum.READY;
	}

	/** Cancel is allowed from OPEN, IN_PROGRESS, or READY (non-terminal). */
	canCancel(): boolean {
		return [
			RepairOrderStatusEnum.OPEN,
			RepairOrderStatusEnum.IN_PROGRESS,
			RepairOrderStatusEnum.READY
		].includes(this.repairOrder?.status);
	}

	/** Invoice generation is allowed once the RO is READY or CLOSED. */
	canGenerateInvoice(): boolean {
		return [RepairOrderStatusEnum.READY, RepairOrderStatusEnum.CLOSED].includes(this.repairOrder?.status);
	}

	/** Vehicle display label from the related vehicle record. */
	get vehicleLabel(): string {
		const vehicle = this.repairOrder?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Navigates to the existing Job Board for this repair order. */
	openJobBoard(): void {
		this.router.navigate(['/pages/automotive-jobs', this.repairOrder.id]);
	}

	/**
	 * Opens the Inspection for this repair order: navigates to the existing inspection if one
	 * exists, otherwise opens the creation dialog pre-filled with the RO context. Does not
	 * create a duplicate inspection.
	 */
	async openInspection(): Promise<void> {
		if (!this.repairOrder?.id) {
			return;
		}
		try {
			const existing = await this.inspectionApi.getByRepairOrder(this.repairOrder.id);
			if (existing?.id) {
				this.router.navigate(['/pages/inspections', existing.id]);
				return;
			}
		} catch (error) {
			// 404 / not-found simply means no inspection exists yet — fall through to create.
			if (error?.status && error.status !== 404) {
				this.toastrService.danger(
					error?.error?.message || this.getTranslation('INSPECTIONS_PAGE.LOAD_FAILED'),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
				return;
			}
		}
		const dialogRef = this.dialogService.open(InspectionMutationComponent, {
			context: {
				repairOrderId: this.repairOrder.id,
				vehicleId: this.repairOrder.vehicleId,
				technicianEmployeeId: this.repairOrder.serviceAdvisorEmployeeId
			}
		});
		const inspection: IInspection = await firstValueFrom(dialogRef.onClose);
		if (inspection?.id) {
			this.router.navigate(['/pages/inspections', inspection.id]);
		}
	}

	/** Returns to the repair order list. */
	back(): void {
		this.router.navigate(['/pages/repair-orders']);
	}

	/** Status badge color for the current RO status. */
	get statusBadgeStatus(): string {
		switch (this.repairOrder?.status) {
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
