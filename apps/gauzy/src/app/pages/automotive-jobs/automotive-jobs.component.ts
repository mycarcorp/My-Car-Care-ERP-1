import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	AutomotiveJobStatusEnum,
	IAutomotiveJob,
	IAutomotiveJobCategory,
	IAutomotiveJobLaborView,
	IAutomotiveJobQcAttempt,
	AutomotiveJobQcStatusEnum,
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
	readonly qcByJob: Record<string, IAutomotiveJobQcAttempt[]> = {};
	readonly qcReasonByAttempt: Record<string, string> = {};

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
		await this.refresh();
		await this.loadEmployees();
		await this.loadCategories();
		this.currentEmployeeId = this.store.user?.employee?.id;
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
		try {
			await this.api.startQc(job.id);
			this.toastr.success('QC attempt started.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not start a QC attempt.');
		}
	}

	async passQc(attempt: IAutomotiveJobQcAttempt): Promise<void> {
		try {
			await this.api.passQc(attempt.id);
			this.toastr.success('QC passed. Complete the job when all gates are satisfied.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not pass this QC attempt.');
		}
	}

	async failQc(attempt: IAutomotiveJobQcAttempt): Promise<void> {
		const reason = this.qcReasonByAttempt[attempt.id]?.trim();
		if (!reason) return;
		try {
			await this.api.failQc(attempt.id, { reason });
			this.toastr.warning('QC failed. The job remains in progress for rework.');
			await this.refresh();
		} catch {
			this.toastr.danger('Could not fail this QC attempt.');
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

	setAuthorizedLineTechnician(lineId: string, employeeId: string | string[]): void {
		this.selectedTechnicianByLine[lineId] = Array.isArray(employeeId) ? employeeId[0] : employeeId;
	}

	setAuthorizedLineCategory(lineId: string, categoryId: string): void {
		this.selectedCategoryByLine[lineId] = categoryId || undefined;
	}
}
