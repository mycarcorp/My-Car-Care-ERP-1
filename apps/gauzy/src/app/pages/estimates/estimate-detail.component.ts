import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	CustomerWorkApprovalDeliveryChannelEnum,
	CustomerWorkApprovalDeliveryStatusEnum,
	EstimateStatusEnum,
	ID,
	IEstimate
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { __prepareExternalUrlLocation } from '@gauzy/ui-core/common';
import { EstimateApiService } from './estimate-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-estimate-detail',
	templateUrl: './estimate-detail.component.html',
	styleUrls: ['./estimate-detail.component.scss'],
	standalone: false
})
export class EstimateDetailComponent extends TranslationBaseComponent implements OnInit {
	public estimate: IEstimate;
	public loading = false;
	public notFound = false;
	public approvalSending = false;
	public approvalRequestId: ID;
	public approvalRequestToken: string;
	public approvalLink: string;
	public approvalDeliveryChannel: CustomerWorkApprovalDeliveryChannelEnum;
	public approvalDeliveryStatus: CustomerWorkApprovalDeliveryStatusEnum;
	public approvalDeliveryError: string;
	public copied = false;
	public readonly statuses = EstimateStatusEnum;
	public readonly deliveryChannels = CustomerWorkApprovalDeliveryChannelEnum;
	public readonly deliveryStatuses = CustomerWorkApprovalDeliveryStatusEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly location: Location,
		private readonly urlSerializer: UrlSerializer,
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
		} catch {
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

	/**
	 * "Send for Approval" is available only for a customer-facing estimate revision — the
	 * backend `createRequest` accepts FINALIZED / SENT / VIEWED.
	 */
	canSendForApproval(): boolean {
		return [
			EstimateStatusEnum.FINALIZED,
			EstimateStatusEnum.SENT,
			EstimateStatusEnum.VIEWED
		].includes(this.estimate?.status);
	}

	/**
	 * Creates a secure customer approval request for this estimate via the authoritative
	 * backend endpoint (`POST /customer-work-approval-requests`). The raw secure token is
	 * returned exactly once and surfaced here for manual sharing; it is not persisted.
	 */
	async sendForApproval(
		deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum = CustomerWorkApprovalDeliveryChannelEnum.EMAIL
	): Promise<void> {
		if (!this.canSendForApproval() || this.approvalSending) {
			return;
		}
		this.approvalSending = true;
		try {
			const request = await this.api.createApprovalRequest(this.estimate.id);
			this.approvalRequestId = request.id;
			this.approvalRequestToken = request.token ?? this.approvalRequestToken;
			this.approvalLink = request.token ? this.buildApprovalLink(request.id, request.token) : this.approvalLink;
			if (request.token && deliveryChannel === this.deliveryChannels.EMAIL) {
				const delivery = await this.api.deliverApprovalRequest(request.id, request.token, deliveryChannel);
				this.approvalDeliveryChannel = delivery.deliveryChannel ?? deliveryChannel;
				this.approvalDeliveryStatus = delivery.deliveryStatus;
				this.approvalDeliveryError = delivery.deliveryError;
				this.surfaceDeliveryResult(delivery.deliveryStatus, delivery.deliveryError);
				return;
			}
			if (!request.token) {
				this.approvalDeliveryChannel = deliveryChannel;
				this.approvalDeliveryStatus = this.deliveryStatuses.UNAVAILABLE;
				this.approvalDeliveryError = this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_FAILED');
				this.surfaceDeliveryResult(this.deliveryStatuses.UNAVAILABLE, this.approvalDeliveryError);
				return;
			}
			this.approvalDeliveryChannel = deliveryChannel;
			this.approvalDeliveryStatus = this.deliveryStatuses.UNAVAILABLE;
			this.approvalDeliveryError = 'SMS delivery is not available in this workspace.';
			this.surfaceDeliveryResult(this.deliveryStatuses.UNAVAILABLE, this.approvalDeliveryError);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.approvalSending = false;
		}
	}

	/**
	 * Builds the fully-qualified public approval URL for the secure link, following the
	 * app's `/share/...` convention and the public route `/share/customer-work-approval/:requestId?token=...`.
	 * Uses the router/location URL machinery (no hardcoded host/port), so it inherits the
	 * current origin and base href.
	 *
	 * @param requestId - The approval request id.
	 * @param token - The raw bearer token (returned exactly once by the backend).
	 */
	private buildApprovalLink(requestId: ID, token: string): string {
		const urlTree = this.router.createUrlTree(['/share/customer-work-approval', requestId], {
			queryParams: { token }
		});
		const serializedUrl = this.urlSerializer.serialize(urlTree);
		return __prepareExternalUrlLocation(this.location.prepareExternalUrl(serializedUrl));
	}

	async retryApprovalDelivery(
		deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum = CustomerWorkApprovalDeliveryChannelEnum.EMAIL
	): Promise<void> {
		if (!this.approvalRequestId || !this.approvalRequestToken || this.approvalSending) {
			return;
		}
		this.approvalSending = true;
		try {
			const request = await this.api.deliverApprovalRequest(
				this.approvalRequestId,
				this.approvalRequestToken,
				deliveryChannel
			);
			this.approvalDeliveryChannel = request.deliveryChannel ?? deliveryChannel;
			this.approvalDeliveryStatus = request.deliveryStatus;
			this.approvalDeliveryError = request.deliveryError;
			this.surfaceDeliveryResult(request.deliveryStatus, request.deliveryError);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.approvalSending = false;
		}
	}

	private surfaceDeliveryResult(
		status?: CustomerWorkApprovalDeliveryStatusEnum,
		errorMessage?: string
	): void {
		switch (status) {
			case CustomerWorkApprovalDeliveryStatusEnum.SENT:
				this.toastrService.success(
					this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_CREATED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				break;
			case CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE:
				this.toastrService.warning(
					errorMessage || this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_FAILED'),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				break;
			case CustomerWorkApprovalDeliveryStatusEnum.FAILED:
				this.toastrService.danger(
					errorMessage || this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_FAILED'),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
				break;
			default:
				this.toastrService.success(
					this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_REQUEST_CREATED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
		}
	}

	/**
	 * Copies the approval link to the clipboard, using the async Clipboard API with a
	 * `execCommand` fallback for older browsers/contexts. Success/failure surface via toastr,
	 * the established application convention.
	 */
	async copyApprovalLink(): Promise<void> {
		if (!this.approvalLink) {
			return;
		}
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(this.approvalLink);
			} else {
				this.fallbackCopyToClipboard(this.approvalLink);
			}
			this.copied = true;
			this.toastrService.success(
				this.getTranslation('BUTTONS.COPIED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			setTimeout(() => (this.copied = false), 2000);
		} catch {
			this.toastrService.danger(
				this.getTranslation('ESTIMATES_PAGE.DETAIL.APPROVAL_LINK_COPY_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/**
	 * Fallback clipboard copy for contexts without the async Clipboard API.
	 */
	private fallbackCopyToClipboard(text: string): void {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
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
}
