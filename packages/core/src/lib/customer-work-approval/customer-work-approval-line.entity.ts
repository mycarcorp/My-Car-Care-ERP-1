import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EstimateLinePriorityEnum, ID, ICustomerWorkApprovalLine } from '@gauzy/contracts';
import { CustomerWorkApproval, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmCustomerWorkApprovalLineRepository } from './repository/mikro-orm-customer-work-approval-line.repository';

/** Immutable per-line snapshot of the customer's decision, copied verbatim from the presented EstimateLine. */
@ColumnIndex('IDX_cwa_line_approval_estimate_line_unique', ['customerWorkApprovalId', 'estimateLineId'], {
	unique: true
})
@MultiORMEntity('customer_work_approval_line', {
	mikroOrmRepository: () => MikroOrmCustomerWorkApprovalLineRepository
})
export class CustomerWorkApprovalLine extends TenantOrganizationBaseEntity implements ICustomerWorkApprovalLine {
	@MultiORMManyToOne(() => CustomerWorkApproval, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customerWorkApproval?: CustomerWorkApproval;

	@IsUUID()
	@RelationId((it: CustomerWorkApprovalLine) => it.customerWorkApproval)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerWorkApprovalId: ID;

	@IsUUID() @ColumnIndex() @MultiORMColumn() estimateLineId: ID;

	@IsBoolean() @MultiORMColumn() selected: boolean;

	/** V1 all-or-nothing: equals the snapshotted `quantity` when selected, else zero. */
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(3) })
	approvedQuantity: number;

	@IsNotEmpty()
	@MultiORMColumn({ type: 'simple-enum', enum: EstimateLinePriorityEnum })
	priority: EstimateLinePriorityEnum;

	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) description: string;
	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) reason: string;

	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	unitPrice: number;

	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	taxAmount: number;

	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2), nullable: true })
	discountAmount?: number;

	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	lineTotal: number;
}
