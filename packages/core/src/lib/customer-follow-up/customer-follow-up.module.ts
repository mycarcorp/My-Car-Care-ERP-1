import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { EmployeeModule } from '../employee/employee.module';
import { EstimateModule } from '../estimate/estimate.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { CustomerFollowUpController } from './customer-follow-up.controller';
import { CustomerFollowUp } from './customer-follow-up.entity';
import { CustomerFollowUpService } from './customer-follow-up.service';
import { MikroOrmCustomerFollowUpRepository } from './repository/mikro-orm-customer-follow-up.repository';
import { TypeOrmCustomerFollowUpRepository } from './repository/type-orm-customer-follow-up.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CustomerFollowUp]),
		MikroOrmModule.forFeature([CustomerFollowUp]),
		ActivityLogModule,
		EmployeeModule,
		EstimateModule,
		InvoiceModule,
		OrganizationContactModule,
		RepairOrderModule,
		RolePermissionModule,
		TaskModule,
		VehicleModule
	],
	controllers: [CustomerFollowUpController],
	providers: [CustomerFollowUpService, TypeOrmCustomerFollowUpRepository, MikroOrmCustomerFollowUpRepository],
	exports: [CustomerFollowUpService, TypeOrmCustomerFollowUpRepository, MikroOrmCustomerFollowUpRepository]
})
export class CustomerFollowUpModule {}