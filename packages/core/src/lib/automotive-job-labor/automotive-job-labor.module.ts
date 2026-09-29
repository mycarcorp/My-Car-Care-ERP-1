import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { Employee } from '../employee/employee.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { TimeLogModule } from '../time-tracking/time-log/time-log.module';
import { TimerModule } from '../time-tracking/timer/timer.module';
import { AutomotiveJobLaborController } from './automotive-job-labor.controller';
import { AutomotiveJobLabor } from './automotive-job-labor.entity';
import { AutomotiveJobLaborService } from './automotive-job-labor.service';
import { MikroOrmAutomotiveJobLaborRepository } from './repository/mikro-orm-automotive-job-labor.repository';
import { TypeOrmAutomotiveJobLaborRepository } from './repository/type-orm-automotive-job-labor.repository';

const entities = [AutomotiveJobLabor, AutomotiveJob, Employee, EstimateLine, CustomerWorkApprovalLine, TimeLog];

@Module({
	imports: [
		TypeOrmModule.forFeature(entities),
		MikroOrmModule.forFeature(entities),
		RolePermissionModule,
		TimeLogModule,
		TimerModule
	],
	controllers: [AutomotiveJobLaborController],
	providers: [AutomotiveJobLaborService, TypeOrmAutomotiveJobLaborRepository, MikroOrmAutomotiveJobLaborRepository],
	exports: [AutomotiveJobLaborService]
})
export class AutomotiveJobLaborModule {}
