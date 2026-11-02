import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { IVehicleVinDecodeResult } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';

/** Default CarsXE API base URL (overridable via CARSXE_API_BASE_URL). */
const DEFAULT_CARSXE_BASE_URL = 'https://api.carsxe.com';
/** Provider slug persisted on Vehicle.decoderProvider. */
export const CARSXE_PROVIDER = 'carsxe';
/** Hard ceiling for outbound decode requests (ms). */
const DECODE_TIMEOUT_MS = 10_000;

/**
 * Server-side CarsXE VIN decoder.
 *
 * Security notes:
 * - The API key is read only from server configuration (CARSXE_API_KEY) and is
 *   never logged, returned to the client, or embedded in the persisted vehicle.
 * - The VIN is validated/normalized before any outbound call.
 * - Provider failures (timeout, rate limit, 5xx, bad key) surface as a generic
 *   503 so no provider internals or credentials leak to the client.
 */
@Injectable()
export class VehicleVinDecoderService {
	private readonly logger = new Logger(VehicleVinDecoderService.name);

	constructor(
		private readonly http: HttpService,
		private readonly configService: ConfigService
	) {}

	/**
	 * Decode a VIN via CarsXE.
	 *
	 * @param vin Raw VIN input (validated and normalized here).
	 * @returns Provider-agnostic decode result with optional fields.
	 * @throws BadRequestException if the VIN is invalid.
	 * @throws ServiceUnavailableException if the decoder is not configured or the provider fails.
	 */
	async decode(vin: string): Promise<IVehicleVinDecodeResult> {
		const normalizedVin = this.normalizeVin(vin);

		const apiKey = this.configService.get('carsxeApiKey');
		if (!apiKey) {
			this.logger.warn('VIN decode requested but CARSXE_API_KEY is not configured.');
			throw new ServiceUnavailableException(
				'VIN decoding is not configured on this server. Set CARSXE_API_KEY to enable it.'
			);
		}

		const baseUrl = this.configService.get('carsxeApiBaseUrl') || DEFAULT_CARSXE_BASE_URL;
		const url = `${baseUrl.replace(/\/$/, '')}/specs`;

		let payload: any;
		try {
			payload = await firstValueFrom(
				this.http.get(url, {
					params: { vin: normalizedVin, key: apiKey },
					timeout: DECODE_TIMEOUT_MS
				}).pipe(
					map((resp: AxiosResponse<any>) => resp.data),
					catchError((error: AxiosError) => {
						// Never log the API key or full request URL (which contains the key).
						const status = error?.response?.status;
						this.logger.warn(`CarsXE decode failed (status=${status ?? 'network/timeout'}).`);
						throw new ServiceUnavailableException('VIN decode provider is unavailable.');
					})
				)
			);
		} catch (err) {
			if (err instanceof ServiceUnavailableException) {
				throw err;
			}
			this.logger.warn('CarsXE decode failed unexpectedly.');
			throw new ServiceUnavailableException('VIN decode provider is unavailable.');
		}

		if (!payload || payload.success === false) {
			throw new ServiceUnavailableException('VIN decode provider returned no data for this VIN.');
		}

		return this.mapPayload(normalizedVin, payload);
	}

	/** Normalize and validate a VIN. Mirrors VehicleService rules. */
	private normalizeVin(vin?: string): string {
		const normalized = vin?.replace(/[\s-]/g, '').toUpperCase();
		if (!normalized || !/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
			throw new BadRequestException('VIN must be 17 characters and cannot contain I, O, or Q.');
		}
		return normalized;
	}

	/** Map the CarsXE /specs payload to the provider-agnostic result shape. */
	private mapPayload(vin: string, payload: any): IVehicleVinDecodeResult {
		const attributes = payload?.attributes ?? payload;
		const toInt = (v: any): number | undefined => {
			const n = parseInt(v, 10);
			return Number.isFinite(n) ? n : undefined;
		};
		const str = (v: any): string | undefined =>
			typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

		return {
			vin,
			year: toInt(attributes?.year ?? attributes?.made_year),
			make: str(attributes?.make),
			model: str(attributes?.model),
			trim: str(attributes?.trim),
			bodyStyle: str(attributes?.body_type ?? attributes?.body_style),
			engine: str(attributes?.engine ?? attributes?.engine_size),
			drivetrain: str(attributes?.drive_type ?? attributes?.drivetrain),
			fuelType: str(attributes?.fuel_type),
			transmission: str(attributes?.transmission),
			provider: CARSXE_PROVIDER,
			raw: payload
		};
	}
}
