import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateInspection1790500000000 implements MigrationInterface {
	name = 'CreateInspection1790500000000';
	public async up(queryRunner: QueryRunner): Promise<void> {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		const id = type === DatabaseTypeEnum.postgres ? 'uuid' : 'varchar(255)';
		const date = type === DatabaseTypeEnum.postgres ? 'timestamp' : 'datetime';
		const json = type === DatabaseTypeEnum.postgres ? 'jsonb' : type === DatabaseTypeEnum.mysql ? 'json' : 'text';
		await queryRunner.query(
			`CREATE TABLE inspection (id ${id} PRIMARY KEY ${type === DatabaseTypeEnum.postgres ? 'DEFAULT gen_random_uuid()' : ''}, "createdAt" ${date} NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" ${date} NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" ${date}, "isActive" ${type === DatabaseTypeEnum.mysql ? 'tinyint' : 'boolean'} DEFAULT ${type === DatabaseTypeEnum.mysql ? 1 : 'true'}, "isArchived" ${type === DatabaseTypeEnum.mysql ? 'tinyint' : 'boolean'} DEFAULT ${type === DatabaseTypeEnum.mysql ? 0 : 'false'}, "tenantId" ${id}, "organizationId" ${id}, status varchar(255) NOT NULL DEFAULT 'DRAFT', "inspectedAt" ${date} NOT NULL, "repairOrderId" ${id} NOT NULL, "vehicleId" ${id} NOT NULL, "technicianEmployeeId" ${id} NOT NULL)`
		);
		await queryRunner.query(
			`CREATE TABLE inspection_finding (id ${id} PRIMARY KEY ${type === DatabaseTypeEnum.postgres ? 'DEFAULT gen_random_uuid()' : ''}, "createdAt" ${date} NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" ${date} NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" ${date}, "isActive" ${type === DatabaseTypeEnum.mysql ? 'tinyint' : 'boolean'} DEFAULT ${type === DatabaseTypeEnum.mysql ? 1 : 'true'}, "isArchived" ${type === DatabaseTypeEnum.mysql ? 'tinyint' : 'boolean'} DEFAULT ${type === DatabaseTypeEnum.mysql ? 0 : 'false'}, "tenantId" ${id}, "organizationId" ${id}, description text NOT NULL, result varchar(255) NOT NULL, "inspectionId" ${id} NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_inspection_repair_order" ON inspection ("repairOrderId")`);
		await queryRunner.query(`CREATE INDEX "IDX_inspection_vehicle" ON inspection ("vehicleId")`);
		await queryRunner.query(`CREATE INDEX "IDX_inspection_technician" ON inspection ("technicianEmployeeId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_inspection_finding_inspection" ON inspection_finding ("inspectionId")`
		);
		await queryRunner.query(
			`ALTER TABLE inspection ADD CONSTRAINT "FK_inspection_repair_order" FOREIGN KEY ("repairOrderId") REFERENCES repair_order(id) ON DELETE RESTRICT`
		);
		await queryRunner.query(
			`ALTER TABLE inspection ADD CONSTRAINT "FK_inspection_vehicle" FOREIGN KEY ("vehicleId") REFERENCES vehicle(id) ON DELETE RESTRICT`
		);
		await queryRunner.query(
			`ALTER TABLE inspection ADD CONSTRAINT "FK_inspection_technician" FOREIGN KEY ("technicianEmployeeId") REFERENCES employee(id) ON DELETE RESTRICT`
		);
		await queryRunner.query(
			`ALTER TABLE inspection_finding ADD CONSTRAINT "FK_inspection_finding_inspection" FOREIGN KEY ("inspectionId") REFERENCES inspection(id) ON DELETE RESTRICT`
		);
		void json;
	}
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE inspection_finding');
		await queryRunner.query('DROP TABLE inspection');
	}
}
