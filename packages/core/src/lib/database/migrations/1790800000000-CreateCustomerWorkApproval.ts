import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateCustomerWorkApproval1790800000000 implements MigrationInterface {
	name = 'CreateCustomerWorkApproval1790800000000';

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
				name: 'customer_work_approval_request',
				columns: [
					...base,
					{ name: 'estimateId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateRootId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateRevisionNumber', type: 'int', isNullable: false },
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: false },
					{ name: 'tokenHash', type: 'varchar', length: '64', isNullable: false },
					{ name: 'expiresAt', type: dateType, isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'ACTIVE'" }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'customer_work_approval',
				columns: [
					...base,
					{ name: 'approvalRequestId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: false },
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateRevisionNumber', type: 'int', isNullable: false },
					{ name: 'submittedAt', type: dateType, isNullable: false },
					{ name: 'approvedTotal', type: 'numeric', isNullable: false },
					{ name: 'currency', type: 'varchar', length: '255', isNullable: false },
					{
						name: 'submissionState',
						type: 'varchar',
						length: '255',
						isNullable: false,
						default: "'SUBMITTED'"
					},
					{ name: 'estimateSnapshotHash', type: 'varchar', length: '64', isNullable: false },
					{ name: 'ipHash', type: 'varchar', length: '64', isNullable: true },
					{ name: 'userAgent', type: 'varchar', length: '512', isNullable: true },
					{ name: 'channel', type: 'varchar', length: '255', isNullable: false }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'customer_work_approval_line',
				columns: [
					...base,
					{ name: 'customerWorkApprovalId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateLineId', type: idType, length: idLength, isNullable: false },
					{ name: 'selected', type: isMySql ? 'tinyint' : 'boolean', isNullable: false },
					{ name: 'approvedQuantity', type: 'numeric', isNullable: false },
					{ name: 'priority', type: 'varchar', length: '255', isNullable: false },
					{ name: 'description', type: 'text', isNullable: false },
					{ name: 'reason', type: 'text', isNullable: false },
					{ name: 'unitPrice', type: 'numeric', isNullable: false },
					{ name: 'taxAmount', type: 'numeric', isNullable: false },
					{ name: 'discountAmount', type: 'numeric', isNullable: true },
					{ name: 'lineTotal', type: 'numeric', isNullable: false }
				]
			})
		);

		await queryRunner.createIndices('customer_work_approval_request', [
			new TableIndex({ name: 'IDX_cwa_request_estimate_status', columnNames: ['estimateRootId', 'status'] }),
			new TableIndex({ name: 'IDX_cwa_request_token_hash', columnNames: ['tokenHash'] })
		]);
		await queryRunner.createIndex(
			'customer_work_approval',
			new TableIndex({
				name: 'IDX_cwa_approval_request_unique',
				columnNames: ['approvalRequestId'],
				isUnique: true
			})
		);
		await queryRunner.createIndex(
			'customer_work_approval_line',
			new TableIndex({
				name: 'IDX_cwa_line_approval_estimate_line_unique',
				columnNames: ['customerWorkApprovalId', 'estimateLineId'],
				isUnique: true
			})
		);

		await queryRunner.createForeignKeys('customer_work_approval_request', [
			new TableForeignKey({
				name: 'FK_cwa_request_estimate',
				columnNames: ['estimateId'],
				referencedTableName: 'estimate',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_request_repair_order',
				columnNames: ['repairOrderId'],
				referencedTableName: 'repair_order',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_request_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_request_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		await queryRunner.createForeignKeys('customer_work_approval', [
			new TableForeignKey({
				name: 'FK_cwa_approval_request',
				columnNames: ['approvalRequestId'],
				referencedTableName: 'customer_work_approval_request',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_approval_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_approval_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_approval_repair_order',
				columnNames: ['repairOrderId'],
				referencedTableName: 'repair_order',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_approval_estimate',
				columnNames: ['estimateId'],
				referencedTableName: 'estimate',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		await queryRunner.createForeignKeys('customer_work_approval_line', [
			new TableForeignKey({
				name: 'FK_cwa_line_approval',
				columnNames: ['customerWorkApprovalId'],
				referencedTableName: 'customer_work_approval',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_cwa_line_estimate_line',
				columnNames: ['estimateLineId'],
				referencedTableName: 'estimate_line',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('customer_work_approval_line');
		await queryRunner.dropTable('customer_work_approval');
		await queryRunner.dropTable('customer_work_approval_request');
	}
}
