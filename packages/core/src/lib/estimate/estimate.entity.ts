import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { EstimateStatusEnum, ID, IEstimate, IEstimateLine } from '@gauzy/contracts';
import { RepairOrder, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { EstimateLine } from './estimate-line.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmEstimateRepository } from './repository/mikro-orm-estimate.repository';
@ColumnIndex('IDX_estimate_root_revision_unique', ['rootEstimateId', 'revisionNumber'], { unique: true })
@ColumnIndex('IDX_estimate_tenant_number_unique', ['tenantId', 'estimateNumber'], { unique: true })
@MultiORMEntity('estimate', { mikroOrmRepository: () => MikroOrmEstimateRepository })
export class Estimate extends TenantOrganizationBaseEntity implements IEstimate {
	@MultiORMManyToOne(() => RepairOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: RepairOrder;
	@IsUUID()
	@RelationId((it: Estimate) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	repairOrderId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() customerId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() vehicleId: ID;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe() })
	estimateNumber: number;
	@IsUUID() @MultiORMColumn({ nullable: true }) rootEstimateId?: ID;
	@IsNumber() @MultiORMColumn() revisionNumber: number;
	@IsEnum(EstimateStatusEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: EstimateStatusEnum, default: EstimateStatusEnum.DRAFT })
	status: EstimateStatusEnum;
	@MultiORMColumn() currency: string;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) subtotal: number;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) taxTotal: number;
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	discountTotal: number;
	@IsNumber() @MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) }) total: number;
	@IsUUID() @MultiORMColumn({ nullable: true }) inspectionId?: ID;
	@IsUUID() @MultiORMColumn({ nullable: true }) diagnosticId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Estimate lines belonging to this estimate. Metadata-only inverse relation so
	 * the detail query can load `relations: ['lines']`; the FK lives on EstimateLine.
	 */
	@MultiORMOneToMany(() => EstimateLine, (entity) => entity.estimate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	lines?: IEstimateLine[];
}
