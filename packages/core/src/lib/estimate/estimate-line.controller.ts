import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { EstimateLineDTO } from './dto';
import { EstimateService } from './estimate.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/estimate-lines')
export class EstimateLineController {
	constructor(private readonly service: EstimateService) {}
	@Put(':id')
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() line: EstimateLineDTO) {
		return this.service.updateLine(id, line);
	}
}
