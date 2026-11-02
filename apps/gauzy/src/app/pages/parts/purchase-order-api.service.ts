import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IPurchaseOrder, IPurchaseReceipt } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * Client for the purchasing/receiving endpoints (`/purchase-orders`). Status
 * transitions are server-side and idempotent; the UI never posts totals or
 * forces duplicate receiving (the backend guards both).
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOrderApiService {
	private readonly baseUrl = `${API_PREFIX}/purchase-orders`;

	constructor(private readonly http: HttpClient) {}

	list(): Promise<IPurchaseOrder[]> {
		return firstValueFrom(this.http.get<IPurchaseOrder[]>(this.baseUrl)).then(
			(res: any) => (Array.isArray(res) ? res : res?.items ?? [])
		);
	}

	getById(id: ID): Promise<IPurchaseOrder> {
		return firstValueFrom(this.http.get<IPurchaseOrder>(`${this.baseUrl}/${id}`));
	}

	/** DRAFT -> ORDERED */
	order(id: ID): Promise<IPurchaseOrder> {
		return firstValueFrom(this.http.post<IPurchaseOrder>(`${this.baseUrl}/${id}/order`, {}));
	}

	/** DRAFT/ORDERED -> CANCELLED (blocked once receiving starts). */
	cancel(id: ID): Promise<IPurchaseOrder> {
		return firstValueFrom(this.http.post<IPurchaseOrder>(`${this.baseUrl}/${id}/cancel`, {}));
	}

	/** Records a receipt against the order (server posts stock movements, dedup-guarded). */
	recordReceipt(id: ID, body: Partial<IPurchaseReceipt>): Promise<IPurchaseReceipt> {
		return firstValueFrom(this.http.post<IPurchaseReceipt>(`${this.baseUrl}/${id}/receipts`, body));
	}

	/** Lists receipts for the order. */
	listReceipts(id: ID): Promise<IPurchaseReceipt[]> {
		return firstValueFrom(this.http.get<IPurchaseReceipt[]>(`${this.baseUrl}/${id}/receipts`));
	}
}
