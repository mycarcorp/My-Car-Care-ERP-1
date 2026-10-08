import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

export interface ServiceCenterSummary {
	generatedAt: Date;
	kpis: {
		todaysAppointments: number;
		scheduledAppointments: number;
		arrivedVehicles: number;
		openRepairOrders: number;
		inProgressRepairOrders: number;
		readyForPickup: number;
		estimatesAwaitingApproval: number;
		awaitingCustomerApproval: number;
		jobsInProgress: number;
		awaitingQc: number;
		invoicesGenerated: number;
		outstandingAmount: number;
		paymentsReceived: number;
		revenue: number;
	};
	limitations: string[];
}

/**
 * Read-only client for the Service Center Command Center summary
 * (`GET /service-center/dashboard/summary`). Performs only GET/read operations.
 */
@Injectable({ providedIn: 'root' })
export class ServiceCenterDashboardApiService {
	private readonly baseUrl = `${API_PREFIX}/service-center/dashboard`;

	constructor(private readonly http: HttpClient) {}

	getSummary(): Promise<ServiceCenterSummary> {
		return firstValueFrom(this.http.get<ServiceCenterSummary>(`${this.baseUrl}/summary`));
	}
}
