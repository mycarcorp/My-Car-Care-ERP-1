import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerWorkApprovalChannelEnum, CustomerWorkApprovalDeliveryChannelEnum } from '@gauzy/contracts';

export class CreateCustomerWorkApprovalRequestDTO {
	@IsUUID() estimateId: string;

	@IsOptional()
	@IsEnum(CustomerWorkApprovalDeliveryChannelEnum)
	deliveryChannel?: CustomerWorkApprovalDeliveryChannelEnum;
}

export class CustomerWorkApprovalLineDecisionDTO {
	@IsUUID() estimateLineId: string;
	@IsBoolean() selected: boolean;
}

export class SubmitCustomerWorkApprovalDTO {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CustomerWorkApprovalLineDecisionDTO)
	decisions: CustomerWorkApprovalLineDecisionDTO[];
}

export class PublicCustomerWorkApprovalTokenDTO {
	@IsNotEmpty() @IsString() token: string;
}

export class DeliverCustomerWorkApprovalRequestDTO extends PublicCustomerWorkApprovalTokenDTO {
	@IsOptional()
	@IsEnum(CustomerWorkApprovalDeliveryChannelEnum)
	deliveryChannel?: CustomerWorkApprovalDeliveryChannelEnum;
}

export class SubmissionChannelDTO {
	channel: CustomerWorkApprovalChannelEnum = CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK;
}
