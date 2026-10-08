import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IInspection, IInspectionCreateInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Thin API client for the Inspection backend (`/inspections`). Mirrors the
 * Vehicle/Repair Order API service conventions. No new backend endpoints are introduced.
 */
@Injectable({ providedIn: 'root' })
export class InspectionApiService {
	private readonly baseUrl = `${API_PREFIX}/inspections`;

	constructor(private readonly http: HttpClient) {}

	/** Fetches an inspection by id, including its findings (`GET /inspections/:id`). */
	getById(id: ID, relations: string[] = ['findings']): Promise<IInspection> {
		return firstValueFrom(
			this.http.get<IInspection>(`${this.baseUrl}/${id}`, { params: toParams({ relations }) })
		);
	}

	/**
	 * Fetches the inspection for a repair order, including findings
	 * (`GET /inspections/repair-order/:repairOrderId`). Surfaces the backend's not-found
	 * behavior when the RO has no inspection.
	 */
	getByRepairOrder(repairOrderId: ID): Promise<IInspection> {
		return firstValueFrom(this.http.get<IInspection>(`${this.baseUrl}/repair-order/${repairOrderId}`));
	}

	/** Creates an inspection (DRAFT) with its findings (`POST /inspections`). */
	create(body: IInspectionCreateInput): Promise<IInspection> {
		return firstValueFrom(this.http.post<IInspection>(this.baseUrl, body));
	}

	/** Starts an inspection (DRAFT → IN_PROGRESS) (`PATCH /inspections/:id/start`). */
	start(id: ID): Promise<IInspection> {
		return firstValueFrom(this.http.patch<IInspection>(`${this.baseUrl}/${id}/start`, {}));
	}

	/** Completes an inspection (IN_PROGRESS → COMPLETED) (`PATCH /inspections/:id/complete`). */
	complete(id: ID): Promise<IInspection> {
		return firstValueFrom(this.http.patch<IInspection>(`${this.baseUrl}/${id}/complete`, {}));
	}
}
