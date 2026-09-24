import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateRepairOrder1790400000000 implements MigrationInterface {
	name = 'CreateRepairOrder1790400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const relationIdType = isPostgres ? 'uuid' : 'varchar';
		const relationIdLength = isPostgres ? undefined : '255';
		const dateTimeType = isPostgres ? 'timestamp' : 'datetime';

		await queryRunner.createTable(
			new Table({
				name: 'repair_order',
				columns: [
					{
						name: 'id',
						type: isPostgres ? 'uuid' : 'varchar',
						length: isPostgres ? undefined : '36',
						isPrimary: true,
						isNullable: false,
						default: isPostgres ? 'gen_random_uuid()' : undefined
					},
					{ name: 'createdAt', type: dateTimeType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
					{ name: 'updatedAt', type: dateTimeType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
					{ name: 'deletedAt', type: dateTimeType, isNullable: true },
					{ name: 'archivedAt', type: dateTimeType, isNullable: true },
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
					{ name: 'createdByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'updatedByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'deletedByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'tenantId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'organizationId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'repairOrderNumber', type: 'varchar', length: '255', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'OPEN'" },
					{ name: 'arrivedAt', type: dateTimeType, isNullable: false },
					{ name: 'arrivalOdometer', type: 'numeric', isNullable: true },
					{ name: 'originalConcern', type: 'text', isNullable: true },
					{ name: 'appointmentId', type: relationIdType, length: relationIdLength, isNullable: false },
					{ name: 'customerId', type: relationIdType, length: relationIdLength, isNullable: false },
					{ name: 'vehicleId', type: relationIdType, length: relationIdLength, isNullable: false },
					{
						name: 'serviceAdvisorEmployeeId',
						type: relationIdType,
						length: relationIdLength,
						isNullable: true
					}
				]
			})
		);
		await queryRunner.createIndices('repair_order', [
			new TableIndex({
				name: 'IDX_repair_order_tenant_number_unique',
				columnNames: ['tenantId', 'repairOrderNumber'],
				isUnique: true
			}),
			new TableIndex({
				name: 'IDX_repair_order_appointment_unique',
				columnNames: ['appointmentId'],
				isUnique: true
			}),
			new TableIndex({ name: 'IDX_repair_order_customer', columnNames: ['customerId'] }),
			new TableIndex({ name: 'IDX_repair_order_vehicle', columnNames: ['vehicleId'] })
		]);
		await queryRunner.createForeignKeys('repair_order', [
			new TableForeignKey({
				name: 'FK_repair_order_appointment',
				columnNames: ['appointmentId'],
				referencedTableName: 'employee_appointment',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_repair_order_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_repair_order_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_repair_order_service_advisor',
				columnNames: ['serviceAdvisorEmployeeId'],
				referencedTableName: 'employee',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			})
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('repair_order');
	}
}
