import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, IInspection, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CreateInspectionDTO } from './dto';
import { Inspection } from './inspection.entity';
import { InspectionService } from './inspection.service';

@ApiTags('Inspection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/inspections')
export class InspectionController {
	constructor(private readonly inspectionService: InspectionService) {}

	@ApiOperation({ summary: 'Find an inspection by id (with findings)' })
	@Get(':id')
	@Permissions(PermissionsEnum.ORG_INSPECTION_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IInspection> {
		return this.inspectionService.findByIdWithFindings(id);
	}

	@ApiOperation({ summary: 'Find the inspection for a repair order (with findings)' })
	@Get('repair-order/:repairOrderId')
	@Permissions(PermissionsEnum.ORG_INSPECTION_VIEW)
	async findByRepairOrder(
		@Param('repairOrderId', UUIDValidationPipe) repairOrderId: ID
	): Promise<IInspection> {
		return this.inspectionService.findByRepairOrderWithFindings(repairOrderId);
	}

	@Post()
	@Permissions(PermissionsEnum.ORG_INSPECTION_CREATE)
	@UseValidationPipe({ transform: true })
	@ApiCreatedResponse({ type: Inspection })
	async create(@Body() input: CreateInspectionDTO): Promise<IInspection> {
		return this.inspectionService.createInspection(input);
	}

	@ApiOperation({ summary: 'Start an inspection (DRAFT → IN_PROGRESS)' })
	@Patch(':id/start')
	@Permissions(PermissionsEnum.ORG_INSPECTION_EDIT)
	async start(@Param('id', UUIDValidationPipe) id: ID): Promise<IInspection> {
		return this.inspectionService.start(id);
	}

	@ApiOperation({ summary: 'Complete an inspection (IN_PROGRESS → COMPLETED)' })
	@Patch(':id/complete')
	@Permissions(PermissionsEnum.ORG_INSPECTION_COMPLETE)
	async complete(@Param('id', UUIDValidationPipe) id: ID): Promise<IInspection> {
		return this.inspectionService.complete(id);
	}
}
