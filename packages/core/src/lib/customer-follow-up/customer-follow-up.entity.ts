import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID
} from 'class-validator';
import {
	BaseEntityEnum,
	CustomerFollowUpSourceEventTypeEnum,
	CustomerFollowUpStatusEnum,
	CustomerFollowUpTypeEnum,
	ID,
	ICustomerFollowUp,
	IEmployee,
	IEstimate,
	IInvoice,
	IOrganizationContact,
	IRepairOrder,
	ITask,
	IVehicle
} from '@gauzy/contracts';
import {
	Employee,
	Estimate,
	Invoice,
	OrganizationContact,
	RepairOrder,
	Task,
	TenantOrganizationBaseEntity,
	Vehicle
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmCustomerFollowUpRepository } from './repository/mikro-orm-customer-follow-up.repository';

@ColumnIndex('IDX_customer_follow_up_tenant_source_event_key_unique', ['tenantId', 'organizationId', 'sourceEventKey'], {
	unique: true
})
@ColumnIndex('IDX_customer_follow_up_customer_status_due', ['customerId', 'status', 'dueAt'])
@MultiORMEntity('customer_follow_up', { mikroOrmRepository: () => MikroOrmCustomerFollowUpRepository })
export class CustomerFollowUp extends TenantOrganizationBaseEntity implements ICustomerFollowUp {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	@ApiProperty({ enum: CustomerFollowUpTypeEnum })
	@IsEnum(CustomerFollowUpTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: CustomerFollowUpTypeEnum })
	type: CustomerFollowUpTypeEnum;

	@ApiProperty({ enum: CustomerFollowUpStatusEnum })
	@IsEnum(CustomerFollowUpStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: CustomerFollowUpStatusEnum, default: CustomerFollowUpStatusEnum.OPEN })
	status: CustomerFollowUpStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	dueAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	scheduledAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	deferredUntil?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	statusReason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	sourceEntityType?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	sourceEntityId?: ID;

	@ApiPropertyOptional({ enum: CustomerFollowUpSourceEventTypeEnum })
	@IsOptional()
	@IsEnum(CustomerFollowUpSourceEventTypeEnum)
	@MultiORMColumn({ nullable: true, type: 'simple-enum', enum: CustomerFollowUpSourceEventTypeEnum })
	sourceEventType?: CustomerFollowUpSourceEventTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, length: 255 })
	sourceEventKey?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	sourceEventAt?: Date;

	@ApiProperty({ type: () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customer?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerId: ID;

	@ApiPropertyOptional({ type: () => Vehicle })
	@IsOptional()
	@MultiORMManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	vehicle?: IVehicle;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.vehicle)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	vehicleId?: ID;

	@ApiPropertyOptional({ type: () => RepairOrder })
	@IsOptional()
	@MultiORMManyToOne(() => RepairOrder, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	repairOrder?: IRepairOrder;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	repairOrderId?: ID;

	@ApiPropertyOptional({ type: () => Estimate })
	@IsOptional()
	@MultiORMManyToOne(() => Estimate, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	estimate?: IEstimate;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.estimate)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	estimateId?: ID;

	@ApiPropertyOptional({ type: () => Invoice })
	@IsOptional()
	@MultiORMManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: ID;

	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@MultiORMManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId?: ID;

	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	ownerEmployee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CustomerFollowUp) => it.ownerEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	ownerEmployeeId?: ID;
}