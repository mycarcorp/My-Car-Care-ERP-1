import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { CreateCustomerWorkApprovalRequestDTO } from './dto';
import { CustomerWorkApprovalRequestService } from './customer-work-approval-request.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/customer-work-approval-requests')
export class CustomerWorkApprovalRequestController {
	constructor(private readonly service: CustomerWorkApprovalRequestService) {}

	@Post()
	create(@Body() body: CreateCustomerWorkApprovalRequestDTO) {
		return this.service.createRequest(body);
	}

	@Get(':id')
	find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.findOneByIdString(id);
	}

	@Post(':id/revoke')
	revoke(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.revoke(id);
	}
}
