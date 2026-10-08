import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { ID, IInspection, InspectionFindingResultEnum, InspectionStatusEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { InspectionApiService } from './inspection-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-inspection-detail',
	templateUrl: './inspection-detail.component.html',
	styleUrls: ['./inspection-detail.component.scss'],
	standalone: false
})
export class InspectionDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public inspection: IInspection;
	public loading = false;
	public notFound = false;
	public readonly statuses = InspectionStatusEnum;
	public readonly results = InspectionFindingResultEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: InspectionApiService,
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

	/** Loads the inspection by id, including its findings. */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.inspection = await this.api.getById(id, ['findings', 'repairOrder', 'vehicle', 'technician']);
		} catch (error) {
			this.notFound = true;
			this.inspection = undefined;
			this.toastrService.danger(
				this.getTranslation('INSPECTIONS_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Starts the inspection (DRAFT → IN_PROGRESS) via the authoritative backend action. */
	async start(): Promise<void> {
		if (!this.canStart()) {
			return;
		}
		await this.runLifecycle(() => this.api.start(this.inspection.id));
	}

	/** Completes the inspection (IN_PROGRESS → COMPLETED) via the authoritative backend action. */
	async complete(): Promise<void> {
		if (!this.canComplete()) {
			return;
		}
		await this.runLifecycle(() => this.api.complete(this.inspection.id));
	}

	/** Runs a lifecycle action and surfaces success/error via the existing toastr pattern. */
	private async runLifecycle(action: () => Promise<IInspection>): Promise<void> {
		try {
			this.inspection = await action();
			this.toastrService.success(
				this.getTranslation('INSPECTIONS_PAGE.DETAIL.ACTION_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('INSPECTIONS_PAGE.DETAIL.ACTION_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/** Start is only allowed from DRAFT. */
	canStart(): boolean {
		return this.inspection?.status === InspectionStatusEnum.DRAFT;
	}

	/** Complete is only allowed from IN_PROGRESS. */
	canComplete(): boolean {
		return this.inspection?.status === InspectionStatusEnum.IN_PROGRESS;
	}

	/** The inspection's findings (read-only after creation). */
	get findings() {
		return this.inspection?.['findings'] ?? [];
	}

	/** Technician display label from the related employee record. */
	get technicianLabel(): string {
		const technician = this.inspection?.['technician'];
		const user = technician?.['user'];
		return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || technician?.['id'] || '';
	}

	/** Vehicle display label from the related vehicle record. */
	get vehicleLabel(): string {
		const vehicle = this.inspection?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Navigates back to the originating repair order. */
	back(): void {
		const repairOrderId = this.inspection?.repairOrderId;
		if (repairOrderId) {
			this.router.navigate(['/pages/repair-orders', repairOrderId]);
		} else {
			this.router.navigate(['/pages/repair-orders']);
		}
	}

	/** Status badge color for the current inspection status. */
	get statusBadgeStatus(): string {
		switch (this.inspection?.status) {
			case InspectionStatusEnum.COMPLETED:
				return 'success';
			case InspectionStatusEnum.IN_PROGRESS:
				return 'info';
			case InspectionStatusEnum.DRAFT:
			default:
				return 'basic';
		}
	}

	/** Finding result badge color. */
	findingBadgeStatus(result: InspectionFindingResultEnum): string {
		return result === InspectionFindingResultEnum.ATTENTION ? 'warning' : 'success';
	}

	ngOnDestroy(): void {}
}
