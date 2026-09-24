import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	IsDate,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	Matches
} from 'class-validator';
import { IVehicle, IOrganizationContact, ID, JsonData } from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmVehicleRepository } from './repository/mikro-orm-vehicle.repository';

@ColumnIndex('IDX_vehicle_tenant_vin_normalized_unique', ['tenantId', 'vinNormalized'], { unique: true })
@MultiORMEntity('vehicle', { mikroOrmRepository: () => MikroOrmVehicleRepository })
export class Vehicle extends TenantOrganizationBaseEntity implements IVehicle {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Length(17, 17)
	@Matches(/^[A-HJ-NPR-Z0-9]{17}$/)
	@ColumnIndex()
	@MultiORMColumn({ length: 17 })
	vinNormalized: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, length: 17 })
	vin?: string;

	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1886)
	@Max(2100)
	@MultiORMColumn({ type: 'int' })
	year: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	make: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	model: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	trim?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	bodyStyle?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	engine?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	drivetrain?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	fuelType?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	transmission?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	plate?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	plateJurisdiction?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ nullable: true, type: 'numeric' })
	currentMileage?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	decoderProvider?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	decoderVersion?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	decodedVehicleData?: JsonData;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	decodedAt?: Date;

	@ApiProperty({ type: () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	customer?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Vehicle) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerId: ID;
}
