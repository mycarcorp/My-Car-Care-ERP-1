import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';
import { AutomotiveJobLaborStatusEnum, IAutomotiveJobLabor, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/tenant-organization-base.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { Employee } from '../employee/employee.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmAutomotiveJobLaborRepository } from './repository/mikro-orm-automotive-job-labor.repository';

@ColumnIndex('IDX_automotive_job_labor_job_status', ['automotiveJobId', 'status'])
@ColumnIndex('IDX_automotive_job_labor_approval_line', ['customerWorkApprovalLineId'])
@MultiORMEntity('automotive_job_labor', {
	mikroOrmRepository: () => MikroOrmAutomotiveJobLaborRepository
})
export class AutomotiveJobLabor extends TenantOrganizationBaseEntity implements IAutomotiveJobLabor {
	@MultiORMManyToOne(() => AutomotiveJob, (job) => job.labor, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotiveJob?: AutomotiveJob;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: AutomotiveJobLabor) => it.automotiveJob)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotiveJobId: ID;

	@MultiORMManyToOne(() => EstimateLine, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	estimateLine?: EstimateLine;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: AutomotiveJobLabor) => it.estimateLine)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	estimateLineId?: ID;

	@MultiORMManyToOne(() => CustomerWorkApprovalLine, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	customerWorkApprovalLine?: CustomerWorkApprovalLine;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: AutomotiveJobLabor) => it.customerWorkApprovalLine)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	customerWorkApprovalLineId?: ID;

	@ApiProperty({ type: () => String, maxLength: 500 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	@MultiORMColumn({ length: 500 })
	description: string;

	@ApiPropertyOptional({ type: () => [Employee], isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Employee, {
		onUpdate: 'CASCADE',
		onDelete: 'RESTRICT',
		owner: true,
		pivotTable: 'automotive_job_labor_employee',
		joinColumn: 'automotiveJobLaborId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({ name: 'automotive_job_labor_employee' })
	assignedEmployees?: Employee[];

	@ApiPropertyOptional({
		type: () => Number,
		description: 'Optional customer-facing billed/estimated hours; never derived from EstimateLine.quantity.'
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	billedHours?: number;

	@ApiProperty({ enum: AutomotiveJobLaborStatusEnum })
	@IsEnum(AutomotiveJobLaborStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({
		type: 'simple-enum',
		enum: AutomotiveJobLaborStatusEnum,
		default: AutomotiveJobLaborStatusEnum.OPEN
	})
	status: AutomotiveJobLaborStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;
}
