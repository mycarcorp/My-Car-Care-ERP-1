import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	AutomotiveJobStatusEnum,
	IAutomotiveJob,
	IAutomotiveJobCategory,
	IAutomotiveJobLaborView,
	IAutomotiveJobQcAttempt,
	AutomotiveJobQcStatusEnum,
	IAutomotivePartProfile,
	IPartStockMovement,
	PartStockMovementTypeEnum,
	ICustomerWorkApprovalLine,
	IEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { EmployeesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { AutomotiveJobApiService } from './automotive-job-api.service';

@Component({
	selector: 'ga-automotive-jobs',
	templateUrl: './automotive-jobs.component.html',
	styleUrls: ['./automotive-jobs.component.scss'],
	standalone: false
})
export class AutomotiveJobsComponent implements OnInit {
	readonly statuses = AutomotiveJobStatusEnum;
	repairOrderId: string;
	jobs: IAutomotiveJob[] = [];
	authorizedWork: ICustomerWorkApprovalLine[] = [];
	employees: IEmployee[] = [];
	categories: IAutomotiveJobCategory[] = [];
	loading = false;
	creatingForLineId: string | null = null;
	readonly selectedTechnicianByLine: Record<string, string | undefined> = {};
	readonly selectedCategoryByLine: Record<string, string | undefined> = {};
	readonly selectedCategoryByJob: Record<string, string | undefined> = {};
	readonly laborByJob: Record<string, IAutomotiveJobLaborView[]> = {};
	readonly newLaborTechnicianByJob: Record<string, string[]> = {};
	readonly laborTechnicianById: Record<string, string[]> = {};
	currentEmployeeId?: string;
	canManageLabor = false;
	canCompleteLabor = false;
	canStartQc = false;
	canPassQc = false;
	canFailQc = false;
	readonly qcStartingByJob: Record<string, boolean> = {};
	readonly qcSubmittingByAttempt: Record<string, boolean> = {};
	readonly qcByJob: Record<string, IAutomotiveJobQcAttempt[]> = {};
	readonly qcReasonByAttempt: Record<string, string> = {};
	// Parts consumption state
	canViewParts = false;
	parts: IAutomotivePartProfile[] = [];
	readonly partsByJob: Record<string, IPartStockMovement[]> = {};
	readonly partsLoadingByJob: Record<string, boolean> = {};
	readonly partsErrorByJob: Record<string, string | null> = {};
	readonly selectedPartByJob: Record<string, string | undefined> = {};
	readonly partStockByJob: Record<
		string,
		{ warehouseId: string; warehouseProductVariantId: string; quantity: number; label: string }[]
	> = {};
	readonly selectedStockByJob: Record<string, string | undefined> = {};
	readonly partQuantityByJob: Record<string, number | null> = {};
	readonly consumingJobId: Record<string, boolean> = {};
	readonly reversingMovementId: Record<string, boolean> = {};
	readonly partReverseReasonByMovement: Record<string, string> = {};
	canConsumeParts = false;
	canReverseParts = false;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly api: AutomotiveJobApiService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly toastr: ToastrService,
		private readonly permissions: NgxPermissionsService
	) {}

	async ngOnInit(): Promise<void> {
		this.repairOrderId = this.route.snapshot.paramMap.get('repairOrderId');
		await this.loadPermissions();
		await this.refresh();
		await this.loadEmployees();
		await this.loadCategories();
		await this.loadParts();
		this.currentEmployeeId = this.store.user?.employee?.id;
	}

	private async loadPermissions(): Promise<void> {
		this.canManageLabor = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_EDIT
		]);
		this.canCompleteLabor = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_COMPLETE
		]);
		this.canStartQc = await this.permissions.hasPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_START]);
		this.canPassQc = await this.permissions.hasPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_PASS]);
		this.canFailQc = await this.permissions.hasPermission([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_FAIL]);
		this.canConsumeParts = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_CONSUME
		]);
		this.canReverseParts = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_REVERSE
		]);
		this.canViewParts = await this.permissions.hasPermission([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_VIEW
		]);
	}

	async refresh(): Promise<void> {
		this.loading = true;
		try {
			[this.jobs, this.authorizedWork] = await Promise.all([
				this.api.listForRepairOrder(this.repairOrderId),
				this.api.listAuthorizedWork(this.repairOrderId)
			]);
			for (const job of this.jobs) this.selectedCategoryByJob[job.id] = job.categoryId ?? '';
			const laborResults = await Promise.all(this.jobs.map((job) => this.api.listLabor(job.id)));
			const qcResults = await Promise.all(this.jobs.map((job) => this.api.listQc(job.id)));
			this.jobs.forEach((job, index) => {
				this.laborByJob[job.id] = laborResults[index];
				this.qcByJob[job.id] = qcResults[index];
				for (const labor of laborResults[index]) {
					this.laborTechnicianById[labor.id] = [...(labor.assignedEmployeeIds ?? [])];
				}
			});
			this.resetPartConsumptionState();
			if (this.canViewParts) {
				await Promise.all(this.jobs.map((job) => this.loadPartConsumptions(job.id)));
			}
		} catch {
			this.toastr.danger('Could not load authorized work for this repair order.');
		} finally {
			this.loading = false;
		}
	}

	private async loadCategories(): Promise<void> {
		try {
			const { items } = await this.api.listCategories(true);
			this.categories = items;
		} catch {
			this.toastr.danger('Could not load automotive job categories.');
		}
	}

	private async loadEmployees(): Promise<void> {
		const organizationId = this.store.selectedOrganization?.id;
		const tenantId = this.store.user?.tenantId;
		if (!organizationId || !tenantId) return;
		try {
			const { items } = await firstValueFrom(
				this.employeesService.getAll(['user'], { organizationId, tenantId })
			);
			this.employees = items.filter((employee) => employee.isActive !== false && !employee.isArchived);
		} catch {
			this.toastr.danger('Could not load technicians.');
		}
	}

	async createJob(
		line: ICustomerWorkApprovalLine,
		assignedEmployeeId?: string,
		estimatedHours?: number,
		internalNotes?: string,
		categoryId?: string
	): Promise<void> {
		this.creatingForLineId = line.id;
		try {
			await this.api.create(this.repairOrderId, {
				customerWorkApprovalLineId: line.id,
				assignedEmployeeId: assignedEmployeeId || undefined,
				estimatedHours:
					estimatedHours === undefined || estimatedHours === null ? undefined : Number(estimatedHours),
				internalNotes: internalNotes || undefined,
				categoryId: categoryId || undefined
			});
			this.toastr.success('Automotive job created.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not create the automotive job.');
		} finally {
			this.creatingForLineId = null;
		}
	}

	async saveJob(job: IAutomotiveJob, estimatedHours: string, internalNotes: string): Promise<void> {
		try {
			const categoryId = this.selectedCategoryByJob[job.id] ?? job.categoryId ?? '';
			await this.api.update(job.id, {
				estimatedHours: estimatedHours === '' ? undefined : Number(estimatedHours),
				internalNotes,
				categoryId: categoryId || null
			});
			this.toastr.success('Automotive job updated.');
			await this.refresh();
		} catch {
			this.toastr.danger('Job details can only be edited before work begins.');
		}
	}

	async assign(job: IAutomotiveJob, employeeId: string): Promise<void> {
		if (!employeeId) return;
		try {
			await this.api.assign(job.id, { employeeId });
			this.toastr.success('Technician assigned.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not assign this technician.');
		}
	}

	async transition(job: IAutomotiveJob, status: AutomotiveJobStatusEnum): Promise<void> {
		try {
			await this.api.setStatus(job.id, status);
			this.toastr.success(`Job status changed to ${status}.`);
			await this.refresh();
		} catch {
			this.toastr.danger('That job status transition is not allowed.');
		}
	}

	async createLabor(job: IAutomotiveJob, description: string, billedHours: string): Promise<void> {
		try {
			await this.api.createLabor(job.id, {
				description,
				assignedEmployeeIds: this.newLaborTechnicianByJob[job.id] ?? [],
				billedHours: billedHours === '' ? undefined : Number(billedHours)
			});
			this.newLaborTechnicianByJob[job.id] = undefined;
			this.toastr.success('Automotive labor added.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not add automotive labor.');
		}
	}

	async saveLabor(labor: IAutomotiveJobLaborView, description: string, billedHours: string): Promise<void> {
		try {
			await this.api.updateLabor(labor.id, {
				description,
				assignedEmployeeIds: this.laborTechnicianById[labor.id] ?? [],
				billedHours: billedHours === '' ? null : Number(billedHours)
			});
			this.toastr.success('Automotive labor updated.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not update labor assignment or billed hours.');
		}
	}

	setNewLaborTechnician(jobId: string, employeeIds: string | string[]): void {
		this.newLaborTechnicianByJob[jobId] = Array.isArray(employeeIds)
			? employeeIds
			: employeeIds
				? [employeeIds]
				: [];
	}

	setLaborTechnician(laborId: string, employeeIds: string | string[]): void {
		this.laborTechnicianById[laborId] = Array.isArray(employeeIds) ? employeeIds : employeeIds ? [employeeIds] : [];
	}

	async startLaborClock(labor: IAutomotiveJobLaborView): Promise<void> {
		try {
			await this.api.startLaborClock(labor.id);
			this.toastr.success('Labor clock started.');
			await this.refresh();
		} catch {
			this.toastr.danger(
				'Could not start this labor clock. Confirm you are assigned and the job is in progress.'
			);
		}
	}

	async stopLaborClock(labor: IAutomotiveJobLaborView): Promise<void> {
		try {
			await this.api.stopLaborClock(labor.id);
			this.toastr.success('Labor clock stopped.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not stop this labor clock.');
		}
	}

	async completeLabor(labor: IAutomotiveJobLaborView): Promise<void> {
		try {
			await this.api.completeLabor(labor.id);
			this.toastr.success('Labor completed. Any active labor clock was stopped.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not complete this labor.');
		}
	}

	async startQc(job: IAutomotiveJob): Promise<void> {
		if (this.qcStartingByJob[job.id]) return;
		this.qcStartingByJob[job.id] = true;
		try {
			await this.api.startQc(job.id);
			this.toastr.success('QC attempt started.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not start a QC attempt.');
		} finally {
			this.qcStartingByJob[job.id] = false;
		}
	}

	async passQc(attempt: IAutomotiveJobQcAttempt): Promise<void> {
		if (this.qcSubmittingByAttempt[attempt.id]) return;
		this.qcSubmittingByAttempt[attempt.id] = true;
		try {
			await this.api.passQc(attempt.id);
			this.toastr.success('QC passed. Complete the job when all gates are satisfied.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not pass this QC attempt.');
		} finally {
			this.qcSubmittingByAttempt[attempt.id] = false;
		}
	}

	async failQc(attempt: IAutomotiveJobQcAttempt): Promise<void> {
		const reason = this.qcReasonByAttempt[attempt.id]?.trim();
		if (!reason) return;
		if (this.qcSubmittingByAttempt[attempt.id]) return;
		this.qcSubmittingByAttempt[attempt.id] = true;
		try {
			await this.api.failQc(attempt.id, { reason });
			this.toastr.warning('QC failed. The job remains in progress for rework.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not fail this QC attempt.');
		} finally {
			this.qcSubmittingByAttempt[attempt.id] = false;
		}
	}

	qcStatus(jobId: string): string {
		const attempts = this.qcByJob[jobId] || [];
		return attempts.length ? attempts[attempts.length - 1].status : 'NOT_STARTED';
	}

	readonly qcStatuses = AutomotiveJobQcStatusEnum;

	availableTransitions(job: IAutomotiveJob): AutomotiveJobStatusEnum[] {
		switch (job.status) {
			case AutomotiveJobStatusEnum.OPEN:
				return [AutomotiveJobStatusEnum.CANCELLED];
			case AutomotiveJobStatusEnum.ASSIGNED:
				return [AutomotiveJobStatusEnum.IN_PROGRESS, AutomotiveJobStatusEnum.CANCELLED];
			case AutomotiveJobStatusEnum.IN_PROGRESS:
				return [AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.CANCELLED];
			default:
				return [];
		}
	}

	trackById(_index: number, item: { id: string }): string {
		return item.id;
	}

	/** Loads the enabled part profiles available for consumption. */
	async loadParts(): Promise<void> {
		try {
			const { items } = await this.api.listParts();
			this.parts = (items ?? []).filter((part) => part.enabled !== false);
		} catch {
			this.toastr.danger('Could not load available parts.');
		}
	}

	private resetPartConsumptionState(): void {
		for (const key of Object.keys(this.partsByJob)) delete this.partsByJob[key];
		for (const key of Object.keys(this.partsLoadingByJob)) delete this.partsLoadingByJob[key];
		for (const key of Object.keys(this.partsErrorByJob)) delete this.partsErrorByJob[key];
	}

	private async loadPartConsumptions(jobId: string): Promise<void> {
		this.partsLoadingByJob[jobId] = true;
		this.partsErrorByJob[jobId] = null;
		try {
			this.partsByJob[jobId] = await this.api.listPartConsumptions(jobId);
		} catch (error) {
			this.partsByJob[jobId] = [];
			this.partsErrorByJob[jobId] = error?.error?.message || error?.message || 'Could not load parts consumption.';
		} finally {
			this.partsLoadingByJob[jobId] = false;
		}
	}

	async retryPartConsumptions(job: IAutomotiveJob): Promise<void> {
		if (!this.canViewParts) return;
		await this.loadPartConsumptions(job.id);
	}

	/** Display label for a part profile (part number + manufacturer/OEM). */
	partLabel(part: IAutomotivePartProfile): string {
		const idBits = [part.normalizedPartNumber, part.manufacturer || part.oemPartNumber].filter(Boolean);
		return idBits.join(' · ') || part.id;
	}

	/**
	 * When a part is selected for a job, load its stock balances so the user picks the
	 * warehouse/variant balance to consume from. Each balance supplies the warehouseId +
	 * warehouseProductVariantId the backend requires.
	 */
	async onPartSelected(job: IAutomotiveJob, partProfileId: string): Promise<void> {
		this.selectedPartByJob[job.id] = partProfileId || undefined;
		this.selectedStockByJob[job.id] = undefined;
		this.partStockByJob[job.id] = [];
		if (!partProfileId) return;
		try {
			const balances = await this.api.getPartStock(partProfileId);
			this.partStockByJob[job.id] = (balances ?? []).map((balance) => ({
				warehouseId: balance['warehouseProduct']?.warehouse?.id ?? balance['warehouseProduct']?.warehouseId ?? '',
				warehouseProductVariantId: balance.id,
				quantity: Number(balance.quantity ?? 0),
				label: `${balance['warehouseProduct']?.warehouse?.name ?? 'Warehouse'} — available ${balance.quantity ?? 0}`
			}));
		} catch {
			this.toastr.danger('Could not load stock for this part.');
		}
	}

	/** A job can consume parts only while in progress and the user holds the consume permission. */
	canConsume(job: IAutomotiveJob): boolean {
		return this.canConsumeParts && job.status === AutomotiveJobStatusEnum.IN_PROGRESS;
	}

	/** Valid consumption requires a part, a stock balance, and a positive quantity within available stock. */
	canSubmitConsumption(job: IAutomotiveJob): boolean {
		const quantity = this.partQuantityByJob[job.id];
		const stockId = this.selectedStockByJob[job.id];
		const stock = (this.partStockByJob[job.id] || []).find((s) => s.warehouseProductVariantId === stockId);
		return (
			!!this.selectedPartByJob[job.id] &&
			!!stock &&
			quantity != null &&
			Number.isFinite(Number(quantity)) &&
			Number(quantity) > 0 &&
			Number(quantity) <= stock.quantity
		);
	}

	/**
	 * Consumes a part against the job. A client-generated `operationKey` (UUID) makes the request
	 * idempotent — the backend replays the existing movement instead of double-consuming on retry.
	 */
	async consumePart(job: IAutomotiveJob): Promise<void> {
		if (!this.canSubmitConsumption(job) || this.consumingJobId[job.id]) return;
		const selectedPartId = this.selectedPartByJob[job.id];
		const selectedStockId = this.selectedStockByJob[job.id];
		const stockId = this.selectedStockByJob[job.id];
		const stock = (this.partStockByJob[job.id] || []).find((s) => s.warehouseProductVariantId === stockId);
		this.consumingJobId[job.id] = true;
		try {
			await this.api.consumePart(job.id, {
				automotivePartProfileId: this.selectedPartByJob[job.id],
				warehouseId: stock.warehouseId,
				warehouseProductVariantId: stock.warehouseProductVariantId,
				quantity: Number(this.partQuantityByJob[job.id]),
				operationKey: this.newOperationKey()
			});
			this.toastr.success('Part consumed.');
			this.partQuantityByJob[job.id] = null;
			await this.refresh();
			if (selectedPartId) {
				await this.onPartSelected(job, selectedPartId);
				if (
					selectedStockId &&
					(this.partStockByJob[job.id] || []).some(
						(stockBalance) => stockBalance.warehouseProductVariantId === selectedStockId
					)
				) {
					this.selectedStockByJob[job.id] = selectedStockId;
				}
			}
		} catch (error) {
			this.toastr.danger(error?.error?.message || 'Could not consume this part.');
		} finally {
			this.consumingJobId[job.id] = false;
		}
	}

	/** Reverses a previous consumption with a required reason; blocked if already reversed. */
	async reverseConsumption(job: IAutomotiveJob, movement: IPartStockMovement): Promise<void> {
		if (this.reversingMovementId[movement.id]) return;
		const reason = this.partReverseReasonByMovement[movement.id]?.trim();
		if (!reason || this.isReversed(movement)) return;
		this.reversingMovementId[movement.id] = true;
		try {
			await this.api.reversePartConsumption(job.id, movement.id, reason);
			this.toastr.success('Consumption reversed.');
			this.partReverseReasonByMovement[movement.id] = '';
			await this.refresh();
			const selectedPartId = this.selectedPartByJob[job.id];
			if (selectedPartId) {
				await this.onPartSelected(job, selectedPartId);
			}
		} catch (error) {
			this.toastr.danger(error?.error?.message || 'Could not reverse this consumption.');
		} finally {
			this.reversingMovementId[movement.id] = false;
		}
	}

	/** The job's actual consumption records (outbound movements only). */
	consumptionsFor(job: IAutomotiveJob): IPartStockMovement[] {
		return (this.partsByJob[job.id] || []).filter(
			(movement) => movement.type === PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT
		);
	}

	/** A consumption is reversed when a reversal movement references it. */
	isReversed(movement: IPartStockMovement): boolean {
		return (this.partsByJob[movement.automotiveJobId] || []).some(
			(other) =>
				other.type === PartStockMovementTypeEnum.JOB_CONSUMPTION_REVERSAL_IN &&
				other.reversesMovementId === movement.id
		);
	}

	/** Display label for a consumption's part. */
	partNameFor(movement: IPartStockMovement): string {
		const part = this.parts.find((p) => p.id === movement.automotivePartProfileId);
		return part ? this.partLabel(part) : movement.automotivePartProfileId;
	}

	/** Generates a client idempotency key for a consumption request. */
	private newOperationKey(): string {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	setAuthorizedLineTechnician(lineId: string, employeeId: string | string[]): void {
		this.selectedTechnicianByLine[lineId] = Array.isArray(employeeId) ? employeeId[0] : employeeId;
	}

	setAuthorizedLineCategory(lineId: string, categoryId: string): void {
		this.selectedCategoryByLine[lineId] = categoryId || undefined;
	}
}
