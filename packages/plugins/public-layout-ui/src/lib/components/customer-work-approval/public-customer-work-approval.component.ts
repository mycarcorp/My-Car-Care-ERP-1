import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	CustomerWorkApprovalRequestStatusEnum,
	EstimateLinePriorityEnum,
	ICustomerWorkApprovalConfirmationView,
	ICustomerWorkApprovalLine,
	ICustomerWorkApprovalPublicView,
	ICustomerWorkApprovalSubmitInput,
	IEstimateLine,
	ID
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { PublicCustomerWorkApprovalApiService } from './public-customer-work-approval-api.service';


type PageState = 'loading' | 'ready' | 'submitted' | 'error';

/**
 * Public, unauthenticated Customer Work Approval page (`/share/customer-work-approval/:requestId?token=…`).
 * The secure link itself is the credential: the raw token is read from the query string and
 * passed straight back to the public API. It is never persisted, stored, or logged.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-public-customer-work-approval',
	templateUrl: './public-customer-work-approval.component.html',
	styleUrls: ['./public-customer-work-approval.component.scss'],
	standalone: false
})
export class PublicCustomerWorkApprovalComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public state: PageState = 'loading';
	public requestId: ID;
	public token: string;
	public estimate: ICustomerWorkApprovalPublicView['estimate'];
	public lines: IEstimateLine[] = [];
	public revisionNumber: number;
	public expiresAt: Date;
	/** Map of estimateLineId → selected decision (all-or-nothing per line). */
	public decisions = new Map<string, boolean>();
	public confirmation: ICustomerWorkApprovalConfirmationView;
	public errorMessage = '';
	public submitting = false;
	public readonly priorities = EstimateLinePriorityEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly api: PublicCustomerWorkApprovalApiService,
		private readonly toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.paramMap
			.pipe(
				filter((params) => !!params.get('requestId')),
				tap((params) => (this.requestId = params.get('requestId'))),
				tap(() => {
					// Read the token from the query string once; it is the credential and is
					// passed back to the API on each call. Never persisted or logged.
					this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
				}),
				tap(async () => await this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Loads the active request's estimate + lines, or the confirmation if already submitted. */
	private async load(): Promise<void> {
		this.state = 'loading';
		try {
			const view = await this.api.view(this.requestId, this.token);
			if (this.isConfirmation(view)) {
				this.confirmation = view;
				this.state = 'submitted';
				return;
			}
			this.estimate = view.estimate;
			this.lines = view.lines ?? [];
			this.revisionNumber = view.request?.estimateRevisionNumber;
			this.expiresAt = view.request?.expiresAt;
			// Default every presented line to selected; the customer can deselect any line.
			this.decisions = new Map(this.lines.map((line) => [line.id, true]));
			this.state = 'ready';
		} catch (error) {
			this.applyError(error);
		}
	}

	/** Type guard: the GET view returns the confirmation shape when already submitted. */
	private isConfirmation(view: any): view is ICustomerWorkApprovalConfirmationView {
		return !!view && 'submissionState' in view && 'estimate' in view === false;
	}

	/** Toggle a line's selected decision. */
	toggle(lineId: string, selected: boolean): void {
		this.decisions.set(lineId, selected);
	}

	isSelected(lineId: string): boolean {
		return this.decisions.get(lineId) === true;
	}

	/** Customer-facing total of currently-selected lines (display only; backend is authoritative). */
	get selectedTotal(): number {
		const total = this.lines
			.filter((line) => this.isSelected(line.id))
			.reduce((sum, line) => sum + Number(line.lineTotal ?? 0), 0);
		return Number(total.toFixed(2));
	}

	get currency(): string {
		return this.estimate?.currency ?? this.confirmation?.currency ?? '';
	}

	get hasSelection(): boolean {
		return this.lines.length > 0 && this.lines.some((line) => this.isSelected(line.id));
	}

	/** Vehicle label from the estimate's repair order relation, if present. */
	get vehicleLabel(): string {
		const vehicle = this.estimate?.['repairOrder']?.['vehicle'];
		if (!vehicle) {
			return '';
		}
		// The public projection exposes only year/make/model (no VIN).
		const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
		return parts.join(' ');
	}

	/**
	 * Submits the customer's decisions. Sends exactly one decision per presented line and
	 * nothing else — no totals, ids, or prices. On success the page shows the confirmation.
	 */
	async approve(): Promise<void> {
		if (this.submitting || this.state !== 'ready' || !this.hasSelection) {
			return;
		}
		if (!window.confirm(this.getTranslation('PUBLIC_APPROVAL.CONFIRM_SUBMIT'))) {
			return;
		}
		this.submitting = true;
		const input: ICustomerWorkApprovalSubmitInput = {
			decisions: this.lines.map((line) => ({
				estimateLineId: line.id,
				selected: this.isSelected(line.id)
			}))
		};
		try {
			await this.api.submit(this.requestId, this.token, input);
			// Load the authoritative confirmation from the backend rather than mutating locally.
			this.confirmation = await this.api.confirmation(this.requestId, this.token);
			this.state = 'submitted';
			this.toastrService.success(
				this.getTranslation('PUBLIC_APPROVAL.SUBMIT_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			const status = error?.status;
			if (status === 409) {
				// Already submitted — show the confirmation state rather than another form.
				try {
					this.confirmation = await this.api.confirmation(this.requestId, this.token);
					this.state = 'submitted';
				} catch (confirmError) {
					this.applyError(confirmError);
				}
			} else {
				this.applyError(error);
			}
		} finally {
			this.submitting = false;
		}
	}

	/** Maps backend errors to customer-friendly terminal states without exposing internals. */
	private applyError(error: any): void {
		const status = error?.status;
		if (status === 403) {
			this.errorMessage = this.getTranslation('PUBLIC_APPROVAL.ERROR_INACTIVE');
		} else if (status === 404) {
			this.errorMessage = this.getTranslation('PUBLIC_APPROVAL.ERROR_NOT_FOUND');
		} else if (status === 409) {
			this.errorMessage = this.getTranslation('PUBLIC_APPROVAL.ERROR_ALREADY_SUBMITTED');
		} else {
			this.errorMessage = this.getTranslation('PUBLIC_APPROVAL.ERROR_GENERIC');
		}
		this.state = 'error';
	}

	/** Approved lines from the confirmation (submitted state). */
	get confirmationLines(): ICustomerWorkApprovalLine[] {
		return this.confirmation?.lines ?? [];
	}

	ngOnDestroy(): void {}
}
