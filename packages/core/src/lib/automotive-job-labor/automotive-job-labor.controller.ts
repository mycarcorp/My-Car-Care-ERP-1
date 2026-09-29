import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ID, IAutomotiveJobLabor, IAutomotiveJobLaborView, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { TimerService } from '../time-tracking/timer/timer.service';
import { AutomotiveJobLaborService } from './automotive-job-labor.service';
import { CreateAutomotiveJobLaborDTO, UpdateAutomotiveJobLaborDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class AutomotiveJobLaborController {
	constructor(
		private readonly labor: AutomotiveJobLaborService,
		private readonly timer: TimerService
	) {}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_VIEW)
	@Get('/automotive-jobs/:jobId/labor')
	list(@Param('jobId', UUIDValidationPipe) jobId: ID): Promise<IAutomotiveJobLaborView[]> {
		return this.labor.listForJob(jobId);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_EDIT)
	@Post('/automotive-jobs/:jobId/labor')
	@UseValidationPipe({ transform: true, whitelist: true })
	create(
		@Param('jobId', UUIDValidationPipe) jobId: ID,
		@Body() body: CreateAutomotiveJobLaborDTO
	): Promise<IAutomotiveJobLabor> {
		return this.labor.createLabor(jobId, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_EDIT)
	@Put('/automotive-job-labor/:laborId')
	@UseValidationPipe({ transform: true, whitelist: true })
	update(
		@Param('laborId', UUIDValidationPipe) laborId: ID,
		@Body() body: UpdateAutomotiveJobLaborDTO
	): Promise<IAutomotiveJobLabor> {
		return this.labor.updateLabor(laborId, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_LABOR_COMPLETE)
	@Patch('/automotive-job-labor/:laborId/complete')
	complete(@Param('laborId', UUIDValidationPipe) laborId: ID): Promise<IAutomotiveJobLabor> {
		return this.labor.complete(laborId);
	}

	@Permissions(PermissionsEnum.TIME_TRACKER)
	@Post('/automotive-job-labor/:laborId/clock/start')
	@UseValidationPipe({ transform: true, whitelist: true })
	async startClock(@Param('laborId', UUIDValidationPipe) laborId: ID): Promise<unknown> {
		const labor = await this.labor.findLabor(laborId);
		const job = await this.labor.findJob(labor.automotiveJobId);
		const log = await this.timer.startAutomotiveJobLaborClock(job.id, labor.id);
		await this.labor.markInProgress(labor.id);
		return log;
	}

	@Permissions(PermissionsEnum.TIME_TRACKER)
	@Post('/automotive-job-labor/:laborId/clock/stop')
	stopClock(@Param('laborId', UUIDValidationPipe) laborId: ID): Promise<unknown> {
		return this.timer.stopAutomotiveJobLaborClock(laborId);
	}
}
