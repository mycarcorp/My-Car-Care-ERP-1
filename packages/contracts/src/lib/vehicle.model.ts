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
