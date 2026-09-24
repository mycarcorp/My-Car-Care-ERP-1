import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
	ID,
	IEmployee,
	IEmployeeAppointment,
	IOrganizationContact,
	IRepairOrder,
	IVehicle,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import {
	Employee,
	EmployeeAppointment,
	OrganizationContact,
	TenantOrganizationBaseEntity,
	Vehicle
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmRepairOrderRepository } from './repository/mikro-orm-repair-order.repository';

@ColumnIndex('IDX_repair_order_tenant_number_unique', ['tenantId', 'repairOrderNumber'], { unique: true })
@ColumnIndex('IDX_repair_order_appointment_unique', ['appointmentId'], { unique: true })
@MultiORMEntity('repair_order', { mikroOrmRepository: () => MikroOrmRepairOrderRepository })
export class RepairOrder extends TenantOrganizationBaseEntity implements IRepairOrder {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	repairOrderNumber: string;

	@ApiProperty({ enum: RepairOrderStatusEnum })
	@IsEnum(RepairOrderStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: RepairOrderStatusEnum, default: RepairOrderStatusEnum.OPEN })
	status: RepairOrderStatusEnum;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	arrivedAt: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ nullable: true, type: 'numeric' })
	arrivalOdometer?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	originalConcern?: string;

	@ApiProperty({ type: () => EmployeeAppointment })
	@MultiORMManyToOne(() => EmployeeAppointment, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	appointment?: IEmployeeAppointment;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RepairOrder) => it.appointment)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	appointmentId: ID;

	@ApiProperty({ type: () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customer?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RepairOrder) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerId: ID;

	@ApiProperty({ type: () => Vehicle })
	@MultiORMManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	vehicle?: IVehicle;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RepairOrder) => it.vehicle)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	vehicleId: ID;

	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	serviceAdvisor?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: RepairOrder) => it.serviceAdvisor)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	serviceAdvisorEmployeeId?: ID;
}
