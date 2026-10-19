import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstimateModule } from '../estimate/estimate.module';
import { EmailSendModule } from '../email-send/email-send.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { OrganizationModule } from '../organization/organization.module';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { CustomerWorkApprovalRequestController } from './customer-work-approval-request.controller';
import { CustomerWorkApprovalRequest } from './customer-work-approval-request.entity';
import { CustomerWorkApproval } from './customer-work-approval.entity';
import { CustomerWorkApprovalLine } from './customer-work-approval-line.entity';
import { CustomerWorkApprovalRequestService } from './customer-work-approval-request.service';
import { CustomerWorkApprovalService } from './customer-work-approval.service';
import { MikroOrmCustomerWorkApprovalRequestRepository } from './repository/mikro-orm-customer-work-approval-request.repository';
import { MikroOrmCustomerWorkApprovalRepository } from './repository/mikro-orm-customer-work-approval.repository';
import { MikroOrmCustomerWorkApprovalLineRepository } from './repository/mikro-orm-customer-work-approval-line.repository';
import { TypeOrmCustomerWorkApprovalRequestRepository } from './repository/type-orm-customer-work-approval-request.repository';
import { TypeOrmCustomerWorkApprovalRepository } from './repository/type-orm-customer-work-approval.repository';
import { TypeOrmCustomerWorkApprovalLineRepository } from './repository/type-orm-customer-work-approval-line.repository';
import { Estimate, EstimateLine } from '../core/entities/internal';
import { TypeOrmEstimateRepository } from '../estimate/repository/type-orm-estimate.repository';
import { TypeOrmEstimateLineRepository } from '../estimate/repository/type-orm-estimate-line.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CustomerWorkApprovalRequest,
			CustomerWorkApproval,
			CustomerWorkApprovalLine,
			Estimate,
			EstimateLine
		]),
		MikroOrmModule.forFeature([
			CustomerWorkApprovalRequest,
			CustomerWorkApproval,
			CustomerWorkApprovalLine,
			Estimate,
			EstimateLine
		]),
		EstimateModule,
		OrganizationModule,
		EmailSendModule,
		OrganizationContactModule,
		RepairOrderModule,
		RolePermissionModule,
		VehicleModule
	],
	controllers: [CustomerWorkApprovalRequestController],
	providers: [
		CustomerWorkApprovalRequestService,
		CustomerWorkApprovalService,
		TypeOrmCustomerWorkApprovalRequestRepository,
		MikroOrmCustomerWorkApprovalRequestRepository,
		TypeOrmCustomerWorkApprovalRepository,
		MikroOrmCustomerWorkApprovalRepository,
		TypeOrmCustomerWorkApprovalLineRepository,
		MikroOrmCustomerWorkApprovalLineRepository,
		TypeOrmEstimateRepository,
		TypeOrmEstimateLineRepository
	],
	exports: [
		CustomerWorkApprovalRequestService,
		CustomerWorkApprovalService,
		TypeOrmCustomerWorkApprovalRequestRepository,
		TypeOrmCustomerWorkApprovalRepository,
		TypeOrmCustomerWorkApprovalLineRepository,
		TypeOrmEstimateRepository,
		TypeOrmEstimateLineRepository
	]
})
export class CustomerWorkApprovalModule {}
