import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICustomerWorkApproval,
	ICustomerWorkApprovalConfirmationView,
	ICustomerWorkApprovalPublicView,
	ICustomerWorkApprovalSubmitInput,
	ID
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * Thin client for the public (unauthenticated) Customer Work Approval endpoints.
 * The secure approval link carries `requestId` in the path and the raw `token` in the
 * query string; the token is passed straight through and never persisted or logged.
 */
@Injectable({ providedIn: 'root' })
export class PublicCustomerWorkApprovalApiService {
	private readonly baseUrl = `${API_PREFIX}/public/customer-work-approval`;

	constructor(private readonly http: HttpClient) {}

	/** Loads the active request's estimate + lines for the customer to review. */
	view(requestId: ID, token: string): Promise<ICustomerWorkApprovalPublicView | ICustomerWorkApprovalConfirmationView> {
		return firstValueFrom(
			this.http.get<ICustomerWorkApprovalPublicView | ICustomerWorkApprovalConfirmationView>(
				`${this.baseUrl}/${requestId}`,
				{ params: { token } }
			)
		);
	}

	/** Submits the customer's per-line decisions (`POST .../submit`). */
	submit(requestId: ID, token: string, input: ICustomerWorkApprovalSubmitInput): Promise<ICustomerWorkApproval> {
		return firstValueFrom(
			this.http.post<ICustomerWorkApproval>(`${this.baseUrl}/${requestId}/submit`, input, {
				params: { token }
			})
		);
	}

	/** Loads the immutable confirmation for a submitted request. */
	confirmation(requestId: ID, token: string): Promise<ICustomerWorkApprovalConfirmationView> {
		return firstValueFrom(
			this.http.get<ICustomerWorkApprovalConfirmationView>(`${this.baseUrl}/${requestId}/confirmation`, {
				params: { token }
			})
		);
	}
}
