import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IInvoice, IPagination, IRepairOrder, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CancelRepairOrderDTO, CloseRepairOrderDTO, VehicleArrivalDTO } from './dto';
import { RepairOrder } from './repair-order.entity';
import { RepairOrderInvoiceService } from './repair-order-invoice.service';
import { RepairOrderService } from './repair-order.service';

@ApiTags('RepairOrder')
@UseGuards(TenantPermissionGuard)
@Controller('/repair-orders')
export class RepairOrderController {
	constructor(
		private readonly repairOrderService: RepairOrderService,
		private readonly repairOrderInvoiceService: RepairOrderInvoiceService
	) {}

	@Get()
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_VIEW)
	async findAll(@Query() query: BaseQueryDTO<RepairOrder>): Promise<IPagination<IRepairOrder>> {
		return this.repairOrderService.findAll(query);
	}

	@Get(':id')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: FindOptionsQueryDTO<RepairOrder>) {
		return this.repairOrderService.findOneByIdString(id, options);
	}

	@Post('arrival')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_ARRIVE)
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Record vehicle arrival and create the appointment repair order' })
	@ApiCreatedResponse({ type: RepairOrder })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid arrival or duplicate repair order.' })
	async arrive(@Body() input: VehicleArrivalDTO): Promise<IRepairOrder> {
		return this.repairOrderService.arrive(input);
	}

	@Patch(':id/close')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_CLOSE)
	@UseValidationPipe({ transform: true })
	async close(@Param('id', UUIDValidationPipe) id: ID, @Body() input: CloseRepairOrderDTO): Promise<IRepairOrder> {
		return this.repairOrderService.close(id, input);
	}

	@Patch(':id/cancel')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_REPAIR_ORDER_CANCEL)
	@UseValidationPipe({ transform: true })
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Body() input: CancelRepairOrderDTO): Promise<IRepairOrder> {
		return this.repairOrderService.cancel(id, input);
	}

	@Post(':id/invoice')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	async generateInvoice(@Param('id', UUIDValidationPipe) id: ID): Promise<IInvoice> {
		return this.repairOrderInvoiceService.generateForRepairOrder(id);
	}
}
