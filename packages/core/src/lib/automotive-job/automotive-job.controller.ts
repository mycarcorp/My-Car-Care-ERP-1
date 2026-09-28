import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import {
	AssignAutomotiveJobDTO,
	CreateAutomotiveJobDTO,
	UpdateAutomotiveJobDTO,
	UpdateAutomotiveJobStatusDTO
} from './dto';
import { AutomotiveJobService } from './automotive-job.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class AutomotiveJobController {
	constructor(private readonly jobs: AutomotiveJobService) {}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD)
	@Post('/repair-orders/:repairOrderId/jobs')
	@UseValidationPipe({ whitelist: true, transform: true })
	create(@Param('repairOrderId', UUIDValidationPipe) repairOrderId: ID, @Body() body: CreateAutomotiveJobDTO) {
		return this.jobs.createForRepairOrder(repairOrderId, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/repair-orders/:repairOrderId/jobs')
	findForRepairOrder(@Param('repairOrderId', UUIDValidationPipe) repairOrderId: ID) {
		return this.jobs.findForRepairOrder(repairOrderId);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/repair-orders/:repairOrderId/authorized-work')
	findAuthorizedWork(@Param('repairOrderId', UUIDValidationPipe) repairOrderId: ID) {
		return this.jobs.findAuthorizedWork(repairOrderId);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW)
	@Get('/automotive-jobs/:id')
	find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.jobs.findOneScoped(id);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Put('/automotive-jobs/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateAutomotiveJobDTO) {
		return this.jobs.updateJob(id, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Patch('/automotive-jobs/:id/assignment')
	@UseValidationPipe({ whitelist: true, transform: true })
	assign(@Param('id', UUIDValidationPipe) id: ID, @Body() body: AssignAutomotiveJobDTO) {
		return this.jobs.assign(id, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT)
	@Patch('/automotive-jobs/:id/status')
	@UseValidationPipe({ whitelist: true, transform: true })
	updateStatus(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateAutomotiveJobStatusDTO) {
		return this.jobs.updateStatus(id, body.status);
	}
}
