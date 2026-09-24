import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { IInspectionCreateInput, InspectionFindingResultEnum, InspectionStatusEnum } from '@gauzy/contracts';

class InspectionFindingDTO {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	description: string;

	@ApiProperty({ enum: InspectionFindingResultEnum })
	@IsEnum(InspectionFindingResultEnum)
	result: InspectionFindingResultEnum;
}

export class CreateInspectionDTO implements IInspectionCreateInput {
	@ApiProperty()
	@IsUUID()
	repairOrderId: string;

	@ApiProperty()
	@IsUUID()
	vehicleId: string;

	@ApiProperty()
	@IsUUID()
	technicianEmployeeId: string;

	@ApiPropertyOptional({ enum: InspectionStatusEnum })
	@IsOptional()
	@IsEnum(InspectionStatusEnum)
	status?: InspectionStatusEnum;

	@ApiPropertyOptional({ type: () => InspectionFindingDTO, isArray: true })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => InspectionFindingDTO)
	findings?: InspectionFindingDTO[];
}
