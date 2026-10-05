import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInspection1790500000000 implements MigrationInterface {
	name = 'CreateInspection1790500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const databaseType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isMySql = databaseType === DatabaseTypeEnum.mysql;
		const isPostgres = databaseType === DatabaseTypeEnum.postgres;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';

		await queryRunner.createTable(
			new Table({
				name: 'inspection',
				columns: [
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
					{ name: 'tenantId', type: idType, length: idLength, isNullable: true },
					{ name: 'organizationId', type: idType, length: idLength, isNullable: true },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'DRAFT'" },
					{ name: 'inspectedAt', type: dateType, isNullable: false },
					{ name: 'repairOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'vehicleId', type: idType, length: idLength, isNullable: false },
					{ name: 'technicianEmployeeId', type: idType, length: idLength, isNullable: false }
				],
				indices: [
					new TableIndex({ name: 'IDX_inspection_repair_order', columnNames: ['repairOrderId'] }),
					new TableIndex({ name: 'IDX_inspection_vehicle', columnNames: ['vehicleId'] }),
					new TableIndex({ name: 'IDX_inspection_technician', columnNames: ['technicianEmployeeId'] })
				]
			})
		);

		await queryRunner.createTable(
			new Table({
				name: 'inspection_finding',
				columns: [
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
					{ name: 'tenantId', type: idType, length: idLength, isNullable: true },
					{ name: 'organizationId', type: idType, length: idLength, isNullable: true },
					{ name: 'description', type: 'text', isNullable: false },
					{ name: 'result', type: 'varchar', length: '255', isNullable: false },
					{ name: 'inspectionId', type: idType, length: idLength, isNullable: false }
				],
				indices: [new TableIndex({ name: 'IDX_inspection_finding_inspection', columnNames: ['inspectionId'] })]
			})
		);

		const fk = (name: string, column: string, table: string) =>
			new TableForeignKey({
				name,
				columnNames: [column],
				referencedTableName: table,
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			});
		await queryRunner.createForeignKeys('inspection', [
			fk('FK_inspection_repair_order', 'repairOrderId', 'repair_order'),
			fk('FK_inspection_vehicle', 'vehicleId', 'vehicle'),
			fk('FK_inspection_technician', 'technicianEmployeeId', 'employee')
		]);
		await queryRunner.createForeignKeys('inspection_finding', [
			fk('FK_inspection_finding_inspection', 'inspectionId', 'inspection')
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE inspection_finding');
		await queryRunner.query('DROP TABLE inspection');
	}
}
