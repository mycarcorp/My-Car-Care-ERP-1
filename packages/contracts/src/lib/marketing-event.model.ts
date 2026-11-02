import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export const REPAIR_ORDER_COMPLETED_EVENT = 'repair_order.completed' as const;

export interface IRepairOrderCompletedEvent extends IBasePerTenantAndOrganizationEntityModel {
        eventId: ID;
        eventType: typeof REPAIR_ORDER_COMPLETED_EVENT;
        schemaVersion: 1;
        idempotencyKey: string;
        occurredAt: Date;
        aggregateType: 'repair_order';
        aggregateId: ID;
        repairOrderId: ID;
        customerId: ID;
        vehicleId: ID;
        appointmentId: ID;
}