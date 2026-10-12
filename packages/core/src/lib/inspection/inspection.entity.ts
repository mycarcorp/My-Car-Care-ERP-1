import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
	ID,
	IEmployee,
	IInspection,
	IInspectionFinding,
	IRepairOrder,
	IVehicle,
	InspectionStatusEnum
} from '@gauzy/contracts';
import { Employee, RepairOrder, TenantOrganizationBaseEntity, Vehicle } from '../core/entities/internal';
import { InspectionFinding } from './inspection-finding.entity';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { MikroOrmInspectionRepository } from './repository/mikro-orm-inspection.repository';

@MultiORMEntity('inspection', { mikroOrmRepository: () => MikroOrmInspectionRepository })
export class Inspection extends TenantOrganizationBaseEntity implements IInspection {
	@ApiProperty({ enum: InspectionStatusEnum })
	@IsEnum(InspectionStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: InspectionStatusEnum, default: InspectionStatusEnum.DRAFT })
	status: InspectionStatusEnum;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	inspectedAt: Date;

	@ApiProperty({ type: () => RepairOrder })
	@MultiORMManyToOne(() => RepairOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: IRepairOrder;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Inspection) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	repairOrderId: ID;

	@ApiProperty({ type: () => Vehicle })
	@MultiORMManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	vehicle?: IVehicle;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Inspection) => it.vehicle)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	vehicleId: ID;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	technician?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Inspection) => it.technician)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	technicianEmployeeId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Inspection findings belonging to this inspection.
	 */
	@MultiORMOneToMany(() => InspectionFinding, (entity) => entity.inspection, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	findings?: IInspectionFinding[];
}
