import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNumber, IsString, IsUUID } from 'class-validator';
import {
	CustomerWorkApprovalDeliveryChannelEnum,
	CustomerWorkApprovalDeliveryStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	ID,
	ICustomerWorkApprovalRequest,
	IEstimate,
	IRepairOrder
} from '@gauzy/contracts';
import { Estimate, RepairOrder, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmCustomerWorkApprovalRequestRepository } from './repository/mikro-orm-customer-work-approval-request.repository';

@ColumnIndex('IDX_cwa_request_estimate_status', ['estimateRootId', 'status'])
@ColumnIndex('IDX_cwa_request_token_hash', ['tokenHash'])
@MultiORMEntity('customer_work_approval_request', {
	mikroOrmRepository: () => MikroOrmCustomerWorkApprovalRequestRepository
})
export class CustomerWorkApprovalRequest extends TenantOrganizationBaseEntity implements ICustomerWorkApprovalRequest {
	@MultiORMManyToOne(() => Estimate, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	estimate?: IEstimate;

	@IsUUID()
	@RelationId((it: CustomerWorkApprovalRequest) => it.estimate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	estimateId: ID;

	/** Pins the estimate revision LINEAGE this request was created for, independent of `estimateId`. */
	@IsUUID() @ColumnIndex() @MultiORMColumn() estimateRootId: ID;

	@IsNumber() @MultiORMColumn() estimateRevisionNumber: number;

	@MultiORMManyToOne(() => RepairOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: IRepairOrder;

	@IsUUID()
	@RelationId((it: CustomerWorkApprovalRequest) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	repairOrderId: ID;

	@IsUUID() @ColumnIndex() @MultiORMColumn() customerId: ID;
	@IsUUID() @ColumnIndex() @MultiORMColumn() vehicleId: ID;

	/** SHA-256/HMAC digest of the opaque bearer token. The raw token is never persisted. */
	@IsString() @MultiORMColumn({ length: 64 }) tokenHash: string;

	@IsDate() @MultiORMColumn() expiresAt: Date;

	@IsEnum(CustomerWorkApprovalRequestStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({
		type: 'simple-enum',
		enum: CustomerWorkApprovalRequestStatusEnum,
		default: CustomerWorkApprovalRequestStatusEnum.ACTIVE
	})
	status: CustomerWorkApprovalRequestStatusEnum;

	@IsEnum(CustomerWorkApprovalDeliveryChannelEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: CustomerWorkApprovalDeliveryChannelEnum
	})
	deliveryChannel?: CustomerWorkApprovalDeliveryChannelEnum;

	@IsEnum(CustomerWorkApprovalDeliveryStatusEnum)
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: CustomerWorkApprovalDeliveryStatusEnum
	})
	deliveryStatus?: CustomerWorkApprovalDeliveryStatusEnum;

	@MultiORMColumn({ nullable: true })
	deliveryAttemptedAt?: Date;

	@MultiORMColumn({ nullable: true, length: 1024 })
	deliveryError?: string;
}
