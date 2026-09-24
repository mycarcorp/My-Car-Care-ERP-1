import { Body, Controller, Get, Param, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { ID } from '@gauzy/contracts';
import { PublicTransformInterceptor } from '../public-transform.interceptor';
import { UUIDValidationPipe } from '../../shared/pipes';
import { PublicCustomerWorkApprovalTokenDTO, SubmitCustomerWorkApprovalDTO } from '../../customer-work-approval/dto';
import { PublicCustomerWorkApprovalService } from './public-customer-work-approval.service';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/customer-work-approval')
export class PublicCustomerWorkApprovalController {
	constructor(private readonly service: PublicCustomerWorkApprovalService) {}

	@Get(':requestId')
	view(@Param('requestId', UUIDValidationPipe) requestId: ID, @Query() query: PublicCustomerWorkApprovalTokenDTO) {
		return this.service.view(requestId, query.token);
	}

	@Post(':requestId/submit')
	submit(
		@Param('requestId', UUIDValidationPipe) requestId: ID,
		@Query() query: PublicCustomerWorkApprovalTokenDTO,
		@Body() body: SubmitCustomerWorkApprovalDTO,
		@Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> }
	) {
		const userAgent = request.headers?.['user-agent'];
		return this.service.submit(requestId, query.token, body, {
			ip: request.ip,
			userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent
		});
	}

	@Get(':requestId/confirmation')
	confirmation(
		@Param('requestId', UUIDValidationPipe) requestId: ID,
		@Query() query: PublicCustomerWorkApprovalTokenDTO
	) {
		return this.service.confirmation(requestId, query.token);
	}
}
