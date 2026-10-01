import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ID, IAutomotiveJobQcAttempt, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { AutomotiveJobQcService } from './automotive-job-qc.service';
import { CreateAutomotiveJobQcAttemptDTO, FailAutomotiveJobQcAttemptDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class AutomotiveJobQcController {
	constructor(private readonly qc: AutomotiveJobQcService) {}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_VIEW)
	@Get('/automotive-jobs/:jobId/qc')
	list(@Param('jobId', UUIDValidationPipe) jobId: ID): Promise<IAutomotiveJobQcAttempt[]> {
		return this.qc.listAttempts(jobId);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_START)
	@Post('/automotive-jobs/:jobId/qc')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	create(
		@Param('jobId', UUIDValidationPipe) jobId: ID,
		@Body() body: CreateAutomotiveJobQcAttemptDTO
	): Promise<IAutomotiveJobQcAttempt> {
		return this.qc.createAttempt(jobId, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_PASS)
	@Patch('/automotive-job-qc/:qcId/pass')
	pass(@Param('qcId', UUIDValidationPipe) qcId: ID): Promise<IAutomotiveJobQcAttempt> {
		return this.qc.passAttempt(qcId);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_QC_FAIL)
	@Patch('/automotive-job-qc/:qcId/fail')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	fail(
		@Param('qcId', UUIDValidationPipe) qcId: ID,
		@Body() body: FailAutomotiveJobQcAttemptDTO
	): Promise<IAutomotiveJobQcAttempt> {
		return this.qc.failAttempt(qcId, body);
	}
}