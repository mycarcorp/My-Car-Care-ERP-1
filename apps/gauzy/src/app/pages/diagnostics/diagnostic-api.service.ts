import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IDiagnostic,
	IDiagnosticCreateInput,
	IDiagnosticFinding,
	IDiagnosticFindingCreateInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Thin API client for the Diagnostics backend (`/diagnostics`). Mirrors the
 * Inspection/Vehicle/Repair Order API service conventions. No new backend endpoints.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticApiService {
	private readonly baseUrl = `${API_PREFIX}/diagnostics`;

	constructor(private readonly http: HttpClient) {}

	/** Lists diagnostics (`GET /diagnostics`), optionally filtered (e.g. by inspectionId). */
	list(where?: Record<string, unknown>): Promise<IPagination<IDiagnostic>> {
		return firstValueFrom(this.http.get<IPagination<IDiagnostic>>(this.baseUrl, { params: toParams({ where }) }));
	}

	/**
	 * Finds diagnostics for an inspection via the existing list endpoint filtered by
	 * `inspectionId`. There is no dedicated `/diagnostics/inspection/:id` endpoint.
	 */
	listByInspection(inspectionId: ID): Promise<IPagination<IDiagnostic>> {
		return this.list({ inspectionId });
	}

	/** Fetches a diagnostic by id (`GET /diagnostics/:id`), with relations. */
	getById(id: ID, relations: string[] = ['findings']): Promise<IDiagnostic> {
		return firstValueFrom(
			this.http.get<IDiagnostic>(`${this.baseUrl}/${id}`, { params: toParams({ relations }) })
		);
	}

	/** Creates a diagnostic (DRAFT) with optional initial findings (`POST /diagnostics`). */
	create(body: IDiagnosticCreateInput): Promise<IDiagnostic> {
		return firstValueFrom(this.http.post<IDiagnostic>(this.baseUrl, body));
	}

	/** Updates a non-completed diagnostic's editable fields (`PUT /diagnostics/:id`). */
	update(id: ID, body: Partial<IDiagnosticCreateInput>): Promise<IDiagnostic> {
		return firstValueFrom(this.http.put<IDiagnostic>(`${this.baseUrl}/${id}`, body));
	}

	/** Adds a finding to a non-completed diagnostic (`POST /diagnostics/:id/findings`). */
	addFinding(id: ID, finding: IDiagnosticFindingCreateInput): Promise<IDiagnosticFinding> {
		return firstValueFrom(
			this.http.post<IDiagnosticFinding>(`${this.baseUrl}/${id}/findings`, finding)
		);
	}

	/** Starts a diagnostic (DRAFT → IN_PROGRESS) (`POST /diagnostics/:id/start`). */
	start(id: ID): Promise<IDiagnostic> {
		return firstValueFrom(this.http.post<IDiagnostic>(`${this.baseUrl}/${id}/start`, {}));
	}

	/** Completes a diagnostic (IN_PROGRESS → COMPLETED) (`POST /diagnostics/:id/complete`). */
	complete(id: ID): Promise<IDiagnostic> {
		return firstValueFrom(this.http.post<IDiagnostic>(`${this.baseUrl}/${id}/complete`, {}));
	}
}
