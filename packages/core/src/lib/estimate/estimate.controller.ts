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
@Controller('/estimates')
export class EstimateController {
	constructor(private readonly service: EstimateService) {}
	@Get() @Permissions(PermissionsEnum.ORG_ESTIMATE_VIEW) findAll(@Query() query: BaseQueryDTO<Estimate>) {
		return this.service.findAll(query);
	}
	@Get(':id') @Permissions(PermissionsEnum.ORG_ESTIMATE_VIEW) find(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: FindOptionsQueryDTO<Estimate>
	) {
		return this.service.findOneByIdString(id, query);
	}
	@Post() @Permissions(PermissionsEnum.ORG_ESTIMATE_CREATE) create(@Body() body: CreateEstimateDTO) {
		return this.service.createEstimate(body);
	}
	@Put(':id') @Permissions(PermissionsEnum.ORG_ESTIMATE_EDIT) update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdateEstimateDTO
	) {
		return this.service.updateEstimate(id, body);
	}
	@Post(':id/lines') @Permissions(PermissionsEnum.ORG_ESTIMATE_EDIT) addLine(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: EstimateLineDTO
	) {
		return this.service.addLine(id, body);
	}
	@Post(':id/revisions') @Permissions(PermissionsEnum.ORG_ESTIMATE_EDIT) revision(
		@Param('id', UUIDValidationPipe) id: ID
	) {
		return this.service.createRevision(id);
	}
	@Post(':id/finalize') @Permissions(PermissionsEnum.ORG_ESTIMATE_EDIT) finalize(
		@Param('id', UUIDValidationPipe) id: ID
	): Promise<Estimate> {
		return this.service.finalize(id);
	}
	@Post(':id/send') @Permissions(PermissionsEnum.ORG_ESTIMATE_SEND) send(
		@Param('id', UUIDValidationPipe) id: ID
	): Promise<Estimate> {
		return this.service.send(id);
	}
}
