import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IPagination, IVehicle } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class VehicleApiService {
	private readonly baseUrl = API_PREFIX;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Programmatic list access; the list page itself is backed by a ServerDataSource
	 * on the same pagination endpoint.
	 */
	list(): Promise<IPagination<IVehicle>> {
		return firstValueFrom(this.http.get<IPagination<IVehicle>>(`${this.baseUrl}/vehicles/pagination`));
	}

	/**
	 * Fetches a single vehicle by id. The vehicle controller has no `GET /vehicles/:id`
	 * endpoint, so this goes through `GET /vehicles` with a `data` query param and
	 * takes the first matching item.
	 */
	async getById(id: ID): Promise<IVehicle> {
		const data = JSON.stringify({ findInput: { id }, relations: ['customer'] });
		const { items } = await firstValueFrom(
			this.http.get<IPagination<IVehicle>>(`${this.baseUrl}/vehicles`, { params: { data } })
		);
		const vehicle = items?.[0];
		if (!vehicle) {
			throw new Error('Vehicle not found');
		}
		return vehicle;
	}

	/**
	 * Creates a vehicle (minimal registration) via `POST /vehicles`
	 * (backend permission: PermissionsEnum.ALL_ORG_EDIT).
	 */
	create(body: Partial<IVehicle>): Promise<IVehicle> {
		return firstValueFrom(this.http.post<IVehicle>(`${this.baseUrl}/vehicles`, body));
	}

	/**
	 * Updates a vehicle via `PUT /vehicles/:id`
	 * (backend permission: PermissionsEnum.ALL_ORG_EDIT).
	 */
	update(id: ID, body: Partial<IVehicle>): Promise<IVehicle> {
		return firstValueFrom(this.http.put<IVehicle>(`${this.baseUrl}/vehicles/${id}`, body));
	}
}
