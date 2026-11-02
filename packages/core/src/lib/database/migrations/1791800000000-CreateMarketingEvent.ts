import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMarketingEvent1791800000000 implements MigrationInterface {
        name = 'CreateMarketingEvent1791800000000';

        public async up(queryRunner: QueryRunner): Promise<void> {
                const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
                const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
                const idType = isPostgres ? 'uuid' : 'varchar';
                const idLength = isPostgres ? undefined : '255';
                const dateType = isPostgres ? 'timestamp' : 'datetime';
                const base = [
                        {
                                name: 'id',
                                type: idType,
                                length: isPostgres ? undefined : '36',
                                isPrimary: true,
                                isNullable: false,
                                default: isPostgres ? 'gen_random_uuid()' : undefined
                        },
                        { name: 'createdAt', type: dateType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                        { name: 'updatedAt', type: dateType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                        { name: 'deletedAt', type: dateType, isNullable: true },
                        { name: 'archivedAt', type: dateType, isNullable: true },
                        { name: 'isActive', type: isMySql ? 'tinyint' : 'boolean', isNullable: true, default: isMySql ? '1' : 'true' },
                        { name: 'isArchived', type: isMySql ? 'tinyint' : 'boolean', isNullable: true, default: isMySql ? '0' : 'false' },
                        { name: 'createdByUserId', type: idType, length: idLength, isNullable: true },
                        { name: 'updatedByUserId', type: idType, length: idLength, isNullable: true },
                        { name: 'deletedByUserId', type: idType, length: idLength, isNullable: true },
                        { name: 'tenantId', type: idType, length: idLength, isNullable: true },
                        { name: 'organizationId', type: idType, length: idLength, isNullable: true }
                ];

                await queryRunner.createTable(
                        new Table({
                                name: 'marketing_event',
                                columns: [
                                        ...base,
                                        { name: 'eventId', type: idType, length: idLength, isNullable: false },
                                        { name: 'eventType', type: 'varchar', length: '255', isNullable: false },
                                        { name: 'schemaVersion', type: 'int', isNullable: false },
                                        { name: 'idempotencyKey', type: 'varchar', length: '255', isNullable: false },
                                        { name: 'occurredAt', type: dateType, isNullable: false },
                                        { name: 'aggregateType', type: 'varchar', length: '255', isNullable: false },
                                        { name: 'aggregateId', type: idType, length: idLength, isNullable: false },
                                        { name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
                                        { name: 'customerId', type: idType, length: idLength, isNullable: false },
                                        { name: 'vehicleId', type: idType, length: idLength, isNullable: false },
                                        { name: 'appointmentId', type: idType, length: idLength, isNullable: false }
                                ]
                        })
                );

                await queryRunner.createIndices('marketing_event', [
                        new TableIndex({
                                name: 'IDX_marketing_event_tenant_idempotency_key_unique',
                                columnNames: ['tenantId', 'organizationId', 'idempotencyKey'],
                                isUnique: true
                        })
                ]);
        }

        public async down(queryRunner: QueryRunner): Promise<void> {
                await queryRunner.dropTable('marketing_event');
        }
}