import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	AutomotiveJobStatusEnum,
	IAutomotiveJob,
	IAutomotiveJobCategory,
	IAutomotiveJobCategoryCreateInput,
	IAutomotiveJobCategoryUpdateInput,
	IAutomotiveJobLabor,
	IAutomotiveJobLaborCreateInput,
	IAutomotiveJobLaborUpdateInput,
	IAutomotiveJobLaborView,
	IAutomotiveJobQcAttempt,
	IAutomotiveJobQcCreateInput,
	IAutomotiveJobQcFailInput,
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

	listCategories(activeOnly = false): Promise<{ items: IAutomotiveJobCategory[]; total: number }> {
		const params = activeOnly ? { activeOnly: true } : {};
		return firstValueFrom(
			this.http.get<{ items: IAutomotiveJobCategory[]; total: number }>(
				`${this.baseUrl}/automotive-job-categories`,
				{ params }
			)
		);
	}

	createCategory(body: IAutomotiveJobCategoryCreateInput): Promise<IAutomotiveJobCategory> {
		return firstValueFrom(
			this.http.post<IAutomotiveJobCategory>(`${this.baseUrl}/automotive-job-categories`, body)
		);
	}

	updateCategory(id: string, body: IAutomotiveJobCategoryUpdateInput): Promise<IAutomotiveJobCategory> {
		return firstValueFrom(
			this.http.patch<IAutomotiveJobCategory>(`${this.baseUrl}/automotive-job-categories/${id}`, body)
		);
	}

	archiveCategory(id: string): Promise<IAutomotiveJobCategory> {
		return firstValueFrom(
			this.http.patch<IAutomotiveJobCategory>(`${this.baseUrl}/automotive-job-categories/${id}/archive`, {})
		);
	}

	deleteCategory(id: string): Promise<void> {
		return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/automotive-job-categories/${id}`));
	}

	listLabor(jobId: string): Promise<IAutomotiveJobLaborView[]> {
		return firstValueFrom(
			this.http.get<IAutomotiveJobLaborView[]>(`${this.baseUrl}/automotive-jobs/${jobId}/labor`)
		);
	}

	createLabor(jobId: string, body: IAutomotiveJobLaborCreateInput): Promise<IAutomotiveJobLabor> {
		return firstValueFrom(
			this.http.post<IAutomotiveJobLabor>(`${this.baseUrl}/automotive-jobs/${jobId}/labor`, body)
		);
	}

	updateLabor(laborId: string, body: IAutomotiveJobLaborUpdateInput): Promise<IAutomotiveJobLabor> {
		return firstValueFrom(
			this.http.put<IAutomotiveJobLabor>(`${this.baseUrl}/automotive-job-labor/${laborId}`, body)
		);
	}

	completeLabor(laborId: string): Promise<IAutomotiveJobLabor> {
		return firstValueFrom(
			this.http.patch<IAutomotiveJobLabor>(`${this.baseUrl}/automotive-job-labor/${laborId}/complete`, {})
		);
	}

	startLaborClock(laborId: string): Promise<unknown> {
		return firstValueFrom(this.http.post(`${this.baseUrl}/automotive-job-labor/${laborId}/clock/start`, {}));
	}

	stopLaborClock(laborId: string): Promise<unknown> {
		return firstValueFrom(this.http.post(`${this.baseUrl}/automotive-job-labor/${laborId}/clock/stop`, {}));
	}

	listQc(jobId: string): Promise<IAutomotiveJobQcAttempt[]> {
		return firstValueFrom(this.http.get<IAutomotiveJobQcAttempt[]>(`${this.baseUrl}/automotive-jobs/${jobId}/qc`));
	}

	startQc(jobId: string, body: IAutomotiveJobQcCreateInput = {}): Promise<IAutomotiveJobQcAttempt> {
		return firstValueFrom(this.http.post<IAutomotiveJobQcAttempt>(`${this.baseUrl}/automotive-jobs/${jobId}/qc`, body));
	}

	passQc(qcId: string): Promise<IAutomotiveJobQcAttempt> {
		return firstValueFrom(this.http.patch<IAutomotiveJobQcAttempt>(`${this.baseUrl}/automotive-job-qc/${qcId}/pass`, {}));
	}

	failQc(qcId: string, body: IAutomotiveJobQcFailInput): Promise<IAutomotiveJobQcAttempt> {
		return firstValueFrom(this.http.patch<IAutomotiveJobQcAttempt>(`${this.baseUrl}/automotive-job-qc/${qcId}/fail`, body));
	}
}
