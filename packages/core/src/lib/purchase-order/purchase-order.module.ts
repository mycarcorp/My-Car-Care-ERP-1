import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomotivePartModule } from '../automotive-part/automotive-part.module';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { OrganizationVendor } from '../organization-vendor/organization-vendor.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseReceiptController } from './purchase-receipt.controller';
import { PurchaseReceiptLine } from './purchase-receipt-line.entity';
import { PurchaseReceipt } from './purchase-receipt.entity';
import { PurchaseReceiptService } from './purchase-receipt.service';
import { MikroOrmPurchaseOrderLineRepository } from './repository/mikro-orm-purchase-order-line.repository';
import { MikroOrmPurchaseOrderRepository } from './repository/mikro-orm-purchase-order.repository';
import { MikroOrmPurchaseReceiptLineRepository } from './repository/mikro-orm-purchase-receipt-line.repository';
import { MikroOrmPurchaseReceiptRepository } from './repository/mikro-orm-purchase-receipt.repository';
import { TypeOrmPurchaseOrderLineRepository } from './repository/type-orm-purchase-order-line.repository';
import { TypeOrmPurchaseOrderRepository } from './repository/type-orm-purchase-order.repository';
import { TypeOrmPurchaseReceiptLineRepository } from './repository/type-orm-purchase-receipt-line.repository';
import { TypeOrmPurchaseReceiptRepository } from './repository/type-orm-purchase-receipt.repository';

const entities = [
	PurchaseOrder,
	PurchaseOrderLine,
	PurchaseReceipt,
	PurchaseReceiptLine,
	AutomotivePartProfile,
	OrganizationVendor,
	Warehouse,
	WarehouseProductVariant
];
@Module({
	imports: [
		TypeOrmModule.forFeature(entities),
		MikroOrmModule.forFeature(entities),
		AutomotivePartModule,
		RolePermissionModule
	],
	controllers: [PurchaseOrderController, PurchaseReceiptController],
	providers: [
		PurchaseOrderService,
		PurchaseReceiptService,
		TypeOrmPurchaseOrderRepository,
		MikroOrmPurchaseOrderRepository,
		TypeOrmPurchaseOrderLineRepository,
		MikroOrmPurchaseOrderLineRepository,
		TypeOrmPurchaseReceiptRepository,
		MikroOrmPurchaseReceiptRepository,
		TypeOrmPurchaseReceiptLineRepository,
		MikroOrmPurchaseReceiptLineRepository
	],
	exports: [PurchaseOrderService, PurchaseReceiptService]
})
export class PurchaseOrderModule {}
