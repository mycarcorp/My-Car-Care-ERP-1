import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
	FinancingApplicationStatusEnum,
	IFinancingApplicationCreateInput,
	IFinancingApplicationTransitionInput,
	IFinancingApplicationUpdateInput
} from '@gauzy/contracts';

export class CreateFinancingApplicationDTO implements IFinancingApplicationCreateInput {
	@ApiProperty() @IsUUID() repairOrderId: string;
	@ApiProperty() @IsUUID() estimateId: string;
	@ApiProperty() @IsUUID() customerWorkApprovalId: string;
	@ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
	@ApiProperty() @IsNumber() @Min(0) requestedAmount: number;
	@ApiProperty() @IsString() @IsNotEmpty() currency: string;
}

export class UpdateFinancingApplicationDTO implements IFinancingApplicationUpdateInput {
	@ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
	@ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) requestedAmount?: number;
	@ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
}

export class TransitionFinancingApplicationDTO implements IFinancingApplicationTransitionInput {
	@ApiProperty({ enum: FinancingApplicationStatusEnum })
	@IsEnum(FinancingApplicationStatusEnum)
	status: FinancingApplicationStatusEnum;

	@ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) approvedAmount?: number;
	@ApiPropertyOptional() @IsOptional() @IsString() rejectionReason?: string;
}
