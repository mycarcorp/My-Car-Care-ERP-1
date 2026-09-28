import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateAutomotiveJob1791100000000 implements MigrationInterface {
	name = 'CreateAutomotiveJob1791100000000';

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
				name: 'automotive_job',
				columns: [
					...base,
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateRevisionNumber', type: 'int', isNullable: false },
					{ name: 'estimateLineId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerWorkApprovalId', type: idType, length: idLength, isNullable: false },
					{ name: 'customerWorkApprovalLineId', type: idType, length: idLength, isNullable: false },
					{ name: 'assignedEmployeeId', type: idType, length: idLength, isNullable: true },
					{ name: 'title', type: 'text', isNullable: false },
					{ name: 'description', type: 'text', isNullable: false },
					{ name: 'internalNotes', type: 'text', isNullable: true },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'OPEN'" },
					{ name: 'estimatedHours', type: 'numeric', isNullable: true },
					{ name: 'authorizedHours', type: 'numeric', isNullable: true }
				]
			})
		);
		await queryRunner.addColumn(
			'time_log',
			new TableColumn({ name: 'automotiveJobId', type: idType, length: idLength, isNullable: true })
		);
		await queryRunner.createIndices('automotive_job', [
			new TableIndex({
				name: 'IDX_automotive_job_approval_line_unique',
				columnNames: ['customerWorkApprovalLineId'],
				isUnique: true
			}),
			new TableIndex({ name: 'IDX_automotive_job_ro_status', columnNames: ['repairOrderId', 'status'] }),
			new TableIndex({
				name: 'IDX_automotive_job_employee_status',
				columnNames: ['assignedEmployeeId', 'status']
			})
		]);
		await queryRunner.createIndex(
			'time_log',
			new TableIndex({ name: 'IDX_time_log_automotive_job', columnNames: ['automotiveJobId'] })
		);
		const fk = (name: string, column: string, table: string, onDelete: 'RESTRICT' | 'SET NULL' = 'RESTRICT') =>
			new TableForeignKey({
				name,
				columnNames: [column],
				referencedTableName: table,
				referencedColumnNames: ['id'],
				onDelete
			});
		await queryRunner.createForeignKeys('automotive_job', [
			fk('FK_automotive_job_repair_order', 'repairOrderId', 'repair_order'),
			fk('FK_automotive_job_estimate', 'estimateId', 'estimate'),
			fk('FK_automotive_job_estimate_line', 'estimateLineId', 'estimate_line'),
			fk('FK_automotive_job_approval', 'customerWorkApprovalId', 'customer_work_approval'),
			fk('FK_automotive_job_approval_line', 'customerWorkApprovalLineId', 'customer_work_approval_line'),
			fk('FK_automotive_job_employee', 'assignedEmployeeId', 'employee', 'SET NULL')
		]);
		await queryRunner.createForeignKey(
			'time_log',
			fk('FK_time_log_automotive_job', 'automotiveJobId', 'automotive_job', 'SET NULL')
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('time_log', 'FK_time_log_automotive_job');
		await queryRunner.dropIndex('time_log', 'IDX_time_log_automotive_job');
		await queryRunner.dropColumn('time_log', 'automotiveJobId');
		await queryRunner.dropTable('automotive_job');
	}
}
