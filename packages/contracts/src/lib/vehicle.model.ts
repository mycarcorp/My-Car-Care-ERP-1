import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IOrganizationContact } from './organization-contact.model';

export interface IVehicle extends IBasePerTenantAndOrganizationEntityModel {
	customerId: ID;
	customer?: IOrganizationContact;
	vinNormalized: string;
	vin?: string;
	year: number;
	make: string;
	model: string;
	trim?: string;
	bodyStyle?: string;
	engine?: string;
	drivetrain?: string;
	fuelType?: string;
	transmission?: string;
	plate?: string;
	plateJurisdiction?: string;
	color?: string;
	currentMileage?: number;
	decoderProvider?: string;
	decoderVersion?: string;
	decodedVehicleData?: JsonData;
	decodedAt?: Date;
}

/**
 * Input for a VIN decode request. The VIN is validated and normalized server-side.
 */
export interface IVehicleVinDecodeInput {
	vin: string;
}

/**
 * Provider-agnostic result of decoding a VIN. All fields are optional because
 * providers do not guarantee every attribute for every vehicle.
 */
export interface IVehicleVinDecodeResult {
	vin: string;
	year?: number;
	make?: string;
	model?: string;
	trim?: string;
	bodyStyle?: string;
	engine?: string;
	drivetrain?: string;
	fuelType?: string;
	transmission?: string;
	/** Which decoder produced this result (e.g. 'carsxe'). */
	provider?: string;
	/** Raw provider payload, retained for audit/debug. Never includes credentials. */
	raw?: JsonData;
}
