import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IRepairOrderCancelInput } from '@gauzy/contracts';

export class CancelRepairOrderDTO implements IRepairOrderCancelInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly cancelReason: string;
}
