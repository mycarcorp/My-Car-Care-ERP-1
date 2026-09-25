import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe } from '../shared/pipes';
import { PurchaseReceiptService } from './purchase-receipt.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/purchase-receipts')
export class PurchaseReceiptController {
	constructor(private readonly receipts: PurchaseReceiptService) {}
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id')
	find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.receipts.findPosted(id);
	}
}
