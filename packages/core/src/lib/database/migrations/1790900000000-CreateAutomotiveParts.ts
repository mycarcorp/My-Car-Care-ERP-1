import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateAutomotiveParts1790900000000 implements MigrationInterface {
	name = 'CreateAutomotiveParts1790900000000';

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
				name: 'automotive_part_profile',
				columns: [
					...base,
					{ name: 'productVariantId', type: idType, length: idLength, isNullable: false },
					{ name: 'normalizedPartNumber', type: 'varchar', length: '255', isNullable: false },
					{ name: 'manufacturer', type: 'varchar', length: '255', isNullable: true },
					{ name: 'oemPartNumber', type: 'varchar', length: '255', isNullable: true },
					{ name: 'aftermarketPartNumber', type: 'varchar', length: '255', isNullable: true },
					{ name: 'barcode', type: 'varchar', length: '255', isNullable: true },
					{ name: 'internalNotes', type: 'text', isNullable: true },
					{
						name: 'enabled',
						type: isMySql ? 'tinyint' : 'boolean',
						isNullable: false,
						default: isMySql ? '1' : 'true'
					}
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'automotive_part_vendor',
				columns: [
					...base,
					{ name: 'automotivePartProfileId', type: idType, length: idLength, isNullable: false },
					{ name: 'organizationVendorId', type: idType, length: idLength, isNullable: false },
					{ name: 'supplierPartNumber', type: 'varchar', length: '255', isNullable: true },
					{ name: 'supplierCost', type: 'numeric', isNullable: true },
					{ name: 'leadTimeDays', type: 'int', isNullable: true },
					{
						name: 'preferred',
						type: isMySql ? 'tinyint' : 'boolean',
						isNullable: false,
						default: isMySql ? '0' : 'false'
					},
					{
						name: 'active',
						type: isMySql ? 'tinyint' : 'boolean',
						isNullable: false,
						default: isMySql ? '1' : 'true'
					}
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'part_stock_movement',
				columns: [
					...base,
					{ name: 'automotivePartProfileId', type: idType, length: idLength, isNullable: false },
					{ name: 'productVariantId', type: idType, length: idLength, isNullable: false },
					{ name: 'warehouseId', type: idType, length: idLength, isNullable: false },
					{ name: 'warehouseProductVariantId', type: idType, length: idLength, isNullable: false },
					{ name: 'type', type: 'varchar', length: '255', isNullable: false },
					{ name: 'quantityDelta', type: 'numeric', isNullable: false },
					{ name: 'quantityBefore', type: 'numeric', isNullable: false },
					{ name: 'quantityAfter', type: 'numeric', isNullable: false },
					{ name: 'reason', type: 'text', isNullable: false },
					{ name: 'notes', type: 'text', isNullable: true }
				]
			})
		);

		await queryRunner.createIndices('automotive_part_profile', [
			new TableIndex({
				name: 'IDX_automotive_part_profile_variant_unique',
				columnNames: ['productVariantId'],
				isUnique: true
			}),
			new TableIndex({
				name: 'IDX_automotive_part_profile_number_unique',
				columnNames: ['tenantId', 'organizationId', 'normalizedPartNumber'],
				isUnique: true
			})
		]);
		await queryRunner.createIndex(
			'automotive_part_vendor',
			new TableIndex({
				name: 'IDX_automotive_part_vendor_unique',
				columnNames: ['automotivePartProfileId', 'organizationVendorId'],
				isUnique: true
			})
		);
		await queryRunner.createIndex(
			'part_stock_movement',
			new TableIndex({
				name: 'IDX_part_stock_movement_lookup',
				columnNames: ['tenantId', 'organizationId', 'productVariantId', 'warehouseId', 'createdAt']
			})
		);

		await queryRunner.createForeignKey(
			'automotive_part_profile',
			new TableForeignKey({
				name: 'FK_automotive_part_profile_variant',
				columnNames: ['productVariantId'],
				referencedTableName: 'product_variant',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		);
		await queryRunner.createForeignKeys('automotive_part_vendor', [
			new TableForeignKey({
				name: 'FK_automotive_part_vendor_profile',
				columnNames: ['automotivePartProfileId'],
				referencedTableName: 'automotive_part_profile',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_automotive_part_vendor_vendor',
				columnNames: ['organizationVendorId'],
				referencedTableName: 'organization_vendor',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		await queryRunner.createForeignKeys('part_stock_movement', [
			new TableForeignKey({
				name: 'FK_part_stock_movement_profile',
				columnNames: ['automotivePartProfileId'],
				referencedTableName: 'automotive_part_profile',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_part_stock_movement_variant',
				columnNames: ['productVariantId'],
				referencedTableName: 'product_variant',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_part_stock_movement_warehouse',
				columnNames: ['warehouseId'],
				referencedTableName: 'warehouse',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_part_stock_movement_balance',
				columnNames: ['warehouseProductVariantId'],
				referencedTableName: 'warehouse_product_variant',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
		if (isPostgres) {
			await queryRunner.query(
				`CREATE FUNCTION prevent_part_stock_movement_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'part_stock_movement is append-only'; END; $$ LANGUAGE plpgsql`
			);
			await queryRunner.query(
				`CREATE TRIGGER part_stock_movement_append_only BEFORE UPDATE OR DELETE ON part_stock_movement FOR EACH ROW EXECUTE FUNCTION prevent_part_stock_movement_mutation()`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type === DatabaseTypeEnum.postgres) {
			await queryRunner.query(`DROP TRIGGER IF EXISTS part_stock_movement_append_only ON part_stock_movement`);
			await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_part_stock_movement_mutation()`);
		}
		await queryRunner.dropTable('part_stock_movement');
		await queryRunner.dropTable('automotive_part_vendor');
		await queryRunner.dropTable('automotive_part_profile');
	}
}
