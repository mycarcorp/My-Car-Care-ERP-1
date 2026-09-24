import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { EstimateLinePriorityEnum, ID, IEstimate, IEstimateLine } from '@gauzy/contracts';
import { Estimate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmEstimateLineRepository } from './repository/mikro-orm-estimate-line.repository';
@ColumnIndex('IDX_estimate_line_number_unique', ['estimateId', 'lineNumber'], { unique: true })
@MultiORMEntity('estimate_line', { mikroOrmRepository: () => MikroOrmEstimateLineRepository })
export class EstimateLine extends TenantOrganizationBaseEntity implements IEstimateLine {
	@MultiORMManyToOne(() => Estimate, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn() estimate?: IEstimate;
	@IsUUID()
	@RelationId((it: EstimateLine) => it.estimate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	estimateId: ID;
	@IsNumber() @MultiORMColumn() lineNumber: number;
	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) description: string;
	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) reason: string;
	@IsEnum(EstimateLinePriorityEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: EstimateLinePriorityEnum })
	priority: EstimateLinePriorityEnum;
	@IsNumber()
	@Min(0.001)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	quantity: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	unitPrice: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	taxAmount: number;
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2), nullable: true })
	discountAmount?: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	lineTotal: number;
}
