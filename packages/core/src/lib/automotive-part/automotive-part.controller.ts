import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import {
	CreateAutomotivePartDTO,
	CreateAutomotivePartVendorDTO,
	CreatePartInventoryAdjustmentDTO,
	ConsumeAutomotiveJobPartDTO,
	ReverseAutomotiveJobPartDTO,
	UpdateAutomotivePartDTO,
	UpdateAutomotivePartVendorDTO
} from './dto';
import { AutomotivePartService } from './automotive-part.service';
import { AutomotivePartVendorService } from './automotive-part-vendor.service';
import { PartStockMovementService } from './part-stock-movement.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/automotive-parts')
export class AutomotivePartController {
	constructor(
		private readonly parts: AutomotivePartService,
		private readonly vendors: AutomotivePartVendorService,
		private readonly stock: PartStockMovementService
	) {}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	create(@Body() body: CreateAutomotivePartDTO) {
		return this.parts.createAutomotivePart(body);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get()
	findAll() {
		return this.parts.findAll({});
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id')
	find(@Param('id', UUIDValidationPipe) id: ID) {
		return this.parts.findOneByIdString(id);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Put(':id')
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateAutomotivePartDTO) {
		return this.parts.updateAutomotivePart(id, body);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post(':id/vendors')
	addVendor(@Param('id', UUIDValidationPipe) id: ID, @Body() body: CreateAutomotivePartVendorDTO) {
		return this.vendors.createForPart(id, body);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id/vendors')
	findVendors(@Param('id', UUIDValidationPipe) id: ID) {
		return this.vendors.findForPart(id);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Put('/vendors/:id')
	updateVendor(@Param('id', UUIDValidationPipe) id: ID, @Body() body: UpdateAutomotivePartVendorDTO) {
		return this.vendors.updateVendor(id, body);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/vendors/:id')
	removeVendor(@Param('id', UUIDValidationPipe) id: ID) {
		return this.vendors.removeVendor(id);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post(':id/inventory-adjustments')
	adjust(@Param('id', UUIDValidationPipe) id: ID, @Body() body: CreatePartInventoryAdjustmentDTO) {
		return this.stock.adjust(id, body);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id/stock')
	stockBalances(@Param('id', UUIDValidationPipe) id: ID) {
		return this.stock.stock(id);
	}

	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id/stock-movements')
	stockMovements(@Param('id', UUIDValidationPipe) id: ID) {
		return this.stock.movements(id);
	}
}

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/automotive-jobs/:jobId/parts/consumptions')
export class AutomotiveJobPartConsumptionController {
	constructor(private readonly stock: PartStockMovementService) {}

	@Permissions(PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_CONSUME)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	consume(@Param('jobId', UUIDValidationPipe) jobId: ID, @Body() body: ConsumeAutomotiveJobPartDTO) {
		return this.stock.consumeForJob(jobId, body);
	}

	@Permissions(PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_VIEW)
	@Get()
	list(@Param('jobId', UUIDValidationPipe) jobId: ID) {
		return this.stock.consumptionsForJob(jobId);
	}

	@Permissions(PermissionsEnum.ORG_AUTOMOTIVE_JOB_PART_REVERSE)
	@Post(':movementId/reverse')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	reverse(
		@Param('jobId', UUIDValidationPipe) jobId: ID,
		@Param('movementId', UUIDValidationPipe) movementId: ID,
		@Body() body: ReverseAutomotiveJobPartDTO
	) {
		return this.stock.reverseForJob(jobId, movementId, body.reason);
	}
}
