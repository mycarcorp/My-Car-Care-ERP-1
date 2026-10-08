import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	DiagnosticFindingKindEnum,
	DiagnosticStatusEnum,
	ID,
	IDiagnostic,
	IDiagnosticFindingCreateInput
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DiagnosticApiService } from './diagnostic-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-diagnostic-detail',
	templateUrl: './diagnostic-detail.component.html',
	styleUrls: ['./diagnostic-detail.component.scss'],
	standalone: false
})
export class DiagnosticDetailComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public diagnostic: IDiagnostic;
	public loading = false;
	public notFound = false;
	public addingFinding = false;
	public newFindingKind: DiagnosticFindingKindEnum = DiagnosticFindingKindEnum.OBSERVATION;
	public newFindingDescription = '';
	public readonly statuses = DiagnosticStatusEnum;
	public readonly kinds = Object.values(DiagnosticFindingKindEnum);

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: DiagnosticApiService,
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

	/** Loads the diagnostic by id, including its findings. */
	private async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.diagnostic = await this.api.getById(id, ['findings', 'inspection', 'technician']);
		} catch (error) {
			this.notFound = true;
			this.diagnostic = undefined;
			this.toastrService.danger(
				this.getTranslation('DIAGNOSTICS_PAGE.DETAIL.NOT_FOUND'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** Starts the diagnostic (DRAFT → IN_PROGRESS) via the authoritative backend action. */
	async start(): Promise<void> {
		if (!this.canStart()) {
			return;
		}
		await this.runLifecycle(() => this.api.start(this.diagnostic.id));
	}

	/** Completes the diagnostic (IN_PROGRESS → COMPLETED) via the authoritative backend action. */
	async complete(): Promise<void> {
		if (!this.canComplete()) {
			return;
		}
		await this.runLifecycle(() => this.api.complete(this.diagnostic.id));
	}

	/** Runs a lifecycle action and surfaces success/error via the existing toastr pattern. */
	private async runLifecycle(action: () => Promise<IDiagnostic>): Promise<void> {
		try {
			this.diagnostic = await action();
			this.toastrService.success(
				this.getTranslation('DIAGNOSTICS_PAGE.DETAIL.ACTION_SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('DIAGNOSTICS_PAGE.DETAIL.ACTION_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	/**
	 * Adds a finding to a non-completed diagnostic via `POST /diagnostics/:id/findings`,
	 * then refreshes the diagnostic to display it.
	 */
	async addFinding(): Promise<void> {
		if (!this.canAddFinding() || this.addingFinding || !this.newFindingDescription.trim()) {
			return;
		}
		this.addingFinding = true;
		const finding: IDiagnosticFindingCreateInput = {
			kind: this.newFindingKind,
			description: this.newFindingDescription.trim()
		};
		try {
			await this.api.addFinding(this.diagnostic.id, finding);
			this.newFindingDescription = '';
			this.newFindingKind = DiagnosticFindingKindEnum.OBSERVATION;
			await this.load(this.diagnostic.id);
			this.toastrService.success(
				this.getTranslation('DIAGNOSTICS_PAGE.DETAIL.FINDING_ADDED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		} catch (error) {
			this.toastrService.danger(
				error?.error?.message || error?.message || this.getTranslation('DIAGNOSTICS_PAGE.DETAIL.FINDING_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.addingFinding = false;
		}
	}

	/** Start is only allowed from DRAFT. */
	canStart(): boolean {
		return this.diagnostic?.status === DiagnosticStatusEnum.DRAFT;
	}

	/** Complete is only allowed from IN_PROGRESS. */
	canComplete(): boolean {
		return this.diagnostic?.status === DiagnosticStatusEnum.IN_PROGRESS;
	}

	/** Findings can be added while DRAFT or IN_PROGRESS (not COMPLETED). */
	canAddFinding(): boolean {
		return [DiagnosticStatusEnum.DRAFT, DiagnosticStatusEnum.IN_PROGRESS].includes(this.diagnostic?.status);
	}

	/** Read-only once COMPLETED. */
	isReadOnly(): boolean {
		return this.diagnostic?.status === DiagnosticStatusEnum.COMPLETED;
	}

	/** The diagnostic's findings. */
	get findings() {
		return this.diagnostic?.['findings'] ?? [];
	}

	/** Technician display label from the related employee record. */
	get technicianLabel(): string {
		const technician = this.diagnostic?.['technician'];
		const user = technician?.['user'];
		return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || technician?.['id'] || '';
	}

	/** Navigates back to the originating inspection. */
	back(): void {
		const inspectionId = this.diagnostic?.inspectionId;
		if (inspectionId) {
			this.router.navigate(['/pages/inspections', inspectionId]);
		} else {
			this.router.navigate(['/pages/repair-orders']);
		}
	}

	/** Status badge color for the current diagnostic status. */
	get statusBadgeStatus(): string {
		switch (this.diagnostic?.status) {
			case DiagnosticStatusEnum.COMPLETED:
				return 'success';
			case DiagnosticStatusEnum.IN_PROGRESS:
				return 'info';
			case DiagnosticStatusEnum.DRAFT:
			default:
				return 'basic';
		}
	}

	ngOnDestroy(): void {}
}
