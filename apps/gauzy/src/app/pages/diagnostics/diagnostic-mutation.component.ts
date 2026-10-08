import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	DiagnosticFindingKindEnum,
	ID,
	IDiagnostic,
	IDiagnosticCreateInput,
	IDiagnosticFindingCreateInput
} from '@gauzy/contracts';
import { DiagnosticApiService } from './diagnostic-api.service';

/**
 * "Create Diagnostic" dialog: creates a DRAFT diagnostic for an Inspection. The dialog
 * receives the inspection context (inspectionId, technicianEmployeeId) via the dialog
 * context — the technician is derived from the Inspection's technician, never from the
 * Repair Order's service advisor. Supports optional initial findings at creation time.
 */
@Component({
	selector: 'ga-diagnostic-mutation',
	templateUrl: './diagnostic-mutation.component.html',
	styleUrls: ['./diagnostic-mutation.component.scss'],
	standalone: false
})
export class DiagnosticMutationComponent implements OnInit {
	public inspectionId: ID;
	public technicianEmployeeId: ID;
	public symptom = '';
	public summary = '';
	public internalNote = '';
	public findings: IDiagnosticFindingCreateInput[] = [];
	public submitting = false;
	public readonly kinds = Object.values(DiagnosticFindingKindEnum);

	private readonly dialogRef = inject<NbDialogRef<DiagnosticMutationComponent>>(NbDialogRef);
	private readonly api = inject(DiagnosticApiService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {}

	/** Adds a blank unsaved finding row (defaults to OBSERVATION). */
	addFinding(): void {
		this.findings.push({ kind: DiagnosticFindingKindEnum.OBSERVATION, description: '' });
	}

	/** Removes an unsaved finding row. */
	removeFinding(index: number): void {
		this.findings.splice(index, 1);
	}

	/**
	 * Submits the creation: requires a symptom, sends the inspection context + optional
	 * summary/internalNote + initial findings (status stays the backend DRAFT default).
	 */
	async submit(): Promise<void> {
		if (!this.symptom.trim() || !this.inspectionId || !this.technicianEmployeeId) {
			this.toastr.warning(
				this.getTranslation('DIAGNOSTICS_PAGE.MUTATION.REQUIRED_FIELDS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const validFindings = this.findings.filter((f) => f.description?.trim());
		const body: IDiagnosticCreateInput = {
			inspectionId: this.inspectionId,
			technicianEmployeeId: this.technicianEmployeeId,
			symptom: this.symptom.trim(),
			summary: this.summary.trim() || undefined,
			internalNote: this.internalNote.trim() || undefined,
			findings: validFindings.map((f) => ({ kind: f.kind, description: f.description.trim() }))
		};
		this.submitting = true;
		try {
			const diagnostic: IDiagnostic = await this.api.create(body);
			this.toastr.success(
				this.getTranslation('DIAGNOSTICS_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(diagnostic);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('DIAGNOSTICS_PAGE.MUTATION.FAILED'),
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
