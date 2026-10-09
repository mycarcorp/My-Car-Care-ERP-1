import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateFinancingApplication1791700000006 implements MigrationInterface {
	name = 'CreateFinancingApplication1791700000006';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';
		// MySQL maps plain 'numeric' to decimal(10,0) (zero scale); use explicit decimal(10,2) so
		// monetary columns preserve two decimal places consistently across all supported databases.
		const moneyType = isMySql ? 'decimal' : 'numeric';
		const moneyPrecision = isMySql ? 10 : undefined;
		const moneyScale = isMySql ? 2 : undefined;
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
				name: 'financing_application',
				columns: [
					...base,
					{ name: 'customerId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: false },
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerWorkApprovalId', type: idType, length: idLength, isNullable: true },
					{ name: 'invoiceId', type: idType, length: idLength, isNullable: true },
					{ name: 'provider', type: 'varchar', length: '255', isNullable: true },
					{ name: 'providerApplicationId', type: 'varchar', length: '255', isNullable: true },
					{ name: 'requestedAmount', type: moneyType, precision: moneyPrecision, scale: moneyScale, isNullable: false },
					{ name: 'approvedAmount', type: moneyType, precision: moneyPrecision, scale: moneyScale, isNullable: true },
					{ name: 'fundedAmount', type: moneyType, precision: moneyPrecision, scale: moneyScale, isNullable: true },
					{ name: 'currency', type: 'varchar', length: '255', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'DRAFT'" },
					{ name: 'rejectionReason', type: 'text', isNullable: true },
					{ name: 'submittedAt', type: dateType, isNullable: true },
					{ name: 'decidedAt', type: dateType, isNullable: true },
					{ name: 'acceptedAt', type: dateType, isNullable: true },
					{ name: 'fundedAt', type: dateType, isNullable: true },
					{ name: 'activeKey', type: 'varchar', length: '255', isNullable: true }
				]
			})
		);

		await queryRunner.createIndices('financing_application', [
			new TableIndex({
				name: 'IDX_financing_app_ro_active_unique',
				columnNames: ['tenantId', 'repairOrderId', 'activeKey'],
				isUnique: true
			}),
			new TableIndex({ name: 'IDX_financing_app_repair_order', columnNames: ['repairOrderId'] }),
			new TableIndex({ name: 'IDX_financing_app_estimate', columnNames: ['estimateId'] }),
			new TableIndex({ name: 'IDX_financing_app_customer', columnNames: ['customerId'] }),
			new TableIndex({ name: 'IDX_financing_app_vehicle', columnNames: ['vehicleId'] }),
			new TableIndex({ name: 'IDX_financing_app_status', columnNames: ['status'] })
		]);

		const fk = (name: string, column: string, table: string) =>
			new TableForeignKey({
				name,
				columnNames: [column],
				referencedTableName: table,
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			});
		await queryRunner.createForeignKeys('financing_application', [
			fk('FK_financing_app_customer', 'customerId', 'organization_contact'),
			fk('FK_financing_app_vehicle', 'vehicleId', 'vehicle'),
			fk('FK_financing_app_repair_order', 'repairOrderId', 'repair_order'),
			fk('FK_financing_app_estimate', 'estimateId', 'estimate'),
			fk('FK_financing_app_approval', 'customerWorkApprovalId', 'customer_work_approval'),
			fk('FK_financing_app_invoice', 'invoiceId', 'invoice')
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE financing_application');
	}
}
