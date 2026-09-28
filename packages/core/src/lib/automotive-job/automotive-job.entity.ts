import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AutomotiveJobStatusEnum, IAutomotiveJob, ID } from '@gauzy/contracts';
import {
	CustomerWorkApproval,
	CustomerWorkApprovalLine,
	Employee,
	Estimate,
	EstimateLine,
	RepairOrder,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmAutomotiveJobRepository } from './repository/mikro-orm-automotive-job.repository';

@ColumnIndex('IDX_automotive_job_approval_line_unique', ['customerWorkApprovalLineId'], { unique: true })
@ColumnIndex('IDX_automotive_job_ro_status', ['repairOrderId', 'status'])
@ColumnIndex('IDX_automotive_job_employee_status', ['assignedEmployeeId', 'status'])
@MultiORMEntity('automotive_job', { mikroOrmRepository: () => MikroOrmAutomotiveJobRepository })
export class AutomotiveJob extends TenantOrganizationBaseEntity implements IAutomotiveJob {
	@MultiORMManyToOne(() => RepairOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: RepairOrder;
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	repairOrderId: ID;

	@MultiORMManyToOne(() => Estimate, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	estimate?: Estimate;
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.estimate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	estimateId: ID;
	@IsNumber() @MultiORMColumn() estimateRevisionNumber: number;

	@MultiORMManyToOne(() => EstimateLine, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	estimateLine?: EstimateLine;
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.estimateLine)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	estimateLineId: ID;

	@MultiORMManyToOne(() => CustomerWorkApproval, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customerWorkApproval?: CustomerWorkApproval;
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.customerWorkApproval)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerWorkApprovalId: ID;

	@MultiORMManyToOne(() => CustomerWorkApprovalLine, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customerWorkApprovalLine?: CustomerWorkApprovalLine;
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.customerWorkApprovalLine)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerWorkApprovalLineId: ID;

	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	assignedEmployee?: Employee;
	@IsOptional()
	@IsUUID()
	@RelationId((it: AutomotiveJob) => it.assignedEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	assignedEmployeeId?: ID;

	@IsString() @MultiORMColumn({ type: 'text' }) title: string;
	@IsString() @MultiORMColumn({ type: 'text' }) description: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) internalNotes?: string;

	@IsEnum(AutomotiveJobStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: AutomotiveJobStatusEnum, default: AutomotiveJobStatusEnum.OPEN })
	status: AutomotiveJobStatusEnum;

	@IsOptional() @IsNumber() @Min(0) @MultiORMColumn({ nullable: true, type: 'numeric' }) estimatedHours?: number;
	@IsOptional() @IsNumber() @Min(0) @MultiORMColumn({ nullable: true, type: 'numeric' }) authorizedHours?: number;
}
