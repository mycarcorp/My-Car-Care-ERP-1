import { DatabaseTypeEnum } from '@gauzy/config';
import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddAutomotiveJobPartConsumption1791400000000 implements MigrationInterface {
	name = 'AddAutomotiveJobPartConsumption1791400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		await queryRunner.addColumns('part_stock_movement', [
			new TableColumn({ name: 'automotiveJobId', type: idType, length: idLength, isNullable: true }),
			new TableColumn({ name: 'repairOrderId', type: idType, length: idLength, isNullable: true }),
			new TableColumn({ name: 'unitCost', type: 'numeric', isNullable: true }),
			new TableColumn({ name: 'costCurrency', type: 'varchar', length: '255', isNullable: true }),
			new TableColumn({ name: 'recordedByUserId', type: idType, length: idLength, isNullable: true }),
			new TableColumn({ name: 'reversesMovementId', type: idType, length: idLength, isNullable: true }),
			new TableColumn({ name: 'operationKey', type: 'varchar', length: '36', isNullable: true })
		]);
		const fk = (name: string, column: string, table: string) =>
			new TableForeignKey({ name, columnNames: [column], referencedTableName: table,
				referencedColumnNames: ['id'], onDelete: 'RESTRICT' });
		await queryRunner.createForeignKeys('part_stock_movement', [
			fk('FK_part_stock_movement_job', 'automotiveJobId', 'automotive_job'),
			fk('FK_part_stock_movement_repair_order', 'repairOrderId', 'repair_order'),
			fk('FK_part_stock_movement_recorded_by', 'recordedByUserId', 'user'),
			fk('FK_part_stock_movement_reversal', 'reversesMovementId', 'part_stock_movement')
		]);
		await queryRunner.createIndices('part_stock_movement', [
			new TableIndex({ name: 'IDX_part_stock_movement_job_history',
				columnNames: ['tenantId', 'organizationId', 'automotiveJobId', 'createdAt'] }),
			new TableIndex({ name: 'IDX_part_stock_movement_repair_order_history',
				columnNames: ['tenantId', 'organizationId', 'repairOrderId', 'createdAt'] }),
			new TableIndex({ name: 'IDX_part_stock_movement_operation_unique',
				columnNames: ['tenantId', 'organizationId', 'operationKey'], isUnique: true }),
			new TableIndex({ name: 'IDX_part_stock_movement_reversal_unique',
				columnNames: ['reversesMovementId'], isUnique: true })
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropIndex('part_stock_movement', 'IDX_part_stock_movement_reversal_unique');
		await queryRunner.dropIndex('part_stock_movement', 'IDX_part_stock_movement_operation_unique');
		await queryRunner.dropIndex('part_stock_movement', 'IDX_part_stock_movement_repair_order_history');
		await queryRunner.dropIndex('part_stock_movement', 'IDX_part_stock_movement_job_history');
		await queryRunner.dropForeignKey('part_stock_movement', 'FK_part_stock_movement_reversal');
		await queryRunner.dropForeignKey('part_stock_movement', 'FK_part_stock_movement_recorded_by');
		await queryRunner.dropForeignKey('part_stock_movement', 'FK_part_stock_movement_repair_order');
		await queryRunner.dropForeignKey('part_stock_movement', 'FK_part_stock_movement_job');
		for (const column of ['operationKey', 'reversesMovementId', 'recordedByUserId', 'costCurrency',
			'unitCost', 'repairOrderId', 'automotiveJobId']) {
			await queryRunner.dropColumn('part_stock_movement', column);
		}
	}
}