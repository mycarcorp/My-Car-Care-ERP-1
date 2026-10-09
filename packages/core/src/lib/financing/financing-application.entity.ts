import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	FinancingApplicationStatusEnum,
	ICustomerWorkApproval,
	ID,
	IEstimate,
	IFinancingApplication,
	IInvoice,
	IOrganizationContact,
	IRepairOrder,
	IVehicle
} from '@gauzy/contracts';
import {
	CustomerWorkApproval,
	Estimate,
	Invoice,
	OrganizationContact,
	RepairOrder,
	TenantOrganizationBaseEntity,
	Vehicle
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmFinancingApplicationRepository } from './repository/mikro-orm-financing-application.repository';

/**
 * Financing application for eligible service work. References (never duplicates) the existing
 * Customer/Vehicle/Repair Order/Estimate/Customer Approval records, and optionally the Invoice.
 *
 * Uniqueness: `activeKey` equals the application id while active and is NULL once terminal, so the
 * composite unique index on (tenantId, repairOrderId, activeKey) enforces one active application
 * per repair order portably across SQLite/MySQL/Postgres (NULL markers never collide).
 */
@ColumnIndex('IDX_financing_app_ro_active_unique', ['tenantId', 'repairOrderId', 'activeKey'], { unique: true })
@MultiORMEntity('financing_application', { mikroOrmRepository: () => MikroOrmFinancingApplicationRepository })
export class FinancingApplication extends TenantOrganizationBaseEntity implements IFinancingApplication {
	@ApiProperty({ enum: FinancingApplicationStatusEnum })
	@IsEnum(FinancingApplicationStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: FinancingApplicationStatusEnum, default: FinancingApplicationStatusEnum.DRAFT })
	status: FinancingApplicationStatusEnum;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	requestedAmount: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformerPipe(2) })
	approvedAmount?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformerPipe(2) })
	fundedAmount?: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	currency: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	provider?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	providerApplicationId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	rejectionReason?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	submittedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	decidedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	acceptedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	fundedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	activeKey?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => OrganizationContact, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	customer?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	customerId: ID;

	@MultiORMManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	vehicle?: IVehicle;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.vehicle)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	vehicleId: ID;

	@MultiORMManyToOne(() => RepairOrder, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	repairOrder?: IRepairOrder;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.repairOrder)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	repairOrderId: ID;

	@MultiORMManyToOne(() => Estimate, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	estimate?: IEstimate;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.estimate)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	estimateId: ID;

	@ApiPropertyOptional({ type: () => CustomerWorkApproval })
	@IsOptional()
	@MultiORMManyToOne(() => CustomerWorkApproval, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	customerWorkApproval?: ICustomerWorkApproval;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.customerWorkApproval)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	customerWorkApprovalId?: ID;

	@ApiPropertyOptional({ type: () => Invoice })
	@IsOptional()
	@MultiORMManyToOne(() => Invoice, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: FinancingApplication) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: ID;
}
