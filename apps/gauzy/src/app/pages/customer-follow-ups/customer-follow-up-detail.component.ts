import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	CustomerFollowUpStatusEnum,
	ID,
	IEmployee,
	PermissionsEnum
} from '@gauzy/contracts';
import { EmployeesService, Store } from '@gauzy/ui-core/core';
import { CustomerFollowUpApiService, ICustomerFollowUpView } from './customer-follow-up-api.service';

const TRANSITIONS: Record<CustomerFollowUpStatusEnum, CustomerFollowUpStatusEnum[]> = {
	[CustomerFollowUpStatusEnum.OPEN]: [
		CustomerFollowUpStatusEnum.SCHEDULED,
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.SCHEDULED]: [
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.ACTIVE]: [
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.DEFERRED]: [
		CustomerFollowUpStatusEnum.SCHEDULED,
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.OVERDUE,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.OVERDUE]: [
		CustomerFollowUpStatusEnum.ACTIVE,
		CustomerFollowUpStatusEnum.DEFERRED,
		CustomerFollowUpStatusEnum.COMPLETED,
		CustomerFollowUpStatusEnum.CANCELLED
	],
	[CustomerFollowUpStatusEnum.COMPLETED]: [],
	[CustomerFollowUpStatusEnum.CANCELLED]: []
};

@Component({
	selector: 'ga-customer-follow-up-detail',
	templateUrl: './customer-follow-up-detail.component.html',
	styleUrls: ['./customer-follow-up-detail.component.scss'],
	standalone: false
})
export class CustomerFollowUpDetailComponent implements OnInit {
	public readonly permissions = PermissionsEnum;
	public followUp: ICustomerFollowUpView;
	public loading = false;
	public notFound = false;
	public saving = false;
	public employees: IEmployee[] = [];
	public ownerEmployeeId: ID | null = null;
	public dueAt: Date | null = null;
	public scheduledAt: Date | null = null;
	public deferredUntil: Date | null = null;
	public statusReason = '';

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly api: CustomerFollowUpApiService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly toastr: NbToastrService
	) {}

	ngOnInit(): void {
		this.route.paramMap
			.pipe(
				filter((params) => !!params.get('id')),
				tap(() => (this.loading = true)),
				tap(async (params) => await this.load(params.get('id')))
			)
			.subscribe();
	}

	async load(id: ID): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			const organization = this.store.selectedOrganization;
			const tenantId = this.store.user?.tenantId;
			if (organization && tenantId) {
				const employees = await firstValueFrom(
					this.employeesService.getAll([], { organizationId: organization.id, tenantId } as any)
				);
				this.employees = employees.items ?? [];
			}
			this.followUp = await this.api.getById(id);
			this.patchLocalState();
		} catch (error) {
			this.notFound = true;
			this.followUp = undefined;
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to load customer follow-up.', 'Error');
		} finally {
			this.loading = false;
		}
	}

	private patchLocalState(): void {
		if (!this.followUp) {
			return;
		}
		this.ownerEmployeeId = this.followUp.ownerEmployeeId ?? this.store.selectedEmployee?.id ?? null;
		this.dueAt = this.followUp.dueAt ? new Date(this.followUp.dueAt) : null;
		this.scheduledAt = this.followUp.scheduledAt ? new Date(this.followUp.scheduledAt) : null;
		this.deferredUntil = this.followUp.deferredUntil ? new Date(this.followUp.deferredUntil) : null;
		this.statusReason = this.followUp.statusReason ?? '';
	}

	get availableTransitions(): CustomerFollowUpStatusEnum[] {
		return this.followUp ? TRANSITIONS[this.followUp.status] ?? [] : [];
	}

	statusBadgeStatus(status: CustomerFollowUpStatusEnum): string {
		switch (status) {
			case CustomerFollowUpStatusEnum.COMPLETED:
				return 'success';
			case CustomerFollowUpStatusEnum.ACTIVE:
				return 'info';
			case CustomerFollowUpStatusEnum.SCHEDULED:
				return 'primary';
			case CustomerFollowUpStatusEnum.DEFERRED:
				return 'warning';
			case CustomerFollowUpStatusEnum.OVERDUE:
				return 'danger';
			case CustomerFollowUpStatusEnum.CANCELLED:
				return 'basic';
			default:
				return 'basic';
		}
	}

	async saveSchedule(): Promise<void> {
		if (!this.followUp?.id || this.saving) {
			return;
		}
		this.saving = true;
		try {
			this.followUp = await this.api.update(this.followUp.id, {
				dueAt: this.dueAt ?? undefined,
				scheduledAt: this.scheduledAt ?? undefined
			});
			this.patchLocalState();
			this.toastr.success('Schedule updated.', 'Success');
		} catch (error) {
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to update the schedule.', 'Error');
		} finally {
			this.saving = false;
		}
	}

	async assignOwner(): Promise<void> {
		if (!this.followUp?.id || !this.ownerEmployeeId || this.saving) {
			return;
		}
		this.saving = true;
		try {
			this.followUp = await this.api.assign(this.followUp.id, this.ownerEmployeeId);
			this.patchLocalState();
			this.toastr.success('Owner assigned.', 'Success');
		} catch (error) {
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to assign owner.', 'Error');
		} finally {
			this.saving = false;
		}
	}

	async transitionTo(status: CustomerFollowUpStatusEnum): Promise<void> {
		if (!this.followUp?.id || this.saving || !this.availableTransitions.includes(status)) {
			return;
		}
		if (status === CustomerFollowUpStatusEnum.DEFERRED && !this.deferredUntil) {
			this.toastr.warning('Choose a deferred-until date before deferring.', 'Warning');
			return;
		}
		this.saving = true;
		try {
			this.followUp = await this.api.transition(this.followUp.id, {
				status,
				statusReason: this.statusReason?.trim() || undefined,
				dueAt: this.dueAt ?? undefined,
				deferredUntil: status === CustomerFollowUpStatusEnum.DEFERRED ? this.deferredUntil ?? undefined : undefined
			});
			this.patchLocalState();
			this.toastr.success(`Status changed to ${status}.`, 'Success');
		} catch (error) {
			this.toastr.danger(error?.error?.message || error?.message || 'Unable to change status.', 'Error');
		} finally {
			this.saving = false;
		}
	}

	async reloadAfterEdit(followUp: ICustomerFollowUpView): Promise<void> {
		this.followUp = followUp;
		this.patchLocalState();
	}

	openRelated(path: string): void {
		void this.router.navigate([path]);
	}

	back(): void {
		void this.router.navigate(['/pages/customer-follow-ups']);
	}

	relatedCustomer(): string {
		return this.followUp?.customer?.name || 'No customer';
	}

	communicationSummary(): string {
		const parts = [
			this.followUp?.sourceEventType,
			this.followUp?.sourceEventKey,
			this.followUp?.sourceEventAt ? new Date(this.followUp.sourceEventAt).toLocaleString() : null
		].filter(Boolean);
		return parts.join(' • ');
	}

	ownerLabel(): string {
		return this.followUp?.ownerEmployee?.fullName || this.followUp?.ownerEmployee?.firstName || 'Unassigned';
	}
}