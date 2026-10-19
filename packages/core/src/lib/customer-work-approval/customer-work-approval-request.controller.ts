import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { CreateCustomerWorkApprovalRequestDTO, DeliverCustomerWorkApprovalRequestDTO } from './dto';
import { CustomerWorkApprovalRequestService } from './customer-work-approval-request.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/customer-work-approval-requests')
export class CustomerWorkApprovalRequestController {
	constructor(private readonly service: CustomerWorkApprovalRequestService) {}

	@Post()
	@Permissions(PermissionsEnum.ORG_CUSTOMER_WORK_APPROVAL_CREATE)
	create(@Body() body: CreateCustomerWorkApprovalRequestDTO) {
		return this.service.createRequest(body);
	}

	@Post(':id/deliver')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_WORK_APPROVAL_CREATE)
	deliver(@Param('id', UUIDValidationPipe) id: ID, @Body() body: DeliverCustomerWorkApprovalRequestDTO) {
		return this.service.deliverRequest(id, body.token, body.deliveryChannel);
	}

	@Get(':id')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_WORK_APPROVAL_VIEW)
	find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.findOneByIdString(id);
	}

	@Post(':id/revoke')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_WORK_APPROVAL_REVOKE)
	revoke(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.revoke(id);
	}
}
