import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** DTO for POST /vehicles/decode-vin. */
export class DecodeVehicleVinDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Matches(/^[A-HJ-NPR-Z0-9\s-]{17,34}$/i)
	readonly vin: string;
}
