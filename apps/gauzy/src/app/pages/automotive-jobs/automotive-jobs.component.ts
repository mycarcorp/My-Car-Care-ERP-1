import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AutomotiveJobStatusEnum, IAutomotiveJob, ICustomerWorkApprovalLine, IEmployee } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { EmployeesService, Store, ToastrService } from '@gauzy/ui-core/core';
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
	loading = false;
	creatingForLineId: string | null = null;
	readonly selectedTechnicianByLine: Record<string, string | undefined> = {};

	constructor(
		private readonly route: ActivatedRoute,
		private readonly api: AutomotiveJobApiService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly toastr: ToastrService
	) {}

	async ngOnInit(): Promise<void> {
		this.repairOrderId = this.route.snapshot.paramMap.get('repairOrderId');
		await this.refresh();
		await this.loadEmployees();
	}

	async refresh(): Promise<void> {
		this.loading = true;
		try {
			[this.jobs, this.authorizedWork] = await Promise.all([
				this.api.listForRepairOrder(this.repairOrderId),
				this.api.listAuthorizedWork(this.repairOrderId)
			]);
		} catch {
			this.toastr.danger('Could not load authorized work for this repair order.');
		} finally {
			this.loading = false;
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
		internalNotes?: string
	): Promise<void> {
		this.creatingForLineId = line.id;
		try {
			await this.api.create(this.repairOrderId, {
				customerWorkApprovalLineId: line.id,
				assignedEmployeeId: assignedEmployeeId || undefined,
				estimatedHours:
					estimatedHours === undefined || estimatedHours === null ? undefined : Number(estimatedHours),
				internalNotes: internalNotes || undefined
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
			await this.api.update(job.id, {
				estimatedHours: estimatedHours === '' ? undefined : Number(estimatedHours),
				internalNotes
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
}
