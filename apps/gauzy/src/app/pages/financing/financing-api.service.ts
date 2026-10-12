import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IFinancingApplication,
	IFinancingApplicationCreateInput,
	IFinancingApplicationTransitionInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Thin API client for the Financing backend (`/financing`). Mirrors the
 * Inspection/Diagnostics/Vehicle API service conventions. No new backend endpoints.
 */
@Injectable({ providedIn: 'root' })
export class FinancingApiService {
	private readonly baseUrl = `${API_PREFIX}/financing`;

	constructor(private readonly http: HttpClient) {}

	/** Lists financing applications (`GET /financing`), optionally filtered (e.g. by repairOrderId). */
	list(where?: Record<string, unknown>, relations: string[] = ['customer', 'vehicle', 'repairOrder']): Promise<IPagination<IFinancingApplication>> {
		return firstValueFrom(
			this.http.get<IPagination<IFinancingApplication>>(this.baseUrl, {
				params: toParams({ ...(where ? { where } : {}), relations })
			})
		);
	}

	/**
	 * Finds financing applications for a repair order via the existing list endpoint filtered by
	 * `repairOrderId`. There is no dedicated `/financing/repair-order/:id` endpoint.
	 */
	listByRepairOrder(repairOrderId: ID): Promise<IPagination<IFinancingApplication>> {
		return this.list({ repairOrderId });
	}

	/** Fetches a financing application by id (`GET /financing/:id`), with relations. */
	getById(
		id: ID,
		relations: string[] = ['customer', 'vehicle', 'repairOrder', 'estimate']
	): Promise<IFinancingApplication> {
		return firstValueFrom(
			this.http.get<IFinancingApplication>(`${this.baseUrl}/${id}`, { params: toParams({ relations }) })
		);
	}

	/** Creates a financing application (DRAFT) (`POST /financing`). */
	create(body: IFinancingApplicationCreateInput): Promise<IFinancingApplication> {
		return firstValueFrom(this.http.post<IFinancingApplication>(this.baseUrl, body));
	}

	/** Applies a controlled lifecycle transition (`POST /financing/:id/transition`). */
	transition(id: ID, input: IFinancingApplicationTransitionInput): Promise<IFinancingApplication> {
		return firstValueFrom(this.http.post<IFinancingApplication>(`${this.baseUrl}/${id}/transition`, input));
	}
}
