import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateDiagnostic1790600000000 implements MigrationInterface {
	name = 'CreateDiagnostic1790600000000';
	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';
		const baseColumns = [
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
				name: 'diagnostic',
				columns: [
					...baseColumns,
					{ name: 'symptom', type: 'text', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'DRAFT'" },
					{ name: 'diagnosedAt', type: dateType, isNullable: false },
					{ name: 'summary', type: 'text', isNullable: true },
					{ name: 'internalNote', type: 'text', isNullable: true },
					{ name: 'completedAt', type: dateType, isNullable: true },
					{ name: 'inspectionId', type: idType, length: idLength, isNullable: false },
					{ name: 'technicianEmployeeId', type: idType, length: idLength, isNullable: false }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'diagnostic_finding',
				columns: [
					...baseColumns,
					{ name: 'kind', type: 'varchar', length: '255', isNullable: false },
					{ name: 'description', type: 'text', isNullable: false },
					{ name: 'diagnosticId', type: idType, length: idLength, isNullable: false }
				]
			})
		);
		await queryRunner.createIndices('diagnostic', [
			new TableIndex({ name: 'IDX_diagnostic_inspection', columnNames: ['inspectionId'] }),
			new TableIndex({ name: 'IDX_diagnostic_technician', columnNames: ['technicianEmployeeId'] })
		]);
		await queryRunner.createIndex(
			'diagnostic_finding',
			new TableIndex({ name: 'IDX_diagnostic_finding_diagnostic', columnNames: ['diagnosticId'] })
		);
		await queryRunner.createForeignKeys('diagnostic', [
			new TableForeignKey({
				name: 'FK_diagnostic_inspection',
				columnNames: ['inspectionId'],
				referencedTableName: 'inspection',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_diagnostic_technician',
				columnNames: ['technicianEmployeeId'],
				referencedTableName: 'employee',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		await queryRunner.createForeignKey(
			'diagnostic_finding',
			new TableForeignKey({
				name: 'FK_diagnostic_finding_diagnostic',
				columnNames: ['diagnosticId'],
				referencedTableName: 'diagnostic',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		);
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE diagnostic_finding');
		await queryRunner.query('DROP TABLE diagnostic');
	}
}
