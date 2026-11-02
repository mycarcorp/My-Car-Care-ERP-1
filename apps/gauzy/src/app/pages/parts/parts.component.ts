import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { IAutomotivePartProfile, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { PartMutationComponent } from './part-mutation.component';
import { PartsApiService } from './parts-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-parts',
	templateUrl: './parts.component.html',
	styleUrls: ['./parts.component.scss'],
	standalone: false
})
export class PartsComponent implements OnInit, OnDestroy {
	public parts: IAutomotivePartProfile[] = [];
	public filtered: IAutomotivePartProfile[] = [];
	public search = '';
	public loading = false;
	public loadError = false;
	public organization: IOrganization;

	constructor(
		private readonly api: PartsApiService,
		private readonly store: Store,
		private readonly toastr: NbToastrService,
		private readonly translate: TranslateService,
		private readonly router: Router,
		private readonly dialogService: NbDialogService
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	/** Loads all part profiles for the current organization. */
	async load(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		this.loadError = false;
		try {
			this.parts = await this.api.list();
			this.applyFilter();
		} catch (error) {
			this.loadError = true;
			this.parts = [];
			this.filtered = [];
			this.toastr.danger(
				error?.message || this.getTranslation('PARTS_PAGE.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Client-side search across part number, manufacturer and OEM number. */
	onSearch(term: string): void {
		this.search = term;
		this.applyFilter();
	}

	private applyFilter(): void {
		const q = this.search.trim().toLowerCase();
		this.filtered = !q
			? this.parts
			: this.parts.filter((p) =>
					[p.normalizedPartNumber, p.manufacturer, p.oemPartNumber, p.aftermarketPartNumber]
						.filter(Boolean)
						.some((v) => v.toLowerCase().includes(q))
			  );
	}

	/** Navigates to the part detail view. */
	view(part: IAutomotivePartProfile): void {
		this.router.navigate(['/pages/parts', part.id]);
	}

	/** Opens the "Add Part" dialog and refreshes the list after a successful save. */
	async addPart(): Promise<void> {
		const dialogRef = this.dialogService.open(PartMutationComponent);
		const saved: IAutomotivePartProfile = await firstValueFrom(dialogRef.onClose);
		if (saved) {
			await this.load();
		}
	}
}
