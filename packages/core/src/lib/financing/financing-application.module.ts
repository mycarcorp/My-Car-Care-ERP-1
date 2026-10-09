import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { EstimateModule } from '../estimate/estimate.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { FinancingApplication } from './financing-application.entity';
import { FinancingApplicationController } from './financing-application.controller';
import { FinancingApplicationService } from './financing-application.service';
import { TypeOrmFinancingApplicationRepository } from './repository/type-orm-financing-application.repository';
import { MikroOrmFinancingApplicationRepository } from './repository/mikro-orm-financing-application.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([FinancingApplication, CustomerWorkApproval]),
		MikroOrmModule.forFeature([FinancingApplication]),
		RepairOrderModule,
		EstimateModule,
		OrganizationContactModule,
		VehicleModule,
		RolePermissionModule
	],
	controllers: [FinancingApplicationController],
	providers: [
		FinancingApplicationService,
		TypeOrmFinancingApplicationRepository,
		MikroOrmFinancingApplicationRepository
	],
	exports: [FinancingApplicationService]
})
export class FinancingApplicationModule {}
