import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddMyCarCareFieldsToEmployeeAppointment1790300000000 implements MigrationInterface {
	name = 'AddMyCarCareFieldsToEmployeeAppointment1790300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const isPostgres = queryRunner.connection.options.type === DatabaseTypeEnum.postgres;
		const relationIdType = isPostgres ? 'uuid' : 'varchar';
		const relationIdLength = isPostgres ? undefined : '255';

		await queryRunner.addColumns('employee_appointment', [
			new TableColumn({ name: 'customerId', type: relationIdType, length: relationIdLength, isNullable: true }),
			new TableColumn({ name: 'vehicleId', type: relationIdType, length: relationIdLength, isNullable: true }),
			new TableColumn({ name: 'originalConcern', type: 'text', isNullable: true })
		]);
		await queryRunner.createIndices('employee_appointment', [
			new TableIndex({ name: 'IDX_employee_appointment_customer', columnNames: ['customerId'] }),
			new TableIndex({ name: 'IDX_employee_appointment_vehicle', columnNames: ['vehicleId'] })
		]);
		await queryRunner.createForeignKeys('employee_appointment', [
			new TableForeignKey({
				name: 'FK_employee_appointment_customer',
				columnNames: ['customerId'],
				referencedTableName: 'organization_contact',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			}),
			new TableForeignKey({
				name: 'FK_employee_appointment_vehicle',
				columnNames: ['vehicleId'],
				referencedTableName: 'vehicle',
				referencedColumnNames: ['id'],
				onDelete: 'RESTRICT'
			})
		]);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('employee_appointment', 'FK_employee_appointment_vehicle');
		await queryRunner.dropForeignKey('employee_appointment', 'FK_employee_appointment_customer');
		await queryRunner.dropIndex('employee_appointment', 'IDX_employee_appointment_vehicle');
		await queryRunner.dropIndex('employee_appointment', 'IDX_employee_appointment_customer');
		await queryRunner.dropColumns('employee_appointment', ['originalConcern', 'vehicleId', 'customerId']);
	}
}
