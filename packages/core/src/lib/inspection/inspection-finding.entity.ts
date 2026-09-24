import { ApiProperty } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ID, IInspection, IInspectionFinding, InspectionFindingResultEnum } from '@gauzy/contracts';
import { Inspection, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmInspectionFindingRepository } from './repository/mikro-orm-inspection-finding.repository';

@MultiORMEntity('inspection_finding', { mikroOrmRepository: () => MikroOrmInspectionFindingRepository })
export class InspectionFinding extends TenantOrganizationBaseEntity implements IInspectionFinding {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'text' })
	description: string;

	@ApiProperty({ enum: InspectionFindingResultEnum })
	@IsEnum(InspectionFindingResultEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: InspectionFindingResultEnum })
	result: InspectionFindingResultEnum;

	@MultiORMManyToOne(() => Inspection, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	inspection?: IInspection;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: InspectionFinding) => it.inspection)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	inspectionId: ID;
}
