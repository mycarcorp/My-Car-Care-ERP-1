import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EstimateController } from './estimate.controller';
import { EstimateLineController } from './estimate-line.controller';
import { Estimate } from './estimate.entity';
import { EstimateLine } from './estimate-line.entity';
import { EstimateService } from './estimate.service';
import { TypeOrmEstimateRepository } from './repository/type-orm-estimate.repository';
import { MikroOrmEstimateRepository } from './repository/mikro-orm-estimate.repository';
import { TypeOrmEstimateLineRepository } from './repository/type-orm-estimate-line.repository';
import { MikroOrmEstimateLineRepository } from './repository/mikro-orm-estimate-line.repository';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
@Module({
	imports: [
		TypeOrmModule.forFeature([Estimate, EstimateLine, CustomerWorkApprovalRequest]),
		MikroOrmModule.forFeature([Estimate, EstimateLine]),
		RepairOrderModule,
		RolePermissionModule
	],
	controllers: [EstimateController, EstimateLineController],
	providers: [
		EstimateService,
		TypeOrmEstimateRepository,
		MikroOrmEstimateRepository,
		TypeOrmEstimateLineRepository,
		MikroOrmEstimateLineRepository
	],
	exports: [EstimateService]
})
export class EstimateModule {}
