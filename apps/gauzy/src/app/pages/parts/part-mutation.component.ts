import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { IAutomotivePartProfile, IOrganization, IPagination, IProductVariant } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { PartsApiService } from './parts-api.service';

/**
 * "Add / Edit Part" dialog. Backed by the authoritative endpoints
 * `POST /automotive-parts` and `PUT /automotive-parts/:id` (both
 * ORG_INVENTORY_PRODUCT_EDIT). When a `part` is passed via dialog context the
 * dialog edits it; otherwise it creates a new part. The backend normalizes the
 * part number and enforces uniqueness; the form only validates required fields
 * and prevents duplicate submissions.
 */
@Component({
	selector: 'ga-part-mutation',
	templateUrl: './part-mutation.component.html',
	styleUrls: ['./part-mutation.component.scss'],
	standalone: false
})
export class PartMutationComponent implements OnInit {
	/** When provided via dialog context, the dialog edits this part. */
	public part: IAutomotivePartProfile;

	public variants: IProductVariant[] = [];
	public productVariantId: string;
	public normalizedPartNumber: string;
	public manufacturer: string;
	public oemPartNumber: string;
	public aftermarketPartNumber: string;
	public barcode: string;
	public internalNotes: string;
	public enabled = true;

	public loading = false;
	public submitting = false;
	public organization: IOrganization;

	private readonly dialogRef = inject<NbDialogRef<PartMutationComponent>>(NbDialogRef);
	private readonly api = inject(PartsApiService);
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	get isEdit(): boolean {
		return !!this.part?.id;
	}

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		if (this.part) {
			this.productVariantId = this.part.productVariantId;
			this.normalizedPartNumber = this.part.normalizedPartNumber;
			this.manufacturer = this.part.manufacturer;
			this.oemPartNumber = this.part.oemPartNumber;
			this.aftermarketPartNumber = this.part.aftermarketPartNumber;
			this.barcode = this.part.barcode;
			this.internalNotes = this.part.internalNotes;
			this.enabled = this.part.enabled ?? true;
		}
		this.loadVariants();
	}

	/** Loads product variants for the required variant picker (create mode). */
	private async loadVariants(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const result = await firstValueFrom(
				this.http.get<IPagination<IProductVariant>>(`${API_PREFIX}/product-variants`)
			);
			this.variants = result?.items ?? [];
		} catch (error) {
			this.toastr.danger(
				error?.message || this.getTranslation('PARTS_PAGE.MUTATION.LOAD_VARIANTS_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Human-readable label for a variant option. */
	variantLabel(variant: IProductVariant): string {
		return variant?.internalReference || variant?.notes || variant?.id;
	}

	close(): void {
		this.dialogRef.close();
	}

	/** Validates and submits create/update; prevents duplicate submissions. */
	async submit(): Promise<void> {
		const partNumber = this.normalizedPartNumber?.trim();
		if (!partNumber) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.MUTATION.PART_NUMBER_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		if (!this.isEdit && !this.productVariantId) {
			this.toastr.warning(
				this.getTranslation('PARTS_PAGE.MUTATION.VARIANT_REQUIRED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		this.submitting = true;
		try {
			const body: Partial<IAutomotivePartProfile> = {
				normalizedPartNumber: partNumber,
				manufacturer: this.manufacturer?.trim() || undefined,
				oemPartNumber: this.oemPartNumber?.trim() || undefined,
				aftermarketPartNumber: this.aftermarketPartNumber?.trim() || undefined,
				barcode: this.barcode?.trim() || undefined,
				internalNotes: this.internalNotes?.trim() || undefined,
				enabled: this.enabled
			};
			let saved: IAutomotivePartProfile;
			if (this.isEdit) {
				saved = await this.api.update(this.part.id, body);
			} else {
				saved = await this.api.create({ ...body, productVariantId: this.productVariantId });
			}
			this.toastr.success(
				this.getTranslation(this.isEdit ? 'PARTS_PAGE.MUTATION.UPDATED' : 'PARTS_PAGE.MUTATION.CREATED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(saved);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('PARTS_PAGE.MUTATION.FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.submitting = false;
		}
	}
}
