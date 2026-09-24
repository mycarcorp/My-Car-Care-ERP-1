import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { VehicleController } from './vehicle.controller';
import { Vehicle } from './vehicle.entity';
import { MikroOrmVehicleRepository } from './repository/mikro-orm-vehicle.repository';
import { TypeOrmVehicleRepository } from './repository/type-orm-vehicle.repository';
import { VehicleService } from './vehicle.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Vehicle]),
		MikroOrmModule.forFeature([Vehicle]),
		OrganizationContactModule,
		RolePermissionModule
	],
	controllers: [VehicleController],
	providers: [VehicleService, TypeOrmVehicleRepository, MikroOrmVehicleRepository],
	exports: [VehicleService, TypeOrmVehicleRepository, MikroOrmVehicleRepository]
})
export class VehicleModule {}
