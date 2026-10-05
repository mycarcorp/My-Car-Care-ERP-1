import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { Employee } from '../employee/employee.entity';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AutomotiveJobController } from './automotive-job.controller';
import { AutomotiveJob } from './automotive-job.entity';
import { AutomotiveJobCategory } from '../automotive-job-category/automotive-job-category.entity';
import { AutomotiveJobLaborModule } from '../automotive-job-labor/automotive-job-labor.module';
import { AutomotiveJobQcModule } from '../automotive-job-qc/automotive-job-qc.module';
import { AutomotiveJobService } from './automotive-job.service';
import { MikroOrmAutomotiveJobRepository } from './repository/mikro-orm-automotive-job.repository';
import { TypeOrmAutomotiveJobRepository } from './repository/type-orm-automotive-job.repository';

const entities = [
	AutomotiveJob,
	AutomotiveJobCategory,
	RepairOrder,
	CustomerWorkApproval,
	CustomerWorkApprovalLine,
	CustomerWorkApprovalRequest,
	Estimate,
	EstimateLine,
	Employee
];

@Module({
	imports: [
		TypeOrmModule.forFeature(entities),
		MikroOrmModule.forFeature(entities),
		RolePermissionModule,
		AutomotiveJobLaborModule,
		AutomotiveJobQcModule,
		RepairOrderModule
	],
	controllers: [AutomotiveJobController],
	providers: [AutomotiveJobService, TypeOrmAutomotiveJobRepository, MikroOrmAutomotiveJobRepository],
	exports: [AutomotiveJobService]
})
export class AutomotiveJobModule {}
