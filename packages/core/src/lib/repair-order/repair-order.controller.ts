import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, IRepairOrder, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { VehicleArrivalDTO } from './dto';
import { RepairOrder } from './repair-order.entity';
import { RepairOrderService } from './repair-order.service';

@ApiTags('RepairOrder')
@UseGuards(TenantPermissionGuard)
@Controller('/repair-orders')
export class RepairOrderController {
	constructor(private readonly repairOrderService: RepairOrderService) {}

	@Get()
	async findAll(@Query() query: BaseQueryDTO<RepairOrder>): Promise<IPagination<IRepairOrder>> {
		return this.repairOrderService.findAll(query);
	}

	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: FindOptionsQueryDTO<RepairOrder>) {
		return this.repairOrderService.findOneByIdString(id, options);
	}

	@Post('arrival')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Record vehicle arrival and create the appointment repair order' })
	@ApiCreatedResponse({ type: RepairOrder })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid arrival or duplicate repair order.' })
	async arrive(@Body() input: VehicleArrivalDTO): Promise<IRepairOrder> {
		return this.repairOrderService.arrive(input);
	}
}
