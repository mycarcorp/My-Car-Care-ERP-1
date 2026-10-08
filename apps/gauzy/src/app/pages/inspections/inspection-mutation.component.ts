import { Component, OnInit, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	ID,
	IInspection,
	IInspectionCreateInput,
	IInspectionFindingCreateInput,
	InspectionFindingResultEnum
} from '@gauzy/contracts';
import { InspectionApiService } from './inspection-api.service';

/**
 * "Create Inspection" dialog: creates a DRAFT inspection for a Repair Order, collecting
 * findings up-front (the backend only accepts findings at creation time — there is no
 * add-finding-after-creation endpoint). The dialog receives the RO context (repairOrderId,
 * vehicleId, technicianEmployeeId) via the dialog context.
 */
@Component({
	selector: 'ga-inspection-mutation',
	templateUrl: './inspection-mutation.component.html',
	styleUrls: ['./inspection-mutation.component.scss'],
	standalone: false
})
export class InspectionMutationComponent implements OnInit {
	public repairOrderId: ID;
	public vehicleId: ID;
	public technicianEmployeeId: ID;
	public findings: IInspectionFindingCreateInput[] = [];
	public submitting = false;
	public readonly results = Object.values(InspectionFindingResultEnum);

	private readonly dialogRef = inject<NbDialogRef<InspectionMutationComponent>>(NbDialogRef);
	private readonly api = inject(InspectionApiService);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	getTranslation(key: string): string {
		return this.translate.instant(key);
	}

	ngOnInit(): void {
		// Start with one blank finding row so the form is usable immediately.
		if (!this.findings.length) {
			this.addFinding();
		}
	}

	/** Adds a blank unsaved finding row (defaults to PASS). */
	addFinding(): void {
		this.findings.push({ description: '', result: InspectionFindingResultEnum.PASS });
	}

	/** Removes an unsaved finding row. */
	removeFinding(index: number): void {
		this.findings.splice(index, 1);
	}

	/**
	 * Submits the creation: validates required fields, sends the RO context + findings
	 * (status stays the backend DRAFT default), and closes with the created inspection.
	 */
	async submit(): Promise<void> {
		const validFindings = this.findings.filter((f) => f.description?.trim());
		if (!this.repairOrderId || !this.vehicleId || !this.technicianEmployeeId) {
			this.toastr.warning(
				this.getTranslation('INSPECTIONS_PAGE.MUTATION.REQUIRED_CONTEXT'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		const body: IInspectionCreateInput = {
			repairOrderId: this.repairOrderId,
			vehicleId: this.vehicleId,
			technicianEmployeeId: this.technicianEmployeeId,
			findings: validFindings.map((f) => ({
				description: f.description.trim(),
				result: f.result
			}))
		};
		this.submitting = true;
		try {
			const inspection: IInspection = await this.api.create(body);
			this.toastr.success(
				this.getTranslation('INSPECTIONS_PAGE.MUTATION.SUCCESS'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(inspection);
		} catch (error) {
			this.toastr.danger(
				error?.error?.message || error?.message || this.getTranslation('INSPECTIONS_PAGE.MUTATION.FAILED'),
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
