import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	AutomotiveJobStatusEnum,
	IAutomotiveJob,
	IAutomotiveJobAssignInput,
	IAutomotiveJobCreateInput,
	IAutomotiveJobUpdateInput,
	ICustomerWorkApprovalLine
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class AutomotiveJobApiService {
	private readonly baseUrl = API_PREFIX;

	constructor(private readonly http: HttpClient) {}

	listForRepairOrder(repairOrderId: string): Promise<IAutomotiveJob[]> {
		return firstValueFrom(this.http.get<IAutomotiveJob[]>(`${this.baseUrl}/repair-orders/${repairOrderId}/jobs`));
	}

	listAuthorizedWork(repairOrderId: string): Promise<ICustomerWorkApprovalLine[]> {
		return firstValueFrom(
			this.http.get<ICustomerWorkApprovalLine[]>(`${this.baseUrl}/repair-orders/${repairOrderId}/authorized-work`)
		);
	}

	create(repairOrderId: string, body: IAutomotiveJobCreateInput): Promise<IAutomotiveJob> {
		return firstValueFrom(
			this.http.post<IAutomotiveJob>(`${this.baseUrl}/repair-orders/${repairOrderId}/jobs`, body)
		);
	}

	update(id: string, body: IAutomotiveJobUpdateInput): Promise<IAutomotiveJob> {
		return firstValueFrom(this.http.put<IAutomotiveJob>(`${this.baseUrl}/automotive-jobs/${id}`, body));
	}

	assign(id: string, body: IAutomotiveJobAssignInput): Promise<IAutomotiveJob> {
		return firstValueFrom(
			this.http.patch<IAutomotiveJob>(`${this.baseUrl}/automotive-jobs/${id}/assignment`, body)
		);
	}

	setStatus(id: string, status: AutomotiveJobStatusEnum): Promise<IAutomotiveJob> {
		return firstValueFrom(
			this.http.patch<IAutomotiveJob>(`${this.baseUrl}/automotive-jobs/${id}/status`, { status })
		);
	}
}
