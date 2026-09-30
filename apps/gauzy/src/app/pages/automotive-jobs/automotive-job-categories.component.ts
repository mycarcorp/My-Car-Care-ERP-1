import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { IAutomotiveJobCategory } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { AutomotiveJobApiService } from './automotive-job-api.service';

@Component({
	selector: 'ga-automotive-job-categories',
	templateUrl: './automotive-job-categories.component.html',
	styleUrls: ['./automotive-job-categories.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class AutomotiveJobCategoriesComponent implements OnInit {
	categories: IAutomotiveJobCategory[] = [];
	loading = false;
	saving = false;
	selected?: IAutomotiveJobCategory;
	name = '';
	description = '';
	displayOrder: number | null = null;
	isActive = true;

	constructor(
		private readonly api: AutomotiveJobApiService,
		private readonly toastr: ToastrService,
		private readonly changeDetector: ChangeDetectorRef
	) {}

	async ngOnInit(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.loading = true;
		try {
			const result = await this.api.listCategories();
			this.categories = result.items;
		} catch {
			this.toastr.danger('Could not load automotive job categories.');
		} finally {
			this.loading = false;
			this.changeDetector.markForCheck();
		}
	}

	edit(category: IAutomotiveJobCategory): void {
		this.selected = category;
		this.name = category.name;
		this.description = category.description ?? '';
		this.displayOrder = category.displayOrder ?? null;
		this.isActive = category.isActive !== false && !category.isArchived;
	}

	reset(): void {
		this.selected = undefined;
		this.name = '';
		this.description = '';
		this.displayOrder = null;
		this.isActive = true;
	}

	async save(): Promise<void> {
		const name = this.name.trim();
		if (!name) return;
		this.saving = true;
		try {
			const input = {
				name,
				description: this.description.trim() || undefined,
				displayOrder: this.displayOrder ?? undefined,
				...(this.selected ? { isActive: this.isActive } : {})
			};
			if (this.selected) {
				await this.api.updateCategory(this.selected.id, input);
			} else {
				await this.api.createCategory(input);
			}
			this.toastr.success('Automotive job category saved.');
			this.reset();
			await this.refresh();
		} catch {
			this.toastr.danger('Could not save the category. Check that its name is unique.');
		} finally {
			this.saving = false;
			this.changeDetector.markForCheck();
		}
	}

	async archive(category: IAutomotiveJobCategory): Promise<void> {
		try {
			await this.api.updateCategory(category.id, { isActive: false });
			this.toastr.success('Automotive job category archived.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not archive the category.');
		}
	}

	async activate(category: IAutomotiveJobCategory): Promise<void> {
		try {
			await this.api.updateCategory(category.id, { isActive: true });
			this.toastr.success('Automotive job category activated.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not activate the category.');
		}
	}

	async remove(category: IAutomotiveJobCategory): Promise<void> {
		try {
			await this.api.deleteCategory(category.id);
			this.toastr.success('Automotive job category deleted.');
			await this.refresh();
		} catch {
			this.toastr.danger('Categories referenced by jobs cannot be deleted.');
		}
	}
}
