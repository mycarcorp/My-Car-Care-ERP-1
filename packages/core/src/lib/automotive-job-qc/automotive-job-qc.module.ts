import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { Employee } from '../employee/employee.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AutomotiveJobQcAttempt } from './automotive-job-qc-attempt.entity';
import { AutomotiveJobQcController } from './automotive-job-qc.controller';
import { AutomotiveJobQcService } from './automotive-job-qc.service';
import { MikroOrmAutomotiveJobQcAttemptRepository } from './repository/mikro-orm-automotive-job-qc-attempt.repository';
import { TypeOrmAutomotiveJobQcAttemptRepository } from './repository/type-orm-automotive-job-qc-attempt.repository';

const entities = [AutomotiveJobQcAttempt, AutomotiveJob, AutomotiveJobLabor, TimeLog, Employee];

@Module({
	imports: [TypeOrmModule.forFeature(entities), MikroOrmModule.forFeature(entities), RolePermissionModule],
	controllers: [AutomotiveJobQcController],
	providers: [AutomotiveJobQcService, TypeOrmAutomotiveJobQcAttemptRepository, MikroOrmAutomotiveJobQcAttemptRepository],
	exports: [AutomotiveJobQcService]
})
export class AutomotiveJobQcModule {}