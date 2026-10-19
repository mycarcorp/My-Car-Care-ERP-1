import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID
} from 'class-validator';
import { ID, CustomerFollowUpStatusEnum, CustomerFollowUpTypeEnum, CustomerFollowUpSourceEventTypeEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { ICustomerFollowUpCreateInput, ICustomerFollowUpUpdateInput, ICustomerFollowUpAssignInput, ICustomerFollowUpTransitionInput } from '@gauzy/contracts';

export class CreateCustomerFollowUpDTO extends TenantOrganizationBaseDTO implements ICustomerFollowUpCreateInput {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	title: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ enum: CustomerFollowUpTypeEnum })
	@IsEnum(CustomerFollowUpTypeEnum)
	type: CustomerFollowUpTypeEnum;

	@ApiPropertyOptional({ enum: CustomerFollowUpStatusEnum })
	@IsOptional()
	@IsEnum(CustomerFollowUpStatusEnum)
	status?: CustomerFollowUpStatusEnum;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	dueAt?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	scheduledAt?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	statusReason?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	sourceEntityType?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	sourceEntityId?: ID;

	@ApiPropertyOptional({ enum: CustomerFollowUpSourceEventTypeEnum })
	@IsOptional()
	@IsEnum(CustomerFollowUpSourceEventTypeEnum)
	sourceEventType?: CustomerFollowUpSourceEventTypeEnum;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	sourceEventKey?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	sourceEventAt?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	customerId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	vehicleId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	repairOrderId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	estimateId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	invoiceId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	taskId?: ID;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	ownerEmployeeId?: ID;
}

export class UpdateCustomerFollowUpDTO extends PartialType(CreateCustomerFollowUpDTO) implements ICustomerFollowUpUpdateInput {}

export class AssignCustomerFollowUpDTO implements ICustomerFollowUpAssignInput {
	@ApiProperty()
	@IsUUID()
	ownerEmployeeId: ID;
}

export class TransitionCustomerFollowUpDTO implements ICustomerFollowUpTransitionInput {
	@ApiProperty({ enum: CustomerFollowUpStatusEnum })
	@IsEnum(CustomerFollowUpStatusEnum)
	status: CustomerFollowUpStatusEnum;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	statusReason?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	dueAt?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	deferredUntil?: Date;
}

export class CompleteCustomerFollowUpDTO {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	statusReason?: string;
}

export class DeferCustomerFollowUpDTO {
	@ApiProperty()
	@IsDateString()
	deferredUntil: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	statusReason?: string;
}

export class OverdueCustomerFollowUpDTO {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	statusReason?: string;
}