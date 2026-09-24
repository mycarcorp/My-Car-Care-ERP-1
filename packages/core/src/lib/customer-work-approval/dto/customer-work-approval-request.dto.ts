import { IsArray, IsBoolean, IsNotEmpty, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerWorkApprovalChannelEnum } from '@gauzy/contracts';

export class CreateCustomerWorkApprovalRequestDTO {
	@IsUUID() estimateId: string;
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

export class SubmissionChannelDTO {
	channel: CustomerWorkApprovalChannelEnum = CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK;
}
