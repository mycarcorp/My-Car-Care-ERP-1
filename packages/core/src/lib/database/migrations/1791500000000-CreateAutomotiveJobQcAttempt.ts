import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAutomotiveJobQcAttempt1791500000000 implements MigrationInterface {
	name = 'CreateAutomotiveJobQcAttempt1791500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const databaseType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isMySql = databaseType === DatabaseTypeEnum.mysql;
		const isPostgres = databaseType === DatabaseTypeEnum.postgres;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';
		await queryRunner.createTable(
			new Table({
				name: 'automotive_job_qc_attempt',
				columns: [
					{
						name: 'id', type: idType, length: isPostgres ? undefined : '36', isPrimary: true,
						isNullable: false, default: isPostgres ? 'gen_random_uuid()' : undefined
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
					{ name: 'organizationId', type: idType, length: idLength, isNullable: true },
					{ name: 'automotiveJobId', type: idType, length: idLength, isNullable: false },
					{ name: 'status', type: 'varchar', length: '32', isNullable: false },
					{ name: 'reason', type: 'text', isNullable: true },
					{ name: 'notes', type: 'text', isNullable: true },
					{ name: 'checkedByEmployeeId', type: idType, length: idLength, isNullable: true },
					{ name: 'checkedAt', type: dateType, isNullable: true }
				],
				indices: [
					new TableIndex({ name: 'IDX_automotive_job_qc_attempt_job_history', columnNames: ['tenantId', 'organizationId', 'automotiveJobId', 'createdAt'] }),
					new TableIndex({ name: 'IDX_automotive_job_qc_attempt_job_status', columnNames: ['automotiveJobId', 'status'] })
				]
			})
		);
		const fk = (name: string, column: string, table: string) =>
			new TableForeignKey({ name, columnNames: [column], referencedTableName: table, referencedColumnNames: ['id'], onDelete: 'RESTRICT' });
		await queryRunner.createForeignKeys('automotive_job_qc_attempt', [
			fk('FK_automotive_job_qc_attempt_job', 'automotiveJobId', 'automotive_job'),
			fk('FK_automotive_job_qc_attempt_employee', 'checkedByEmployeeId', 'employee')
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('automotive_job_qc_attempt', 'FK_automotive_job_qc_attempt_employee');
		await queryRunner.dropForeignKey('automotive_job_qc_attempt', 'FK_automotive_job_qc_attempt_job');
		await queryRunner.dropTable('automotive_job_qc_attempt');
	}
}