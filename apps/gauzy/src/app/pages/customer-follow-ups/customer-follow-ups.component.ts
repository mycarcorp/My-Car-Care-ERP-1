import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { PermissionsEnum, CustomerFollowUpStatusEnum, ID, ICustomerFollowUp } from '@gauzy/contracts';
import { CustomerFollowUpApiService, ICustomerFollowUpView } from './customer-follow-up-api.service';

@Component({
	selector: 'ga-customer-follow-ups',
	templateUrl: './customer-follow-ups.component.html',
	styleUrls: ['./customer-follow-ups.component.scss'],
	standalone: false
})
export class CustomerFollowUpsComponent implements OnInit {
	public readonly permissions = PermissionsEnum;
	public followUps: ICustomerFollowUpView[] = [];
	public loading = false;
	public error: string | null = null;

	constructor(
		private readonly api: CustomerFollowUpApiService,
		private readonly router: Router,
		private readonly toastr: NbToastrService
	) {}

	ngOnInit(): void {
		void this.load();
	}

	async load(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const { items } = await this.api.list();
			this.followUps = items ?? [];
		} catch (error) {
			this.followUps = [];
			this.error = error?.error?.message || error?.message || 'Unable to load customer follow-ups.';
			this.toastr.danger(this.error, 'Error');
		} finally {
			this.loading = false;
		}
	}

	async created(followUp: ICustomerFollowUpView): Promise<void> {
		await this.load();
		if (followUp?.id) {
			await this.router.navigate(['/pages/customer-follow-ups', followUp.id]);
		}
	}

	open(followUpId: ID): void {
		void this.router.navigate(['/pages/customer-follow-ups', followUpId]);
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

	followUpSummary(item: ICustomerFollowUpView): string {
		const parts = [
			item.customer?.name,
			item.vehicle ? this.vehicleLabel(item.vehicle) : null,
			item.repairOrder?.repairOrderNumber,
			item.estimate ? `Estimate ${item.estimate.estimateNumber ?? item.estimate.id}` : null,
			item.invoice ? `Invoice ${item.invoice.invoiceNumber ?? item.invoice.id}` : null,
			item.task?.title
		].filter(Boolean);
		return parts.join(' • ');
	}

	private vehicleLabel(vehicle: ICustomerFollowUpView['vehicle']): string {
		if (!vehicle) {
			return '';
		}
		return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vinNormalized || vehicle.id;
	}
}