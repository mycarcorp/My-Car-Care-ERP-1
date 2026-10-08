import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ServiceCenterDashboardService } from './service-center-dashboard.service';

/**
 * Read-only Service Center Command Center. Exposes a single consolidated summary
 * endpoint; performs no mutations.
 */
@ApiTags('ServiceCenterDashboard')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/service-center/dashboard')
export class ServiceCenterDashboardController {
	constructor(private readonly service: ServiceCenterDashboardService) {}

	@ApiOperation({ summary: 'Get the read-only Service Center Command Center summary' })
	@Get('summary')
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_VIEW)
	async getSummary() {
		return this.service.getSummary();
	}
}
