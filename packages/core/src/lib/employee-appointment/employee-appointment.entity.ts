import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate, IsBoolean, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	EmployeeAppointmentStatus,
	ID,
	IEmployee,
	IEmployeeAppointment,
	IOrganizationContact,
	IVehicle
} from '@gauzy/contracts';
import {
	AppointmentEmployee,
	Employee,
	OrganizationContact,
	TenantOrganizationBaseEntity,
	Vehicle
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmEmployeeAppointmentRepository } from './repository/mikro-orm-employee-appointment.repository';

@MultiORMEntity('employee_appointment', { mikroOrmRepository: () => MikroOrmEmployeeAppointmentRepository })
export class EmployeeAppointment extends TenantOrganizationBaseEntity implements IEmployeeAppointment {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	agenda: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: true })
	location?: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	startDateTime: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	endDateTime: Date;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	bufferTimeStart?: Boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	bufferTimeEnd?: Boolean;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	bufferTimeInMins?: Number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	breakTimeInMins?: Number;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ nullable: true })
	breakStartTime?: Date;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	emails?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	status?: EmployeeAppointmentStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	originalConcern?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Appointment Employee
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeAppointment) => it.employee)
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: true,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	customer?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeAppointment) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	customerId?: ID;

	@ApiPropertyOptional({ type: () => Vehicle })
	@IsOptional()
	@MultiORMManyToOne(() => Vehicle, {
		nullable: true,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	vehicle?: IVehicle;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeAppointment) => it.vehicle)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	vehicleId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@MultiORMOneToMany(() => AppointmentEmployee, (entity) => entity.employeeAppointment, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invitees?: AppointmentEmployee[];
}
