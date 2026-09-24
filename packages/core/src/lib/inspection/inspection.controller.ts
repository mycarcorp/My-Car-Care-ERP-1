import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IInspection, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { CreateInspectionDTO } from './dto';
import { Inspection } from './inspection.entity';
import { InspectionService } from './inspection.service';

@ApiTags('Inspection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller('/inspections')
export class InspectionController {
	constructor(private readonly inspectionService: InspectionService) {}

	@Post()
	@UseValidationPipe({ transform: true })
	@ApiCreatedResponse({ type: Inspection })
	async create(@Body() input: CreateInspectionDTO): Promise<IInspection> {
		return this.inspectionService.createInspection(input);
	}
}
