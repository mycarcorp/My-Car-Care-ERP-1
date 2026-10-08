import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	EstimateLinePriorityEnum,
	IEstimate,
	IEstimateCreateInput,
	IEstimateLineInput,
	IOrganization,
	IRepairOrder
} from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { RepairOrderApiService } from '../repair-orders/repair-order-api.service';
import { EstimateApiService } from './estimate-api.service';

/**
 * "New Estimate" dialog: creates a DRAFT estimate for a selected Repair Order using the
 * existing backend fields. Customer/vehicle are derived from the chosen Repair Order
 * (the backend enforces the RO→customer/vehicle match), so no duplicate customer/vehicle
 * selection infrastructure is introduced.
 */
@Component({
	selector: 'ga-estimate-mutation',
	templateUrl: './estimate-mutation.component.html',
	styleUrls: ['./estimate-mutation.component.scss'],
	standalone: false
})
export class EstimateMutationComponent implements OnInit {
	public repairOrders: IRepairOrder[] = [];
	public repairOrderId: string;
	public currency = 'USD';
	public lineDescription = '';
	public lineReason = '';
	public linePriority: EstimateLinePriorityEnum = EstimateLinePriorityEnum.MUST_FIX;
	public lineQuantity = 1;
	public lineUnitPrice = 0;
	public lineTaxAmount = 0;
	public lineDiscountAmount: number;
	public loading = false;
	public submitting = false;
	public organization: IOrganization;
	public readonly priorities = Object.values(EstimateLinePriorityEnum);

	private readonly dialogRef = inject<NbDialogRef<EstimateMutationComponent>>(NbDialogRef);
	private readonly api = inject(EstimateApiService);
	private readonly repairOrderApi = inject(RepairOrderApiService);
	private readonly store = inject(Store);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		this.loadRepairOrders();
	}

	/** Loads the current organization/tenant's repair orders for the required RO select. */
	private async loadRepairOrders(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const { items } = await this.repairOrderApi.list();
			this.repairOrders = items ?? [];
		} catch (error) {
			this.toastr.danger(
				error?.message || this.getTranslation('ESTIMATES_PAGE.MUTATION.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Distinguishing label for a repair order option. */
	repairOrderLabel(ro: IRepairOrder): string {
		const customer = ro?.['customer']?.name ?? '';
		const vehicle = [ro?.['vehicle']?.year, ro?.['vehicle']?.make, ro?.['vehicle']?.model]
			.filter(Boolean)
			.join(' ');
		return [ro?.repairOrderNumber, customer, vehicle].filter(Boolean).join(' — ');
	}

	/**
	 * Submits the form: validates required fields, builds one line, derives customer/vehicle
	 * from the selected Repair Order, and creates the DRAFT estimate.
	 */
	async submit(): Promise<void> {
		if (!this.repairOrderId || !this.lineDescription.trim() || !this.lineReason.trim()) {
			this.toastr.warning(
				this.getTranslation('ESTIMATES_PAGE.MUTATION.REQUIRED_FIELDS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const ro = this.repairOrders.find((r) => r.id === this.repairOrderId);
		if (!ro) {
			return;
		}

		const line: IEstimateLineInput = {
			description: this.lineDescription.trim(),
			reason: this.lineReason.trim(),
			priority: this.linePriority,
			quantity: Number(this.lineQuantity),
			unitPrice: Number(this.lineUnitPrice),
			taxAmount: Number(this.lineTaxAmount),
			discountAmount:
				this.lineDiscountAmount !== undefined && this.lineDiscountAmount !== null
					? Number(this.lineDiscountAmount)
					: undefined
		};
		// tenant/organization are applied server-side from the request context; the
		// backend validates the RO→customer/vehicle chain, so the body carries the
		// RO-derived customer/vehicle and the estimate lines only.
		const body: IEstimateCreateInput = {
			repairOrderId: ro.id,
			customerId: ro.customerId,
			vehicleId: ro.vehicleId,
			currency: this.currency,
			lines: [line]
		};
		this.submitting = true;
		try {
			const estimate: IEstimate = await this.api.create(body);
			this.toastr.success(
				this.getTranslation('ESTIMATES_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(estimate);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('ESTIMATES_PAGE.MUTATION.FAILED'),
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
