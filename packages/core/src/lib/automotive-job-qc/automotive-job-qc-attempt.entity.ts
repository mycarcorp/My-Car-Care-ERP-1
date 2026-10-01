import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AutomotiveJobQcStatusEnum, IAutomotiveJobQcAttempt, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/tenant-organization-base.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { Employee } from '../employee/employee.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmAutomotiveJobQcAttemptRepository } from './repository/mikro-orm-automotive-job-qc-attempt.repository';

@ColumnIndex('IDX_automotive_job_qc_attempt_job_history', ['automotiveJobId', 'createdAt'])
@ColumnIndex('IDX_automotive_job_qc_attempt_job_status', ['automotiveJobId', 'status'])
@MultiORMEntity('automotive_job_qc_attempt', {
	mikroOrmRepository: () => MikroOrmAutomotiveJobQcAttemptRepository
})
export class AutomotiveJobQcAttempt extends TenantOrganizationBaseEntity implements IAutomotiveJobQcAttempt {
	@MultiORMManyToOne(() => AutomotiveJob, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotiveJob?: AutomotiveJob;
	@IsUUID()
	@RelationId((it: AutomotiveJobQcAttempt) => it.automotiveJob)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotiveJobId: ID;

	@ApiProperty({ enum: AutomotiveJobQcStatusEnum })
	@IsEnum(AutomotiveJobQcStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: AutomotiveJobQcStatusEnum })
	status: AutomotiveJobQcStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	@MultiORMColumn({ nullable: true, type: 'text' })
	reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@MultiORMColumn({ nullable: true, type: 'text' })
	notes?: string;

	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	checkedByEmployee?: Employee;
	@IsOptional()
	@IsUUID()
	@RelationId((it: AutomotiveJobQcAttempt) => it.checkedByEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	checkedByEmployeeId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	checkedAt?: Date;
}