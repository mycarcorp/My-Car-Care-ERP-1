import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { IRepairOrderArrivalInput } from '@gauzy/contracts';

export class VehicleArrivalDTO implements IRepairOrderArrivalInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly appointmentId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	readonly arrivalOdometer?: number;
}
