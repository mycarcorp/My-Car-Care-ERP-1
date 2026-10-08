import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { EstimateStatusEnum, ID, IEstimate } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EstimateApiService } from './estimate-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-estimate-detail',
	templateUrl: './estimate-detail.component.html',
	styleUrls: ['./estimate-detail.component.scss'],
	standalone: false
})
export class EstimateDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public estimate: IEstimate;
	public loading = false;
	public notFound = false;
	public readonly statuses = EstimateStatusEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: EstimateApiService,
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
	 * Loads the estimate by id, including its line items via the `lines` relation.
	 * A missing/invalid id surfaces as not-found.
	 */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.estimate = await this.api.getById(id, ['lines', 'repairOrder']);
		} catch (error) {
			this.notFound = true;
			this.estimate = undefined;
			this.toastrService.danger(
				this.getTranslation('ESTIMATES_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Finalizes the estimate (DRAFT → FINALIZED) via the authoritative backend action.
	 */
	async finalize(): Promise<void> {
		if (!this.canFinalize()) {
			return;
		}
		await this.runLifecycle(() => this.api.finalize(this.estimate.id));
	}

	/**
	 * Sends the estimate (FINALIZED → SENT) via the authoritative backend action.
	 */
	async send(): Promise<void> {
		if (!this.canSend()) {
			return;
		}
		await this.runLifecycle(() => this.api.send(this.estimate.id));
	}

	/**
	 * Runs a lifecycle action and surfaces success/error via the existing toastr pattern.
	 */
	private async runLifecycle(action: () => Promise<IEstimate>): Promise<void> {
		try {
			this.estimate = await action();
			this.toastrService.success(
				this.getTranslation('ESTIMATES_PAGE.DETAIL.ACTION_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('ESTIMATES_PAGE.DETAIL.ACTION_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/** Only DRAFT estimates are editable. */
	isEditable(): boolean {
		return this.estimate?.status === EstimateStatusEnum.DRAFT;
	}

	/** Finalize is only allowed from DRAFT. */
	canFinalize(): boolean {
		return this.estimate?.status === EstimateStatusEnum.DRAFT;
	}

	/** Send is only allowed from FINALIZED. */
	canSend(): boolean {
		return this.estimate?.status === EstimateStatusEnum.FINALIZED;
	}

	/** The estimate's line items (loaded via the `lines` relation). */
	get lines() {
		return this.estimate?.['lines'] ?? [];
	}

	/** Vehicle display label from the related repair order's vehicle record. */
	get vehicleLabel(): string {
		const vehicle = this.estimate?.['repairOrder']?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Returns to the estimate list. */
	back(): void {
		this.router.navigate(['/pages/estimates']);
	}

	/** Status badge color for the current estimate status. */
	get statusBadgeStatus(): string {
		switch (this.estimate?.status) {
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
