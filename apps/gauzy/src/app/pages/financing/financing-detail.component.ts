import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { filter, tap } from 'rxjs/operators';
import {
	FinancingApplicationStatusEnum,
	ID,
	IFinancingApplication,
	PermissionsEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FinancingApiService } from './financing-api.service';

/**
 * Financing application detail (`/pages/financing/:id`). Shows the application data and related
 * records the API provides (customer/vehicle/repair order/estimate), and exposes lifecycle
 * transition actions restricted to valid backend transitions and the caller's permissions.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-financing-detail',
	templateUrl: './financing-detail.component.html',
	styleUrls: ['./financing-detail.component.scss'],
	standalone: false
})
export class FinancingDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public application: IFinancingApplication;
	public loading = false;
	public notFound = false;
	public fundingInProgress = false;
	public readonly statuses = FinancingApplicationStatusEnum;

	public canEdit = false;
	public canApprove = false;

	private readonly permissions = inject(NgxPermissionsService);

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: FinancingApiService,
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
		this.loadPermissions();
	}

	/** Loads the caller's edit/approve permissions (transition route admits EDIT or APPROVE). */
	private async loadPermissions(): Promise<void> {
		this.canEdit = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_FINANCING_EDIT
		]);
		this.canApprove = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_FINANCING_APPROVE
		]);
	}

	/** Loads the application by id, including its related records. */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.application = await this.api.getById(id, ['customer', 'vehicle', 'repairOrder', 'estimate']);
		} catch (error) {
			this.notFound = true;
			this.application = undefined;
			this.toastrService.danger(
				this.getTranslation('FINANCING_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Applies a lifecycle transition through the authoritative backend action. `approvedAmount`
	 * and `rejectionReason` are only sent for APPROVED/DECLINED decisions respectively; the
	 * backend ignores them for every other target.
	 */
	private async transition(
		to: FinancingApplicationStatusEnum,
		payload: { approvedAmount?: number; rejectionReason?: string } = {}
	): Promise<void> {
		try {
			this.application = await this.api.transition(this.application.id, { status: to, ...payload });
			this.toastrService.success(
				this.getTranslation('FINANCING_PAGE.DETAIL.ACTION_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('FINANCING_PAGE.DETAIL.ACTION_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/** DRAFT → SUBMITTED. */
	async submit(): Promise<void> {
		if (!this.canSubmit()) return;
		await this.transition(FinancingApplicationStatusEnum.SUBMITTED);
	}

	/** SUBMITTED → PENDING (sent to the provider for review). */
	async markPending(): Promise<void> {
		if (!this.canMarkPending()) return;
		await this.transition(FinancingApplicationStatusEnum.PENDING);
	}

	/** PENDING → APPROVED, capturing the approved amount. Approver-only. */
	async approve(): Promise<void> {
		if (!this.canDecide()) return;
		const raw = window.prompt(
			this.getTranslation('FINANCING_PAGE.DETAIL.APPROVED_AMOUNT_PROMPT'),
			String(this.application?.requestedAmount ?? '')
		);
		if (raw === null) return;
		const approvedAmount = Number(raw);
		if (!Number.isFinite(approvedAmount) || approvedAmount < 0) {
			this.toastrService.warning(
				this.getTranslation('FINANCING_PAGE.DETAIL.INVALID_AMOUNT'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		await this.transition(FinancingApplicationStatusEnum.APPROVED, { approvedAmount });
	}

	/** PENDING → DECLINED, capturing the rejection reason. Approver-only. */
	async decline(): Promise<void> {
		if (!this.canDecide()) return;
		const reason = window.prompt(this.getTranslation('FINANCING_PAGE.DETAIL.REJECTION_REASON_PROMPT'));
		if (reason === null) return;
		await this.transition(FinancingApplicationStatusEnum.DECLINED, { rejectionReason: reason.trim() || undefined });
	}

	/** APPROVED → ACCEPTED (customer accepts the offer). */
	async accept(): Promise<void> {
		if (!this.canAccept()) return;
		await this.transition(FinancingApplicationStatusEnum.ACCEPTED);
	}

	/**
	 * ACCEPTED → FUNDED: records the funding payment against the repair order's invoice,
	 * settling its remaining balance. Approver-only. Confirms before submitting, guards
	 * against repeat submission while running, and refreshes the application on success.
	 */
	async fund(): Promise<void> {
		if (!this.canFund() || this.fundingInProgress) return;
		if (!window.confirm(this.getTranslation('FINANCING_PAGE.DETAIL.CONFIRM_FUND'))) return;
		this.fundingInProgress = true;
		try {
			this.application = await this.api.fund(this.application.id);
			this.toastrService.success(
				this.getTranslation('FINANCING_PAGE.DETAIL.FUND_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('FINANCING_PAGE.DETAIL.FUND_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.fundingInProgress = false;
		}
	}

	/** Cancel from any active status. */
	async cancel(): Promise<void> {
		if (!this.canCancel()) return;
		if (!window.confirm(this.getTranslation('FINANCING_PAGE.DETAIL.CONFIRM_CANCEL'))) return;
		await this.transition(FinancingApplicationStatusEnum.CANCELLED);
	}

	/** Submit allowed from DRAFT. */
	canSubmit(): boolean {
		return this.canEdit && this.application?.status === FinancingApplicationStatusEnum.DRAFT;
	}

	/** Mark-pending allowed from SUBMITTED. */
	canMarkPending(): boolean {
		return this.canEdit && this.application?.status === FinancingApplicationStatusEnum.SUBMITTED;
	}

	/** Decisions (approve/decline) allowed from PENDING and require APPROVE. */
	canDecide(): boolean {
		return this.canApprove && this.application?.status === FinancingApplicationStatusEnum.PENDING;
	}

	/** Accept allowed from APPROVED. */
	canAccept(): boolean {
		return this.canEdit && this.application?.status === FinancingApplicationStatusEnum.APPROVED;
	}

	/** Fund allowed only from ACCEPTED and requires the APPROVE (decision) permission. */
	canFund(): boolean {
		return this.canApprove && this.application?.status === FinancingApplicationStatusEnum.ACCEPTED;
	}

	/** Cancel allowed from any active (non-terminal) status. */
	canCancel(): boolean {
		return (
			this.canEdit &&
			[
				FinancingApplicationStatusEnum.DRAFT,
				FinancingApplicationStatusEnum.SUBMITTED,
				FinancingApplicationStatusEnum.PENDING,
				FinancingApplicationStatusEnum.APPROVED
			].includes(this.application?.status)
		);
	}

	/** Customer display label. */
	get customerLabel(): string {
		return this.application?.['customer']?.name ?? '';
	}

	/** Vehicle display label (year make model, falling back to VIN). */
	get vehicleLabel(): string {
		const vehicle = this.application?.['vehicle'];
		if (!vehicle) return '';
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.length ? parts.join(' ') : vehicle.vinNormalized ?? '';
	}

	/** Repair order display label. */
	get repairOrderLabel(): string {
		return this.application?.['repairOrder']?.repairOrderNumber ?? this.application?.repairOrderId ?? '';
	}

	/** Navigates to the originating repair order. */
	openRepairOrder(): void {
		const repairOrderId = this.application?.repairOrderId;
		if (repairOrderId) {
			this.router.navigate(['/pages/repair-orders', repairOrderId]);
		}
	}

	/** Navigates back to the financing list. */
	back(): void {
		this.router.navigate(['/pages/financing']);
	}

	/** Status badge color for the current application status. */
	get statusBadgeStatus(): string {
		switch (this.application?.status) {
			case FinancingApplicationStatusEnum.ACCEPTED:
			case FinancingApplicationStatusEnum.APPROVED:
				return 'success';
			case FinancingApplicationStatusEnum.PENDING:
			case FinancingApplicationStatusEnum.SUBMITTED:
				return 'info';
			case FinancingApplicationStatusEnum.DECLINED:
			case FinancingApplicationStatusEnum.CANCELLED:
				return 'danger';
			case FinancingApplicationStatusEnum.DRAFT:
			default:
				return 'basic';
		}
	}

	ngOnDestroy(): void {}
}
