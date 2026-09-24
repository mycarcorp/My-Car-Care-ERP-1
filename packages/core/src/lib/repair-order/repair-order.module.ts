import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeAppointmentModule } from '../employee-appointment/employee-appointment.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { RepairOrderController } from './repair-order.controller';
import { RepairOrder } from './repair-order.entity';
import { MikroOrmRepairOrderRepository } from './repository/mikro-orm-repair-order.repository';
import { TypeOrmRepairOrderRepository } from './repository/type-orm-repair-order.repository';
import { RepairOrderService } from './repair-order.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([RepairOrder]),
		MikroOrmModule.forFeature([RepairOrder]),
		EmployeeAppointmentModule,
		OrganizationContactModule,
		VehicleModule,
		RolePermissionModule
	],
	controllers: [RepairOrderController],
	providers: [RepairOrderService, TypeOrmRepairOrderRepository, MikroOrmRepairOrderRepository],
	exports: [RepairOrderService, TypeOrmRepairOrderRepository, MikroOrmRepairOrderRepository]
})
export class RepairOrderModule {}
