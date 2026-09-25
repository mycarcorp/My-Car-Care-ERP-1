import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { CreatePurchaseOrderDTO, CreatePurchaseReceiptDTO, UpdatePurchaseOrderDTO } from './dto';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseReceiptService } from './purchase-receipt.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/purchase-orders')
export class PurchaseOrderController {
	constructor(
		private readonly orders: PurchaseOrderService,
		private readonly receipts: PurchaseReceiptService
	) {}
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT) @Post() create(@Body() body: CreatePurchaseOrderDTO) {
		return this.orders.createPurchaseOrder(body);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW) @Get() findAll() {
		return this.orders.findAll({});
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW) @Get(':id') find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.orders.findOneByIdString(id);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT) @Put(':id') update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdatePurchaseOrderDTO
	) {
		return this.orders.updateDraft(id, body);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT) @Post(':id/order') order(
		@Param('id', UUIDValidationPipe) id: ID
	) {
		return this.orders.order(id);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT) @Post(':id/cancel') cancel(
		@Param('id', UUIDValidationPipe) id: ID
	) {
		return this.orders.cancel(id);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT) @Post(':id/receipts') receipt(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: CreatePurchaseReceiptDTO
	) {
		return this.receipts.post(id, body);
	}
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW) @Get(':id/receipts') receiptsForOrder(
		@Param('id', UUIDValidationPipe) id: ID
	) {
		return this.receipts.list(id);
	}
}
