import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CustomerFollowUp } from './customer-follow-up.entity';
import { CustomerFollowUpService } from './customer-follow-up.service';
import {
	AssignCustomerFollowUpDTO,
	CompleteCustomerFollowUpDTO,
	DeferCustomerFollowUpDTO,
	CreateCustomerFollowUpDTO,
	OverdueCustomerFollowUpDTO,
	TransitionCustomerFollowUpDTO,
	UpdateCustomerFollowUpDTO
} from './dto/customer-follow-up.dto';

@ApiTags('CustomerFollowUp')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/customer-follow-ups')
export class CustomerFollowUpController extends CrudController<CustomerFollowUp> {
	constructor(private readonly followUps: CustomerFollowUpService) {
		super(followUps);
	}

	@ApiOperation({ summary: 'Get customer follow-ups.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found customer follow-ups.', type: CustomerFollowUp })
	@Get('/')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_VIEW)
	@UseValidationPipe()
	findAll(@Query() params: BaseQueryDTO<CustomerFollowUp>) {
		return this.followUps.findAll(params);
	}

	@ApiOperation({ summary: 'Get a customer follow-up by id.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found one follow-up.', type: CustomerFollowUp })
	@Get('/:id')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_VIEW)
	@UseValidationPipe()
	findById(@Param('id', UUIDValidationPipe) id: ID, @Query() params: BaseQueryDTO<CustomerFollowUp>) {
		return this.followUps.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create a customer follow-up.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The follow-up has been created.', type: CustomerFollowUp })
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_ADD)
	@UseValidationPipe({ whitelist: true })
	create(@Body() body: CreateCustomerFollowUpDTO) {
		return this.followUps.createFollowUp(body);
	}

	@ApiOperation({ summary: 'Update a customer follow-up.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The follow-up has been updated.', type: CustomerFollowUp })
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateCustomerFollowUpDTO) {
		return this.followUps.updateFollowUp(id, body);
	}

	@ApiOperation({ summary: 'Assign a customer follow-up owner.' })
	@Post('/:id/assign')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	assign(@Param('id', UUIDValidationPipe) id: ID, @Body() body: AssignCustomerFollowUpDTO) {
		return this.followUps.assign(id, body.ownerEmployeeId);
	}

	@ApiOperation({ summary: 'Transition a customer follow-up status.' })
	@Post('/:id/transition')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	transition(@Param('id', UUIDValidationPipe) id: ID, @Body() body: TransitionCustomerFollowUpDTO) {
		return this.followUps.transition(id, body);
	}

	@ApiOperation({ summary: 'Mark a customer follow-up completed.' })
	@Post('/:id/complete')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	complete(@Param('id', UUIDValidationPipe) id: ID, @Body() body: CompleteCustomerFollowUpDTO) {
		return this.followUps.complete(id, body?.statusReason);
	}

	@ApiOperation({ summary: 'Defer a customer follow-up.' })
	@Post('/:id/defer')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	defer(@Param('id', UUIDValidationPipe) id: ID, @Body() body: DeferCustomerFollowUpDTO) {
		return this.followUps.defer(id, body.deferredUntil, body.statusReason);
	}

	@ApiOperation({ summary: 'Mark a customer follow-up overdue.' })
	@Post('/:id/overdue')
	@Permissions(PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_EDIT)
	@UseValidationPipe({ whitelist: true })
	overdue(@Param('id', UUIDValidationPipe) id: ID, @Body() body: OverdueCustomerFollowUpDTO) {
		return this.followUps.markOverdue(id, body?.statusReason);
	}
}