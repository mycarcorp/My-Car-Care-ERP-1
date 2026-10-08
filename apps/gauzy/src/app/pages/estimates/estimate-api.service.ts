import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	ICustomerWorkApprovalRequestCreateResponse,
	IEstimate,
	IEstimateCreateInput,
	IEstimateLine,
	IEstimateLineInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Thin API client for the automotive Estimate backend (`/estimates`, `/estimate-lines`).
 * Mirrors the VehicleApiService / RepairOrderApiService conventions. No new backend
 * endpoints are introduced; this only wraps the existing controller surface.
 */
@Injectable({ providedIn: 'root' })
export class EstimateApiService {
	private readonly baseUrl = API_PREFIX;

	constructor(private readonly http: HttpClient) {}

	/** Programmatic list access (`GET /estimates`). */
	list(): Promise<IPagination<IEstimate>> {
		return firstValueFrom(this.http.get<IPagination<IEstimate>>(`${this.baseUrl}/estimates`));
	}

	/**
	 * Fetches a single estimate by id (`GET /estimates/:id`), loading its line items via
	 * the metadata-only `lines` relation.
	 */
	getById(id: ID, relations: string[] = ['lines']): Promise<IEstimate> {
		return firstValueFrom(
			this.http.get<IEstimate>(`${this.baseUrl}/estimates/${id}`, { params: toParams({ relations }) })
		);
	}

	/** Creates an estimate (`POST /estimates`). */
	create(body: IEstimateCreateInput): Promise<IEstimate> {
		return firstValueFrom(this.http.post<IEstimate>(`${this.baseUrl}/estimates`, body));
	}

	/** Updates a DRAFT estimate's status/fields (`PUT /estimates/:id`). */
	update(id: ID, body: { status?: string }): Promise<IEstimate> {
		return firstValueFrom(this.http.put<IEstimate>(`${this.baseUrl}/estimates/${id}`, body));
	}

	/** Adds a line to a DRAFT estimate (`POST /estimates/:id/lines`). */
	addLine(id: ID, line: IEstimateLineInput): Promise<IEstimateLine> {
		return firstValueFrom(this.http.post<IEstimateLine>(`${this.baseUrl}/estimates/${id}/lines`, line));
	}

	/** Updates a line on a DRAFT estimate (`PUT /estimate-lines/:id`). */
	updateLine(lineId: ID, line: IEstimateLineInput): Promise<IEstimateLine> {
		return firstValueFrom(this.http.put<IEstimateLine>(`${this.baseUrl}/estimate-lines/${lineId}`, line));
	}

	/** Creates a new DRAFT revision of an estimate (`POST /estimates/:id/revisions`). */
	revise(id: ID): Promise<IEstimate> {
		return firstValueFrom(this.http.post<IEstimate>(`${this.baseUrl}/estimates/${id}/revisions`, {}));
	}

	/** Finalizes a DRAFT estimate (`POST /estimates/:id/finalize`). */
	finalize(id: ID): Promise<IEstimate> {
		return firstValueFrom(this.http.post<IEstimate>(`${this.baseUrl}/estimates/${id}/finalize`, {}));
	}

	/** Sends a FINALIZED estimate (`POST /estimates/:id/send`). */
	send(id: ID): Promise<IEstimate> {
		return firstValueFrom(this.http.post<IEstimate>(`${this.baseUrl}/estimates/${id}/send`, {}));
	}

	/**
	 * Creates a secure customer approval request for an estimate (`POST /customer-work-approval-requests`).
	 * The response carries the raw secure `token` exactly once (it is never persisted or
	 * returned again); the caller surfaces it to the employee for manual sharing in this slice.
	 */
	createApprovalRequest(estimateId: ID): Promise<ICustomerWorkApprovalRequestCreateResponse> {
		return firstValueFrom(
			this.http.post<ICustomerWorkApprovalRequestCreateResponse>(
				`${this.baseUrl}/customer-work-approval-requests`,
				{ estimateId }
			)
		);
	}
}
