import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreatePurchaseOrders1791000000000 implements MigrationInterface {
	name = 'CreatePurchaseOrders1791000000000';
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
		await queryRunner.addColumn(
			'warehouse',
			new TableColumn({ name: 'inventorySource', type: 'varchar', length: '255', isNullable: true })
		);
		await queryRunner.addColumns('part_stock_movement', [
			new TableColumn({ name: 'inventorySource', type: 'varchar', length: '255', isNullable: true }),
			new TableColumn({ name: 'purchaseReceiptId', type: idType, length: idLength, isNullable: true })
		]);
		await queryRunner.createTable(
			new Table({
				name: 'purchase_order',
				columns: [
					...base,
					{ name: 'purchaseOrderNumber', type: 'varchar', length: '255', isNullable: false },
					{ name: 'organizationVendorId', type: idType, length: idLength, isNullable: false },
					{ name: 'warehouseId', type: idType, length: idLength, isNullable: false },
					{ name: 'inventorySource', type: 'varchar', length: '255', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'DRAFT'" },
					{ name: 'orderedAt', type: dateType, isNullable: true },
					{ name: 'expectedAt', type: dateType, isNullable: true },
					{ name: 'currency', type: 'varchar', length: '255', isNullable: false },
					{ name: 'subtotal', type: 'numeric', isNullable: false },
					{ name: 'taxTotal', type: 'numeric', isNullable: false },
					{ name: 'total', type: 'numeric', isNullable: false },
					{ name: 'notes', type: 'text', isNullable: true }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'purchase_order_line',
				columns: [
					...base,
					{ name: 'purchaseOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'automotivePartProfileId', type: idType, length: idLength, isNullable: false },
					{ name: 'productVariantId', type: idType, length: idLength, isNullable: false },
					{ name: 'supplierPartNumberSnapshot', type: 'varchar', length: '255', isNullable: true },
					{ name: 'orderedQuantity', type: 'numeric', isNullable: false },
					{ name: 'receivedQuantity', type: 'numeric', isNullable: false, default: '0' },
					{ name: 'unitCost', type: 'numeric', isNullable: false },
					{ name: 'taxAmount', type: 'numeric', isNullable: false },
					{ name: 'lineTotal', type: 'numeric', isNullable: false },
					{ name: 'notes', type: 'text', isNullable: true }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'purchase_receipt',
				columns: [
					...base,
					{ name: 'purchaseOrderId', type: idType, length: idLength, isNullable: false },
					{ name: 'receiptNumber', type: 'varchar', length: '255', isNullable: false },
					{ name: 'externalReference', type: 'varchar', length: '255', isNullable: true },
					{ name: 'receivedAt', type: dateType, isNullable: false },
					{ name: 'warehouseId', type: idType, length: idLength, isNullable: false },
					{ name: 'inventorySource', type: 'varchar', length: '255', isNullable: false },
					{ name: 'status', type: 'varchar', length: '255', isNullable: false, default: "'POSTED'" }
				]
			})
		);
		await queryRunner.createTable(
			new Table({
				name: 'purchase_receipt_line',
				columns: [
					...base,
					{ name: 'purchaseReceiptId', type: idType, length: idLength, isNullable: false },
					{ name: 'purchaseOrderLineId', type: idType, length: idLength, isNullable: false },
					{ name: 'automotivePartProfileId', type: idType, length: idLength, isNullable: false },
					{ name: 'productVariantId', type: idType, length: idLength, isNullable: false },
					{ name: 'receivedQuantity', type: 'numeric', isNullable: false },
					{ name: 'actualUnitCost', type: 'numeric', isNullable: false },
					{ name: 'taxAmount', type: 'numeric', isNullable: false },
					{ name: 'lineTotal', type: 'numeric', isNullable: false }
				]
			})
		);
		await queryRunner.createIndices('purchase_order', [
			new TableIndex({
				name: 'IDX_purchase_order_tenant_number_unique',
				columnNames: ['tenantId', 'purchaseOrderNumber'],
				isUnique: true
			})
		]);
		await queryRunner.createIndex(
			'purchase_order_line',
			new TableIndex({
				name: 'IDX_purchase_order_line_order_variant_unique',
				columnNames: ['purchaseOrderId', 'productVariantId'],
				isUnique: true
			})
		);
		await queryRunner.createIndices('purchase_receipt', [
			new TableIndex({
				name: 'IDX_purchase_receipt_tenant_number_unique',
				columnNames: ['tenantId', 'receiptNumber'],
				isUnique: true
			}),
			new TableIndex({
				name: 'IDX_purchase_receipt_reference_unique',
				columnNames: ['tenantId', 'organizationId', 'purchaseOrderId', 'externalReference'],
				isUnique: true
			})
		]);
		await queryRunner.createIndex(
			'purchase_receipt_line',
			new TableIndex({
				name: 'IDX_purchase_receipt_line_unique',
				columnNames: ['purchaseReceiptId', 'purchaseOrderLineId'],
				isUnique: true
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
		await queryRunner.createForeignKeys('purchase_order', [
			fk('FK_purchase_order_vendor', 'organizationVendorId', 'organization_vendor'),
			fk('FK_purchase_order_warehouse', 'warehouseId', 'warehouse')
		]);
		await queryRunner.createForeignKeys('purchase_order_line', [
			fk('FK_purchase_order_line_order', 'purchaseOrderId', 'purchase_order'),
			fk('FK_purchase_order_line_part', 'automotivePartProfileId', 'automotive_part_profile'),
			fk('FK_purchase_order_line_variant', 'productVariantId', 'product_variant')
		]);
		await queryRunner.createForeignKeys('purchase_receipt', [
			fk('FK_purchase_receipt_order', 'purchaseOrderId', 'purchase_order'),
			fk('FK_purchase_receipt_warehouse', 'warehouseId', 'warehouse')
		]);
		await queryRunner.createForeignKeys('purchase_receipt_line', [
			fk('FK_purchase_receipt_line_receipt', 'purchaseReceiptId', 'purchase_receipt'),
			fk('FK_purchase_receipt_line_order_line', 'purchaseOrderLineId', 'purchase_order_line'),
			fk('FK_purchase_receipt_line_part', 'automotivePartProfileId', 'automotive_part_profile'),
			fk('FK_purchase_receipt_line_variant', 'productVariantId', 'product_variant')
		]);
		await queryRunner.createForeignKey(
			'part_stock_movement',
			fk('FK_part_stock_movement_receipt', 'purchaseReceiptId', 'purchase_receipt')
		);
		if (isPostgres) {
			await queryRunner.query(
				`CREATE FUNCTION prevent_purchase_receipt_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'purchase_receipt is immutable'; END; $$ LANGUAGE plpgsql`
			);
			await queryRunner.query(
				`CREATE TRIGGER purchase_receipt_append_only BEFORE UPDATE OR DELETE ON purchase_receipt FOR EACH ROW EXECUTE FUNCTION prevent_purchase_receipt_mutation()`
			);
			await queryRunner.query(
				`CREATE TRIGGER purchase_receipt_line_append_only BEFORE UPDATE OR DELETE ON purchase_receipt_line FOR EACH ROW EXECUTE FUNCTION prevent_purchase_receipt_mutation()`
			);
		}
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.connection.options.type === DatabaseTypeEnum.postgres) {
			await queryRunner.query(
				`DROP TRIGGER IF EXISTS purchase_receipt_line_append_only ON purchase_receipt_line`
			);
			await queryRunner.query(`DROP TRIGGER IF EXISTS purchase_receipt_append_only ON purchase_receipt`);
			await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_purchase_receipt_mutation()`);
		}
		await queryRunner.dropTable('purchase_receipt_line');
		await queryRunner.dropTable('purchase_receipt');
		await queryRunner.dropTable('purchase_order_line');
		await queryRunner.dropTable('purchase_order');
		await queryRunner.dropColumn('part_stock_movement', 'purchaseReceiptId');
		await queryRunner.dropColumn('part_stock_movement', 'inventorySource');
		await queryRunner.dropColumn('warehouse', 'inventorySource');
	}
}
