import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IPagination,
	IRepairOrder,
	IRepairOrderArrivalInput,
	IRepairOrderCancelInput,
	IRepairOrderCloseInput,
	IServiceHistoryRecord
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class RepairOrderApiService {
	private readonly baseUrl = API_PREFIX;

	constructor(private readonly http: HttpClient) {}

	list(): Promise<IPagination<IRepairOrder>> {
		return firstValueFrom(this.http.get<IPagination<IRepairOrder>>(`${this.baseUrl}/repair-orders`));
	}

	getById(id: ID): Promise<IRepairOrder> {
		return firstValueFrom(this.http.get<IRepairOrder>(`${this.baseUrl}/repair-orders/${id}`));
	}

	arrive(body: IRepairOrderArrivalInput): Promise<IRepairOrder> {
		return firstValueFrom(this.http.post<IRepairOrder>(`${this.baseUrl}/repair-orders/arrival`, body));
	}

	close(id: ID, body: IRepairOrderCloseInput = {}): Promise<IRepairOrder> {
		return firstValueFrom(this.http.patch<IRepairOrder>(`${this.baseUrl}/repair-orders/${id}/close`, body));
	}

	cancel(id: ID, body: IRepairOrderCancelInput): Promise<IRepairOrder> {
		return firstValueFrom(this.http.patch<IRepairOrder>(`${this.baseUrl}/repair-orders/${id}/cancel`, body));
	}

	generateInvoice(id: ID): Promise<unknown> {
		return firstValueFrom(this.http.post(`${this.baseUrl}/repair-orders/${id}/invoice`, {}));
	}

	getHistory(id: ID): Promise<IServiceHistoryRecord> {
		return firstValueFrom(
			this.http.get<IServiceHistoryRecord>(`${this.baseUrl}/repair-orders/${id}/history`)
		);
	}

	/**
	 * Fetches the read-only service history records for a vehicle via the
	 * authoritative backend endpoint (`GET /repair-orders/vehicle/:vehicleId/service-history`).
	 */
	getVehicleServiceHistory(vehicleId: ID): Promise<IServiceHistoryRecord[]> {
		return firstValueFrom(
			this.http.get<IServiceHistoryRecord[]>(`${this.baseUrl}/repair-orders/vehicle/${vehicleId}/service-history`)
		);
	}
}
