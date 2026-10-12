import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	ID,
	IFinancingApplication,
	IFinancingApplicationCreateInput
} from '@gauzy/contracts';
import { FinancingApiService } from './financing-api.service';
import { AutomotiveJobApiService } from '../automotive-jobs/automotive-job-api.service';
import { EstimateApiService } from '../estimates/estimate-api.service';

/**
 * "Create Financing Application" dialog: creates a DRAFT financing application for a Repair
 * Order. The backend requires a matching SUBMITTED Customer Work Approval (`customerWorkApprovalId`)
 * and its Estimate (`estimateId`). The dialog receives the RO context (`repairOrderId`) via the
 * dialog context and resolves the approval + estimate from the RO's authorized work
 * (`GET /repair-orders/:id/authorized-work` → approval lines carry `customerWorkApprovalId`).
 */
@Component({
	selector: 'ga-financing-mutation',
	templateUrl: './financing-mutation.component.html',
	styleUrls: ['./financing-mutation.component.scss'],
	standalone: false
})
export class FinancingMutationComponent implements OnInit {
	public repairOrderId: ID;
	public requestedAmount: number | null = null;
	public currency = 'USD';
	public provider = '';
	public submitting = false;
	public resolvingContext = false;

	/** Resolved from the RO's authorized work (a matching SUBMITTED approval). */
	public customerWorkApprovalId: ID;
	public estimateId: ID;
	public contextError = false;

	private readonly dialogRef = inject<NbDialogRef<FinancingMutationComponent>>(NbDialogRef);
	private readonly api = inject(FinancingApiService);
	private readonly automotiveJobApi = inject(AutomotiveJobApiService);
	private readonly estimateApi = inject(EstimateApiService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {
		this.resolveContext();
	}

	/**
	 * Resolves the customerWorkApprovalId + estimateId for this repair order. The approval id comes
	 * from the RO's authorized work lines (`GET /repair-orders/:id/authorized-work`). The estimate id
	 * is the RO's estimate (`GET /estimates?where[repairOrderId]=…`); the backend enforces that the
	 * approval, estimate, and RO all match, so a mismatch surfaces as a validation error on submit.
	 */
	private async resolveContext(): Promise<void> {
		if (!this.repairOrderId) {
			this.contextError = true;
			return;
		}
		this.resolvingContext = true;
		try {
			const [lines, estimates] = await Promise.all([
				this.automotiveJobApi.listAuthorizedWork(this.repairOrderId),
				this.estimateApi.listByRepairOrder(this.repairOrderId)
			]);
			const approvalLine = (lines ?? []).find((line) => !!line?.customerWorkApprovalId);
			const estimate = (estimates?.items ?? []).find((item) => !!item?.id);
			this.customerWorkApprovalId = approvalLine?.customerWorkApprovalId;
			this.estimateId = estimate?.id;
			if (!this.customerWorkApprovalId || !this.estimateId) {
				this.contextError = true;
			}
		} catch (error) {
			this.contextError = true;
		} finally {
			this.resolvingContext = false;
		}
	}

	/** Valid only once the approval/estimate context resolved and an amount is provided. */
	get isValid(): boolean {
		return (
			!!this.repairOrderId &&
			!!this.customerWorkApprovalId &&
			!!this.estimateId &&
			this.requestedAmount !== null &&
			Number.isFinite(Number(this.requestedAmount)) &&
			Number(this.requestedAmount) >= 0 &&
			!!this.currency?.trim()
		);
	}

	/** Submits the creation; status stays the backend DRAFT default. */
	async submit(): Promise<void> {
		if (!this.isValid || this.submitting) {
			this.toastr.warning(
				this.getTranslation('FINANCING_PAGE.MUTATION.REQUIRED_FIELDS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const body: IFinancingApplicationCreateInput = {
			repairOrderId: this.repairOrderId,
			estimateId: this.estimateId,
			customerWorkApprovalId: this.customerWorkApprovalId,
			provider: this.provider.trim() || undefined,
			requestedAmount: Number(this.requestedAmount),
			currency: this.currency.trim()
		};
		this.submitting = true;
		try {
			const application: IFinancingApplication = await this.api.create(body);
			this.toastr.success(
				this.getTranslation('FINANCING_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(application);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('FINANCING_PAGE.MUTATION.FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.submitting = false;
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}
