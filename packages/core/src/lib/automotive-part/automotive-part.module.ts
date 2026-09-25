import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationVendor } from '../organization-vendor/organization-vendor.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { AutomotivePartController } from './automotive-part.controller';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { AutomotivePartService } from './automotive-part.service';
import { AutomotivePartVendor } from './automotive-part-vendor.entity';
import { AutomotivePartVendorService } from './automotive-part-vendor.service';
import { PartStockMovement } from './part-stock-movement.entity';
import { PartStockMovementService } from './part-stock-movement.service';
import { MikroOrmAutomotivePartProfileRepository } from './repository/mikro-orm-automotive-part-profile.repository';
import { MikroOrmAutomotivePartVendorRepository } from './repository/mikro-orm-automotive-part-vendor.repository';
import { MikroOrmPartStockMovementRepository } from './repository/mikro-orm-part-stock-movement.repository';
import { TypeOrmAutomotivePartProfileRepository } from './repository/type-orm-automotive-part-profile.repository';
import { TypeOrmAutomotivePartVendorRepository } from './repository/type-orm-automotive-part-vendor.repository';
import { TypeOrmPartStockMovementRepository } from './repository/type-orm-part-stock-movement.repository';

const entities = [
	AutomotivePartProfile,
	AutomotivePartVendor,
	PartStockMovement,
	ProductVariant,
	OrganizationVendor,
	Warehouse,
	WarehouseProductVariant
];

@Module({
	imports: [TypeOrmModule.forFeature(entities), MikroOrmModule.forFeature(entities), RolePermissionModule],
	controllers: [AutomotivePartController],
	providers: [
		AutomotivePartService,
		AutomotivePartVendorService,
		PartStockMovementService,
		TypeOrmAutomotivePartProfileRepository,
		MikroOrmAutomotivePartProfileRepository,
		TypeOrmAutomotivePartVendorRepository,
		MikroOrmAutomotivePartVendorRepository,
		TypeOrmPartStockMovementRepository,
		MikroOrmPartStockMovementRepository
	],
	exports: [AutomotivePartService, AutomotivePartVendorService, PartStockMovementService]
})
export class AutomotivePartModule {}
