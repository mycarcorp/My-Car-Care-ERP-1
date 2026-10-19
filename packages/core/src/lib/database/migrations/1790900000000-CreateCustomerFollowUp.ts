import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCustomerFollowUp1790900000000 implements MigrationInterface {
	name = 'CreateCustomerFollowUp1790900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';
		const base = [
			{
				name: 'id',
				type: isPostgres ? 'uuid' : 'varchar',
				length: isPostgres ? undefined : '36',
				isPrimary: true,
				isNullable: false,
				default: isPostgres ? 'gen_random_uuid()' : undefined
			},
			{ name: 'createdAt', type: dateType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
			{ name: 'updatedAt', type: dateType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
			{ name: 'deletedAt', type: dateType, isNullable: true },
			{ name: 'archivedAt', type: dateType, isNullable: true },
			{
				name: 'isActive',
				type: isMySql ? 'tinyint' : 'boolean',
				isNullable: true,
				default: isMySql ? '1' : 'true'
			},
			{
				name: 'isArchived',
				type: isMySql ? 'tinyint' : 'boolean',
				isNullable: true,
				default: isMySql ? '0' : 'false'
			},
			{ name: 'createdByUserId', type: idType, length: idLength, isNullable: true },
			{ name: 'updatedByUserId', type: idType, length: idLength, isNullable: true },
			{ name: 'deletedByUserId', type: idType, length: idLength, isNullable: true },
			{ name: 'tenantId', type: idType, length: idLength, isNullable: true },
			{ name: 'organizationId', type: idType, length: idLength, isNullable: true }
		];

		await queryRunner.createTable(
			new Table({
				name: 'customer_follow_up',
				columns: [
					...base,
					{ name: 'title', type: 'varchar', length: '255', isNullable: false },
					{ name: 'description', type: 'text', isNullable: true },
					{ name: 'type', type: 'varchar', length: '255', isNullable: false, default: "'POST_SERVICE_SATISFACTION'" },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'OPEN'" },
					{ name: 'dueAt', type: dateType, isNullable: true },
					{ name: 'scheduledAt', type: dateType, isNullable: true },
					{ name: 'completedAt', type: dateType, isNullable: true },
					{ name: 'deferredUntil', type: dateType, isNullable: true },
					{ name: 'statusReason', type: 'text', isNullable: true },
					{ name: 'sourceEntityType', type: 'varchar', length: '255', isNullable: true },
					{ name: 'sourceEntityId', type: idType, length: idLength, isNullable: true },
					{ name: 'sourceEventType', type: 'varchar', length: '255', isNullable: true },
					{ name: 'sourceEventKey', type: 'varchar', length: '255', isNullable: true },
					{ name: 'sourceEventAt', type: dateType, isNullable: true },
					{ name: 'customerId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: true },
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: true },
					{ name: 'estimateId', type: idType, length: idLength, isNullable: true },
					{ name: 'invoiceId', type: idType, length: idLength, isNullable: true },
					{ name: 'taskId', type: idType, length: idLength, isNullable: true },
					{ name: 'ownerEmployeeId', type: idType, length: idLength, isNullable: true }
				]
			})
		);

		await queryRunner.createIndices('customer_follow_up', [
			new TableIndex({ name: 'IDX_customer_follow_up_tenant_source_event_key_unique', columnNames: ['tenantId', 'organizationId', 'sourceEventKey'], isUnique: true }),
			new TableIndex({ name: 'IDX_customer_follow_up_customer_status_due', columnNames: ['customerId', 'status', 'dueAt'] })
		]);

		await queryRunner.createForeignKeys('customer_follow_up', [
			new TableForeignKey({
				name: 'FK_customer_follow_up_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_repair_order',
				columnNames: ['repairOrderId'],
				referencedTableName: 'repair_order',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_estimate',
				columnNames: ['estimateId'],
				referencedTableName: 'estimate',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_invoice',
				columnNames: ['invoiceId'],
				referencedTableName: 'invoice',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_task',
				columnNames: ['taskId'],
				referencedTableName: 'task',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			}),
			new TableForeignKey({
				name: 'FK_customer_follow_up_owner_employee',
				columnNames: ['ownerEmployeeId'],
				referencedTableName: 'employee',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			})
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('customer_follow_up');
	}
}
