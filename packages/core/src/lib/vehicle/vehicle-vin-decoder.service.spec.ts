import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { VehicleVinDecoderService } from './vehicle-vin-decoder.service';

describe('VehicleVinDecoderService', () => {
	const VALID_VIN = '1HGCM82633A004352';

	let service: VehicleVinDecoderService;
	let http: { get: jest.Mock };
	let config: { get: jest.Mock };

	const axiosOk = (data: any): AxiosResponse => ({
		data,
		status: 200,
		statusText: 'OK',
		headers: {},
		config: { headers: new AxiosHeaders() }
	});

	beforeEach(() => {
		http = { get: jest.fn() };
		config = { get: jest.fn() };
		// Default: configured key, default base URL.
		config.get.mockImplementation((key: string) =>
			key === 'carsxeApiKey' ? 'test-key' : undefined
		);
		service = new VehicleVinDecoderService(http as any, config as any);
	});

	it('throws BadRequestException for an invalid VIN (no provider call)', async () => {
		await expect(service.decode('BAD-VIN')).rejects.toBeInstanceOf(BadRequestException);
		expect(http.get).not.toHaveBeenCalled();
	});

	it('throws ServiceUnavailableException when CARSXE_API_KEY is not configured', async () => {
		config.get.mockReturnValue(undefined);
		await expect(service.decode(VALID_VIN)).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(http.get).not.toHaveBeenCalled();
	});

	it('maps a successful provider payload to the result shape', async () => {
		http.get.mockReturnValue(
			of(
				axiosOk({
					success: true,
					attributes: {
						year: '2018',
						make: 'Toyota',
						model: 'Corolla',
						trim: 'LE',
						body_type: 'Sedan',
						engine: '1.8L I4',
						drive_type: 'FWD',
						fuel_type: 'Gasoline',
						transmission: 'Automatic'
					}
				})
			)
		);

		const result = await service.decode(VALID_VIN);

		expect(result).toMatchObject({
			vin: VALID_VIN,
			year: 2018,
			make: 'Toyota',
			model: 'Corolla',
			trim: 'LE',
			bodyStyle: 'Sedan',
			engine: '1.8L I4',
			drivetrain: 'FWD',
			fuelType: 'Gasoline',
			transmission: 'Automatic',
			provider: 'carsxe'
		});
		// The outbound call must include the VIN and key as query params, with a timeout.
		const [url, opts] = http.get.mock.calls[0];
		expect(url).toContain('/specs');
		expect(opts.params.vin).toBe(VALID_VIN);
		expect(opts.timeout).toBeGreaterThan(0);
	});

	it('throws ServiceUnavailableException when the provider errors (rate limit/5xx/timeout)', async () => {
		http.get.mockReturnValue(throwError(() => new Error('timeout')));
		await expect(service.decode(VALID_VIN)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it('throws ServiceUnavailableException when the provider reports success=false', async () => {
		http.get.mockReturnValue(of(axiosOk({ success: false })));
		await expect(service.decode(VALID_VIN)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
