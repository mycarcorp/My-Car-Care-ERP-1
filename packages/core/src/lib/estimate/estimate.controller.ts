import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { Estimate } from './estimate.entity';
import { EstimateService } from './estimate.service';
import { CreateEstimateDTO, EstimateLineDTO, UpdateEstimateDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/estimates')
export class EstimateController {
	constructor(private readonly service: EstimateService) {}
	@Get() findAll(@Query() query: BaseQueryDTO<Estimate>) {
		return this.service.findAll(query);
	}
	@Get(':id') find(@Param('id', UUIDValidationPipe) id: ID, @Query() query: FindOptionsQueryDTO<Estimate>) {
		return this.service.findOneByIdString(id, query);
	}
	@Post() create(@Body() body: CreateEstimateDTO) {
		return this.service.createEstimate(body);
	}
	@Put(':id') update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateEstimateDTO) {
		return this.service.updateEstimate(id, body);
	}
	@Post(':id/lines') addLine(@Param('id', UUIDValidationPipe) id: ID, @Body() body: EstimateLineDTO) {
		return this.service.addLine(id, body);
	}
	@Post(':id/revisions') revision(@Param('id', UUIDValidationPipe) id: ID) {
		return this.service.createRevision(id);
	}
}
