import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddRepairOrderToInvoice1791700000000 implements MigrationInterface {
	name = 'AddRepairOrderToInvoice1791700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const databaseType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isPostgres = databaseType === DatabaseTypeEnum.postgres;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';

		// No unique constraint: invoice-per-RO idempotency is enforced transactionally in RepairOrderInvoiceService.
		await queryRunner.addColumn(
			'invoice',
			new TableColumn({ name: 'repairOrderId', type: idType, length: idLength, isNullable: true })
		);
		await queryRunner.createIndex(
			'invoice',
			new TableIndex({ name: 'IDX_invoice_repair_order', columnNames: ['repairOrderId'] })
		);
		await queryRunner.createForeignKey(
			'invoice',
			new TableForeignKey({
				name: 'FK_invoice_repair_order',
				columnNames: ['repairOrderId'],
				referencedTableName: 'repair_order',
				referencedColumnNames: ['id'],
				onDelete: 'SET NULL'
			})
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('invoice', 'FK_invoice_repair_order');
		await queryRunner.dropIndex('invoice', 'IDX_invoice_repair_order');
		await queryRunner.dropColumn('invoice', 'repairOrderId');
	}
}
