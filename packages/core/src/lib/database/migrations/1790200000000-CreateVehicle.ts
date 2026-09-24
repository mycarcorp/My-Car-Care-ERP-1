import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateVehicle1790200000000 implements MigrationInterface {
	name = 'CreateVehicle1790200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const databaseType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isMySql = databaseType === DatabaseTypeEnum.mysql;
		const isPostgres = databaseType === DatabaseTypeEnum.postgres;
		const jsonType = isPostgres ? 'jsonb' : isMySql ? 'json' : 'text';
		const dateTimeType = isPostgres ? 'timestamp' : isMySql ? 'datetime' : 'datetime';
		const relationIdType = isPostgres ? 'uuid' : 'varchar';
		const relationIdLength = isPostgres ? undefined : '255';

		await queryRunner.createTable(
			new Table({
				name: 'vehicle',
				columns: [
					{ name: 'id', type: isPostgres ? 'uuid' : 'varchar', length: isPostgres ? undefined : '36', isPrimary: true, isNullable: false, default: isPostgres ? 'gen_random_uuid()' : undefined },
					{ name: 'createdAt', type: dateTimeType, isNullable: false, default: isPostgres ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP' },
					{ name: 'updatedAt', type: dateTimeType, isNullable: false, default: isPostgres ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP' },
					{ name: 'deletedAt', type: dateTimeType, isNullable: true },
					{ name: 'isActive', type: isMySql ? 'tinyint' : 'boolean', isNullable: true, default: isMySql ? '1' : 'true' },
					{ name: 'isArchived', type: isMySql ? 'tinyint' : 'boolean', isNullable: true, default: isMySql ? '0' : 'false' },
					{ name: 'archivedAt', type: dateTimeType, isNullable: true },
					{ name: 'createdByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'updatedByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'deletedByUserId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'tenantId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'organizationId', type: relationIdType, length: relationIdLength, isNullable: true },
					{ name: 'customerId', type: relationIdType, length: relationIdLength, isNullable: false },
					{ name: 'vinNormalized', type: 'varchar', length: '17', isNullable: false },
					{ name: 'vin', type: 'varchar', length: '17', isNullable: true },
					{ name: 'year', type: 'int', isNullable: false },
					{ name: 'make', type: 'varchar', length: '255', isNullable: false },
					{ name: 'model', type: 'varchar', length: '255', isNullable: false },
					{ name: 'trim', type: 'varchar', length: '255', isNullable: true },
					{ name: 'bodyStyle', type: 'varchar', length: '255', isNullable: true },
					{ name: 'engine', type: 'varchar', length: '255', isNullable: true },
					{ name: 'drivetrain', type: 'varchar', length: '255', isNullable: true },
					{ name: 'fuelType', type: 'varchar', length: '255', isNullable: true },
					{ name: 'transmission', type: 'varchar', length: '255', isNullable: true },
					{ name: 'plate', type: 'varchar', length: '255', isNullable: true },
					{ name: 'plateJurisdiction', type: 'varchar', length: '255', isNullable: true },
					{ name: 'color', type: 'varchar', length: '255', isNullable: true },
					{ name: 'currentMileage', type: 'numeric', isNullable: true },
					{ name: 'decoderProvider', type: 'varchar', length: '255', isNullable: true },
					{ name: 'decoderVersion', type: 'varchar', length: '255', isNullable: true },
					{ name: 'decodedVehicleData', type: jsonType, isNullable: true },
					{ name: 'decodedAt', type: dateTimeType, isNullable: true }
				]
			})
		);

		await queryRunner.createIndices('vehicle', [
			new TableIndex({ name: 'IDX_vehicle_tenant_vin_normalized_unique', columnNames: ['tenantId', 'vinNormalized'], isUnique: true }),
			new TableIndex({ name: 'IDX_vehicle_customer', columnNames: ['customerId'] })
		]);
		await queryRunner.createForeignKey(
			'vehicle',
			new TableForeignKey({
				name: 'FK_vehicle_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('vehicle');
	}
}
