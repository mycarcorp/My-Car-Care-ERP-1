import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PartStockMovementTypeEnum } from '@gauzy/contracts';
import { PartsApiService } from './parts-api.service';

/** One stock-balance row for the part (a WarehouseProductVariant joined to its warehouse). */
export interface IPartStockBalanceRow {
	id: string; // warehouseProductVariantId
	quantity: number;
	warehouseProduct?: { warehouseId?: string; warehouse?: { id?: string; name?: string } };
}

/** Preset adjustment reasons (value stored; label translated). */
const ADJUSTMENT_REASONS = [
	'STOCK_COUNT_CORRECTION',
	'DAMAGED_PARTS',
	'MISSING_OR_LOST_PARTS',
	'DATA_ENTRY_CORRECTION',
	'OTHER'
] as const;
type AdjustmentReasonKey = (typeof ADJUSTMENT_REASONS)[number];
const OTHER_REASON: AdjustmentReasonKey = 'OTHER';

/**
 * "Adjust Stock" dialog for a part. Posts to the authoritative endpoint
 * `POST /automotive-parts/:id/inventory-adjustments` (ORG_INVENTORY_PRODUCT_EDIT)
 * via the existing `PartsApiService.adjust()`. Only warehouses that already have
 * a stock-balance record for this part are selectable — the backend rejects any
 * balance that does not belong to the chosen warehouse and part.
 */
@Component({
	selector: 'ga-part-adjustment',
	templateUrl: './part-adjustment.component.html',
	styleUrls: ['./part-adjustment.component.scss'],
	standalone: false
})
export class PartAdjustmentComponent implements OnInit {
	/** Part id (dialog context). */
	public partId: string;
	/** The part's existing stock-balance rows (dialog context). */
	public balances: IPartStockBalanceRow[] = [];

	public readonly reasons = ADJUSTMENT_REASONS;
	public readonly directionIn = PartStockMovementTypeEnum.ADJUSTMENT_IN;
	public readonly directionOut = PartStockMovementTypeEnum.ADJUSTMENT_OUT;

	public selectedBalanceId: string;
	public direction: PartStockMovementTypeEnum = PartStockMovementTypeEnum.ADJUSTMENT_IN;
	public quantity: number;
	public reason: AdjustmentReasonKey | '' = '';
	public notes: string;
	public submitting = false;

	private readonly dialogRef = inject<NbDialogRef<PartAdjustmentComponent>>(NbDialogRef);
	private readonly api = inject(PartsApiService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	ngOnInit(): void {
		if (this.balances.length === 1) {
			this.selectedBalanceId = this.balances[0].id;
		}
	}

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	/** Display label for a balance row (warehouse name + current quantity). */
	balanceLabel(balance: IPartStockBalanceRow): string {
		const name = balance?.warehouseProduct?.warehouse?.name || balance?.id;
		return `${name} (${this.getTranslation('PARTS_PAGE.ADJUST.ON_HAND')}: ${Number(balance?.quantity) || 0})`;
	}

	get isOtherReason(): boolean {
		return this.reason === OTHER_REASON;
	}

	/** Selected balance row (used to derive warehouseId + warehouseProductVariantId). */
	private get selectedBalance(): IPartStockBalanceRow | undefined {
		return this.balances.find((b) => b.id === this.selectedBalanceId);
	}

	close(): void {
		this.dialogRef.close();
	}

	/** Validates and posts the adjustment; prevents duplicate submissions. */
	async submit(): Promise<void> {
		const balance = this.selectedBalance;
		if (!balance) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.ADJUST.WAREHOUSE_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const quantity = Number(this.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.ADJUST.QUANTITY_INVALID'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		if (!this.reason) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.ADJUST.REASON_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const notes = this.notes?.trim();
		if (this.isOtherReason && !notes) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.ADJUST.NOTES_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const warehouseId = balance?.warehouseProduct?.warehouse?.id || balance?.warehouseProduct?.warehouseId;
		if (!warehouseId) {
			this.toastr.danger(
				this.getTranslation('PARTS_PAGE.ADJUST.NO_BALANCE'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}
		this.submitting = true;
		try {
			const movement = await this.api.adjust(this.partId, {
				warehouseId,
				warehouseProductVariantId: balance.id,
				type: this.direction,
				quantity,
				reason: this.getTranslation(`PARTS_PAGE.ADJUST.REASONS.${this.reason}`),
				notes: notes || undefined
			});
			this.toastr.success(
				this.getTranslation('PARTS_PAGE.ADJUST.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(movement);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('PARTS_PAGE.ADJUST.FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.submitting = false;
		}
	}
}
