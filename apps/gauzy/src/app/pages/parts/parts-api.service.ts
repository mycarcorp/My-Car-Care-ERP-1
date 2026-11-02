import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IPartStockMovement,
	IAutomotivePartProfile,
	IAutomotivePartVendor,
	PartStockMovementTypeEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Client for the automotive Parts & Inventory endpoints (`/automotive-parts`).
 * Backed by the authoritative backend controller; reads use ORG_INVENTORY_VIEW,
 * mutations use ORG_INVENTORY_PRODUCT_EDIT. Purchasing/receiving go through the
 * separate `/purchase-orders` endpoints (see PurchaseOrderApiService).
 */
@Injectable({ providedIn: 'root' })
export class PartsApiService {
	private readonly baseUrl = `${API_PREFIX}/automotive-parts`;

	constructor(private readonly http: HttpClient) {}

	/** Lists all part profiles for the current organization (array, not paginated). */
	list(): Promise<IAutomotivePartProfile[]> {
		return firstValueFrom(this.http.get<IAutomotivePartProfile[]>(this.baseUrl)).then(
			(res: any) => (Array.isArray(res) ? res : res?.items ?? [])
		);
	}

	/** Fetches a single part profile by id. */
	getById(id: ID): Promise<IAutomotivePartProfile> {
		return firstValueFrom(this.http.get<IAutomotivePartProfile>(`${this.baseUrl}/${id}`));
	}

	/** Current stock balances (WarehouseProductVariant[]) across warehouses. */
	getStock(id: ID): Promise<any[]> {
		return firstValueFrom(this.http.get<any[]>(`${this.baseUrl}/${id}/stock`));
	}

	/** Stock movement audit history for the part. */
	getStockMovements(id: ID): Promise<IPartStockMovement[]> {
		return firstValueFrom(this.http.get<IPartStockMovement[]>(`${this.baseUrl}/${id}/stock-movements`));
	}

	/** Suppliers (vendors) linked to the part. */
	getVendors(id: ID): Promise<IAutomotivePartVendor[]> {
		return firstValueFrom(this.http.get<IAutomotivePartVendor[]>(`${this.baseUrl}/${id}/vendors`));
	}

	/** Creates a part profile. */
	create(body: Partial<IAutomotivePartProfile>): Promise<IAutomotivePartProfile> {
		return firstValueFrom(this.http.post<IAutomotivePartProfile>(this.baseUrl, body));
	}

	/** Updates a part profile. */
	update(id: ID, body: Partial<IAutomotivePartProfile>): Promise<IAutomotivePartProfile> {
		return firstValueFrom(this.http.put<IAutomotivePartProfile>(`${this.baseUrl}/${id}`, body));
	}

	/** Records a manual inventory adjustment (in/out). Server updates the running balance. */
	adjust(
		id: ID,
		body: {
			warehouseId: ID;
			warehouseProductVariantId: ID;
			type: PartStockMovementTypeEnum;
			quantity: number;
			reason: string;
			notes?: string;
		}
	): Promise<IPartStockMovement> {
		return firstValueFrom(this.http.post<IPartStockMovement>(`${this.baseUrl}/${id}/inventory-adjustments`, body));
	}
}
