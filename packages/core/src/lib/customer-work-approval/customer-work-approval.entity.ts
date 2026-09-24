import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	CustomerWorkApprovalChannelEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	ID,
	ICustomerWorkApproval
} from '@gauzy/contracts';
import { CustomerWorkApprovalRequest, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmCustomerWorkApprovalRepository } from './repository/mikro-orm-customer-work-approval.repository';

/**
 * The immutable record of what a customer approved. Nothing on this entity, or on
 * `CustomerWorkApprovalLine`, is ever updated once submission commits — corrections are a NEW
 * `CustomerWorkApprovalRequest` against a new Estimate revision, never an edit of this row.
 */
@ColumnIndex('IDX_cwa_approval_request_unique', ['approvalRequestId'], { unique: true })
@MultiORMEntity('customer_work_approval', { mikroOrmRepository: () => MikroOrmCustomerWorkApprovalRepository })
export class CustomerWorkApproval extends TenantOrganizationBaseEntity implements ICustomerWorkApproval {
	@MultiORMManyToOne(() => CustomerWorkApprovalRequest, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	approvalRequest?: CustomerWorkApprovalRequest;

	@IsUUID()
	@RelationId((it: CustomerWorkApproval) => it.approvalRequest)
	@MultiORMColumn({ relationId: true })
	approvalRequestId: ID;

	@IsUUID() @ColumnIndex() @MultiORMColumn() customerId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() vehicleId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() repairOrderId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() estimateId: ID;
	@IsNumber() @MultiORMColumn() estimateRevisionNumber: number;

	@IsDate() @MultiORMColumn() submittedAt: Date;

	@IsNumber()
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	approvedTotal: number;

	@IsString() @MultiORMColumn() currency: string;

	@IsEnum(CustomerWorkApprovalSubmissionStateEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: CustomerWorkApprovalSubmissionStateEnum,
		default: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED
	})
	submissionState: CustomerWorkApprovalSubmissionStateEnum;

	/** Canonical-JSON hash of the exact Estimate + EstimateLine values presented at submission. */
	@IsString() @MultiORMColumn({ length: 64 }) estimateSnapshotHash: string;

	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, length: 64 }) ipHash?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, length: 512 }) userAgent?: string;

	@IsEnum(CustomerWorkApprovalChannelEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: CustomerWorkApprovalChannelEnum })
	channel: CustomerWorkApprovalChannelEnum;
}
