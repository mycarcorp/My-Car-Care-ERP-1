import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateEstimate1790700000000 implements MigrationInterface {
	name = 'CreateEstimate1790700000000';
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
				name: 'estimate',
				columns: [
					...base,
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateNumber', type: 'numeric', isNullable: false },
					{ name: 'rootEstimateId', type: idType, length: idLength, isNullable: true },
					{ name: 'revisionNumber', type: 'int', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'DRAFT'" },
					{ name: 'currency', type: 'varchar', length: '255', isNullable: false },
					{ name: 'subtotal', type: 'numeric', isNullable: false },
					{ name: 'taxTotal', type: 'numeric', isNullable: false },
					{ name: 'discountTotal', type: 'numeric', isNullable: false },
					{ name: 'total', type: 'numeric', isNullable: false },
					{ name: 'inspectionId', type: idType, length: idLength, isNullable: true },
					{ name: 'diagnosticId', type: idType, length: idLength, isNullable: true }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'estimate_line',
				columns: [
					...base,
					{ name: 'estimateId', type: idType, length: idLength, isNullable: false },
					{ name: 'lineNumber', type: 'int', isNullable: false },
					{ name: 'description', type: 'text', isNullable: false },
					{ name: 'reason', type: 'text', isNullable: false },
					{ name: 'priority', type: 'varchar', length: '255', isNullable: false },
					{ name: 'quantity', type: 'numeric', isNullable: false },
					{ name: 'unitPrice', type: 'numeric', isNullable: false },
					{ name: 'taxAmount', type: 'numeric', isNullable: false },
					{ name: 'discountAmount', type: 'numeric', isNullable: true },
					{ name: 'lineTotal', type: 'numeric', isNullable: false }
				]
			})
		);
		await queryRunner.createIndices('estimate', [
			new TableIndex({
				name: 'IDX_estimate_tenant_number_unique',
				columnNames: ['tenantId', 'estimateNumber'],
				isUnique: true
			}),
			new TableIndex({
				name: 'IDX_estimate_root_revision_unique',
				columnNames: ['rootEstimateId', 'revisionNumber'],
				isUnique: true
			}),
			new TableIndex({ name: 'IDX_estimate_repair_order', columnNames: ['repairOrderId'] })
		]);
		await queryRunner.createIndex(
			'estimate_line',
			new TableIndex({
				name: 'IDX_estimate_line_number_unique',
				columnNames: ['estimateId', 'lineNumber'],
				isUnique: true
			})
		);
		await queryRunner.createForeignKeys('estimate', [
			new TableForeignKey({
				name: 'FK_estimate_repair_order',
				columnNames: ['repairOrderId'],
				referencedTableName: 'repair_order',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_estimate_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_estimate_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_estimate_inspection',
				columnNames: ['inspectionId'],
				referencedTableName: 'inspection',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_estimate_diagnostic',
				columnNames: ['diagnosticId'],
				referencedTableName: 'diagnostic',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		await queryRunner.createForeignKey(
			'estimate_line',
			new TableForeignKey({
				name: 'FK_estimate_line_estimate',
				columnNames: ['estimateId'],
				referencedTableName: 'estimate',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		);
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('estimate_line');
		await queryRunner.dropTable('estimate');
	}
}
