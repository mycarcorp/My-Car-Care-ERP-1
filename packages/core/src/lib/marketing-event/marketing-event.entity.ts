import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IRepairOrderCompletedEvent, REPAIR_ORDER_COMPLETED_EVENT, ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@ColumnIndex('IDX_marketing_event_tenant_idempotency_key_unique', ['tenantId', 'organizationId', 'idempotencyKey'], {
        unique: true
})
@MultiORMEntity('marketing_event')
export class MarketingEvent extends TenantOrganizationBaseEntity implements IRepairOrderCompletedEvent {
        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        eventId: ID;

        @ApiProperty({ enum: [REPAIR_ORDER_COMPLETED_EVENT] })
        @IsNotEmpty()
        @IsString()
        @MultiORMColumn()
        eventType: typeof REPAIR_ORDER_COMPLETED_EVENT;

        @ApiProperty({ type: () => Number })
        @MultiORMColumn()
        schemaVersion: 1;

        @ApiProperty({ type: () => String })
        @IsNotEmpty()
        @IsString()
        @MultiORMColumn()
        idempotencyKey: string;

        @ApiProperty({ type: () => Date })
        @IsDate()
        @MultiORMColumn()
        occurredAt: Date;

        @ApiProperty({ enum: ['repair_order'] })
        @IsNotEmpty()
        @IsString()
        @MultiORMColumn()
        aggregateType: 'repair_order';

        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        aggregateId: ID;

        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        repairOrderId: ID;

        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        customerId: ID;

        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        vehicleId: ID;

        @ApiProperty({ type: () => String })
        @IsUUID()
        @MultiORMColumn()
        appointmentId: ID;
}