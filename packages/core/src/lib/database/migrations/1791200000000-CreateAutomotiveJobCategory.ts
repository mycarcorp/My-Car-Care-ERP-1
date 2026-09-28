import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateAutomotiveJobCategory1791200000000 implements MigrationInterface {
	name = 'CreateAutomotiveJobCategory1791200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const isMySql = queryRunner.connection.options.type === DatabaseTypeEnum.mysql;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';

		await queryRunner.createTable(
			new Table({
				name: 'automotive_job_category',
				columns: [
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
					{ name: 'organizationId', type: idType, length: idLength, isNullable: true },
					{ name: 'name', type: 'varchar', length: '255', isNullable: false },
					{ name: 'description', type: 'text', isNullable: true },
					{ name: 'displayOrder', type: 'int', isNullable: true }
				]
			})
		);
		await queryRunner.createIndices('automotive_job_category', [
			new TableIndex({ name: 'IDX_automotive_job_category_scope', columnNames: ['tenantId', 'organizationId'] }),
			new TableIndex({
				name: 'IDX_automotive_job_category_name_unique',
				columnNames: ['tenantId', 'organizationId', 'name'],
				isUnique: true
			}),
			new TableIndex({
				name: 'IDX_automotive_job_category_order',
				columnNames: ['tenantId', 'organizationId', 'displayOrder']
			})
		]);
		await queryRunner.createForeignKeys('automotive_job_category', [
			new TableForeignKey({
				name: 'FK_automotive_job_category_tenant',
				columnNames: ['tenantId'],
				referencedTableName: 'tenant',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE'
			}),
			new TableForeignKey({
				name: 'FK_automotive_job_category_organization',
				columnNames: ['organizationId'],
				referencedTableName: 'organization',
				referencedColumnNames: ['id'],
				onDelete: 'CASCADE'
			})
		]);

		await queryRunner.addColumn('automotive_job', {
			name: 'categoryId',
			type: idType,
			length: idLength,
			isNullable: true
		});
		await queryRunner.createIndex(
			'automotive_job',
			new TableIndex({ name: 'IDX_automotive_job_category', columnNames: ['categoryId'] })
		);
		await queryRunner.createForeignKey(
			'automotive_job',
			new TableForeignKey({
				name: 'FK_automotive_job_category',
				columnNames: ['categoryId'],
				referencedTableName: 'automotive_job_category',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('automotive_job', 'FK_automotive_job_category');
		await queryRunner.dropIndex('automotive_job', 'IDX_automotive_job_category');
		await queryRunner.dropColumn('automotive_job', 'categoryId');
		await queryRunner.dropTable('automotive_job_category');
	}
}
