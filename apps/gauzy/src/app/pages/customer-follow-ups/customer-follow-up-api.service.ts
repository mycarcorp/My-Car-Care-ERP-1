import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	ICustomerFollowUp,
	ICustomerFollowUpCreateInput,
	ICustomerFollowUpTransitionInput,
	ICustomerFollowUpUpdateInput,
	IEmployee,
	IEstimate,
	IInvoice,
	IOrganizationContact,
	IPagination,
	IRepairOrder,
	ITask,
	IVehicle
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

export const CUSTOMER_FOLLOW_UP_RELATIONS = [
	'customer',
	'vehicle',
	'repairOrder',
	'estimate',
	'invoice',
	'task',
	'ownerEmployee'
];

export interface ICustomerFollowUpView extends ICustomerFollowUp {
	customer?: IOrganizationContact;
	vehicle?: IVehicle;
	repairOrder?: IRepairOrder;
	estimate?: IEstimate;
	invoice?: IInvoice;
	task?: ITask;
	ownerEmployee?: IEmployee;
}

@Injectable({ providedIn: 'root' })
export class CustomerFollowUpApiService {
	private readonly baseUrl = `${API_PREFIX}/customer-follow-ups`;

	constructor(private readonly http: HttpClient) {}

	list(relations: string[] = CUSTOMER_FOLLOW_UP_RELATIONS): Promise<IPagination<ICustomerFollowUpView>> {
		return firstValueFrom(this.http.get<IPagination<ICustomerFollowUpView>>(this.baseUrl, { params: toParams({ relations }) }));
	}

	getById(id: ID, relations: string[] = CUSTOMER_FOLLOW_UP_RELATIONS): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.get<ICustomerFollowUpView>(`${this.baseUrl}/${id}`, { params: toParams({ relations }) }));
	}

	create(body: ICustomerFollowUpCreateInput): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(this.baseUrl, body));
	}

	update(id: ID, body: ICustomerFollowUpUpdateInput): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.put<ICustomerFollowUpView>(`${this.baseUrl}/${id}`, body));
	}

	assign(id: ID, ownerEmployeeId: ID): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(`${this.baseUrl}/${id}/assign`, { ownerEmployeeId }));
	}

	transition(id: ID, body: ICustomerFollowUpTransitionInput): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(`${this.baseUrl}/${id}/transition`, body));
	}

	complete(id: ID, statusReason?: string): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(`${this.baseUrl}/${id}/complete`, { statusReason }));
	}

	defer(id: ID, deferredUntil: Date, statusReason?: string): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(`${this.baseUrl}/${id}/defer`, { deferredUntil, statusReason }));
	}

	overdue(id: ID, statusReason?: string): Promise<ICustomerFollowUpView> {
		return firstValueFrom(this.http.post<ICustomerFollowUpView>(`${this.baseUrl}/${id}/overdue`, { statusReason }));
	}
}