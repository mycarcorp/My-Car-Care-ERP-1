import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CreateFinancingApplicationDTO, TransitionFinancingApplicationDTO, UpdateFinancingApplicationDTO } from './dto';
import { FinancingApplication } from './financing-application.entity';
import { FinancingApplicationService } from './financing-application.service';

@ApiTags('FinancingApplication')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/financing')
export class FinancingApplicationController {
	constructor(private readonly service: FinancingApplicationService) {}

	@ApiOperation({ summary: 'List financing applications' })
	@Get()
	@Permissions(PermissionsEnum.ORG_FINANCING_VIEW)
	async findAll(@Query() query: BaseQueryDTO<FinancingApplication>): Promise<IPagination<FinancingApplication>> {
		return this.service.findAll(query);
	}

	@ApiOperation({ summary: 'Find a financing application by id' })
	@Get(':id')
	@Permissions(PermissionsEnum.ORG_FINANCING_VIEW)
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: FindOptionsQueryDTO<FinancingApplication>
	) {
		return this.service.findOneByIdString(id, options);
	}

	@ApiOperation({ summary: 'Create a financing application (DRAFT)' })
	@Post()
	@Permissions(PermissionsEnum.ORG_FINANCING_CREATE)
	@UseValidationPipe({ transform: true })
	@ApiCreatedResponse({ type: FinancingApplication })
	async create(@Body() input: CreateFinancingApplicationDTO): Promise<FinancingApplication> {
		return this.service.createApplication(input);
	}

	@ApiOperation({ summary: 'Edit a DRAFT financing application (non-lifecycle fields only)' })
	@Put(':id')
	@Permissions(PermissionsEnum.ORG_FINANCING_EDIT)
	@UseValidationPipe({ transform: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdateFinancingApplicationDTO) {
		return this.service.updateApplication(id, input);
	}

	@ApiOperation({ summary: 'Apply a controlled lifecycle transition' })
	@Post(':id/transition')
	@Permissions(PermissionsEnum.ORG_FINANCING_EDIT, PermissionsEnum.ORG_FINANCING_APPROVE)
	@UseValidationPipe({ transform: true })
	async transition(@Param('id', UUIDValidationPipe) id: ID, @Body() input: TransitionFinancingApplicationDTO) {
		return this.service.transition(id, input);
	}

	@ApiOperation({ summary: 'Record funding for an accepted application against its repair order invoice' })
	@Post(':id/fund')
	@Permissions(PermissionsEnum.ORG_FINANCING_APPROVE)
	async fund(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.fund(id);
	}
}
