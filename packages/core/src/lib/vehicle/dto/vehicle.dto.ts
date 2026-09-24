import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDateString,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	Matches
} from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class VehicleDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly customerId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Length(17, 17)
	@Matches(/^[A-HJ-NPR-Z0-9\s-]{17,34}$/i)
	readonly vinNormalized: string;

	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1886)
	@Max(2100)
	readonly year: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly make: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly model: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly vin?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly trim?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly bodyStyle?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly engine?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly drivetrain?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly fuelType?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly transmission?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly plate?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly plateJurisdiction?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly color?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	readonly currentMileage?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly decoderProvider?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly decoderVersion?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly decodedVehicleData?: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => String, format: 'date-time' })
	@IsOptional()
	@IsDateString()
	readonly decodedAt?: Date;
}
