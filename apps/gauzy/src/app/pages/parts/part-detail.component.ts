import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import {
	IAutomotivePartProfile,
	IAutomotivePartVendor,
	IPartStockMovement
} from '@gauzy/contracts';
import { PartAdjustmentComponent } from './part-adjustment.component';
import { PartMutationComponent } from './part-mutation.component';
import { PartsApiService } from './parts-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-part-detail',
	templateUrl: './part-detail.component.html',
	styleUrls: ['./part-detail.component.scss'],
	standalone: false
})
export class PartDetailComponent implements OnInit, OnDestroy {
	public part: IAutomotivePartProfile;
	public stock: any[] = [];
	public movements: IPartStockMovement[] = [];
	public vendors: IAutomotivePartVendor[] = [];
	public loading = false;
	public notFound = false;

	constructor(
		private readonly api: PartsApiService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly toastr: NbToastrService,
		private readonly translate: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			this.load(id);
		} else {
			this.notFound = true;
		}
	}

	ngOnDestroy(): void {}

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	/** Total on-hand quantity across all warehouses. */
	get totalOnHand(): number {
		return this.stock.reduce((sum, s) => sum + (Number(s?.quantity) || 0), 0);
	}

	private async load(id: string): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.part = await this.api.getById(id);
			// Independent reads; a failure in one must not blank the whole page.
			const [stock, movements, vendors] = await Promise.allSettled([
				this.api.getStock(id),
				this.api.getStockMovements(id),
				this.api.getVendors(id)
			]);
			this.stock = stock.status === 'fulfilled' ? stock.value : [];
			this.movements = movements.status === 'fulfilled' ? movements.value : [];
			this.vendors = vendors.status === 'fulfilled' ? vendors.value : [];
		} catch (error) {
			this.notFound = true;
			this.toastr.danger(
				error?.message || this.getTranslation('PARTS_PAGE.DETAIL.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	back(): void {
		this.router.navigate(['/pages/parts']);
	}

	/** Opens the "Edit Part" dialog pre-populated, and reflects saved data. */
	async edit(): Promise<void> {
		if (!this.part) {
			return;
		}
		const dialogRef = this.dialogService.open(PartMutationComponent, {
			context: { part: this.part }
		});
		const saved: IAutomotivePartProfile = await firstValueFrom(dialogRef.onClose);
		if (saved) {
			this.part = saved;
		}
	}

	/** Opens the "Adjust Stock" dialog and refreshes stock + movements after a successful adjustment. */
	async adjustStock(): Promise<void> {
		if (!this.part) {
			return;
		}
		const dialogRef = this.dialogService.open(PartAdjustmentComponent, {
			context: { partId: this.part.id, balances: this.stock }
		});
		const movement: IPartStockMovement = await firstValueFrom(dialogRef.onClose);
		if (movement) {
			await this.load(this.part.id);
		}
	}
}
