import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IRepairOrderCloseInput } from '@gauzy/contracts';

export class CloseRepairOrderDTO implements IRepairOrderCloseInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly closeNotes?: string;
}
