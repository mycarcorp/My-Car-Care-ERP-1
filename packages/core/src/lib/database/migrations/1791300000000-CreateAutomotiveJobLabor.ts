import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { randomUUID } from 'crypto';

export class CreateAutomotiveJobLabor1791300000000 implements MigrationInterface {
	name = 'CreateAutomotiveJobLabor1791300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const databaseType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isMySql = databaseType === DatabaseTypeEnum.mysql;
		const isPostgres = databaseType === DatabaseTypeEnum.postgres;
		const idType = isPostgres ? 'uuid' : 'varchar';
		const idLength = isPostgres ? undefined : '255';
		const dateType = isPostgres ? 'timestamp' : 'datetime';

		await queryRunner.createTable(
			new Table({
				name: 'automotive_job_labor',
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
					{ name: 'automotiveJobId', type: idType, length: idLength, isNullable: false },
					{ name: 'estimateLineId', type: idType, length: idLength, isNullable: true },
					{ name: 'customerWorkApprovalLineId', type: idType, length: idLength, isNullable: true },
					{ name: 'description', type: 'varchar', length: '500', isNullable: false },
					{ name: 'billedHours', type: 'numeric', precision: 14, scale: 2, isNullable: true },
					{
						name: 'status',
						type: 'varchar',
						length: '32',
						isNullable: false,
						default: "'OPEN'"
					},
					{ name: 'completedAt', type: dateType, isNullable: true }
				],
				indices: [
					new TableIndex({
						name: 'IDX_automotive_job_labor_scope',
						columnNames: ['tenantId', 'organizationId']
					}),
					new TableIndex({
						name: 'IDX_automotive_job_labor_job_status',
						columnNames: ['automotiveJobId', 'status']
					}),
					new TableIndex({
						name: 'IDX_automotive_job_labor_approval_line',
						columnNames: ['customerWorkApprovalLineId']
					})
				]
			})
		);
		const fk = (name: string, column: string, table: string, onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL') =>
			new TableForeignKey({
				name,
				columnNames: [column],
				referencedTableName: table,
				referencedColumnNames: ['id'],
				onDelete
			});
		await queryRunner.createForeignKeys('automotive_job_labor', [
			fk('FK_automotive_job_labor_job', 'automotiveJobId', 'automotive_job', 'RESTRICT'),
			fk('FK_automotive_job_labor_estimate_line', 'estimateLineId', 'estimate_line', 'RESTRICT'),
			fk(
				'FK_automotive_job_labor_approval_line',
				'customerWorkApprovalLineId',
				'customer_work_approval_line',
				'RESTRICT'
			),
			fk('FK_automotive_job_labor_tenant', 'tenantId', 'tenant', 'CASCADE'),
			fk('FK_automotive_job_labor_organization', 'organizationId', 'organization', 'CASCADE')
		]);

		const existingJobs: Array<{
			id: string;
			tenantId: string | null;
			organizationId: string | null;
			estimateLineId: string;
			customerWorkApprovalLineId: string;
			title: string | null;
			description: string | null;
			assignedEmployeeId: string | null;
			estimatedHours: number | string | null;
			status: string;
			createdAt: Date | string;
			updatedAt: Date | string;
			createdByUserId: string | null;
			updatedByUserId: string | null;
			deletedByUserId: string | null;
			deletedAt: Date | string | null;
			archivedAt: Date | string | null;
			isActive: boolean | number | null;
			isArchived: boolean | number | null;
		}> = await queryRunner.manager
			.createQueryBuilder()
			.select('job.id', 'id')
			.addSelect('job.tenantId', 'tenantId')
			.addSelect('job.organizationId', 'organizationId')
			.addSelect('job.estimateLineId', 'estimateLineId')
			.addSelect('job.customerWorkApprovalLineId', 'customerWorkApprovalLineId')
			.addSelect('job.title', 'title')
			.addSelect('job.description', 'description')
			.addSelect('job.assignedEmployeeId', 'assignedEmployeeId')
			.addSelect('job.estimatedHours', 'estimatedHours')
			.addSelect('job.status', 'status')
			.addSelect('job.createdAt', 'createdAt')
			.addSelect('job.updatedAt', 'updatedAt')
			.addSelect('job.createdByUserId', 'createdByUserId')
			.addSelect('job.updatedByUserId', 'updatedByUserId')
			.addSelect('job.deletedByUserId', 'deletedByUserId')
			.addSelect('job.deletedAt', 'deletedAt')
			.addSelect('job.archivedAt', 'archivedAt')
			.addSelect('job.isActive', 'isActive')
			.addSelect('job.isArchived', 'isArchived')
			.from('automotive_job', 'job')
			.getRawMany();

		const jobIdToLaborId = new Map<string, string>();
		const laborRows = existingJobs.map((job) => {
			const laborId = randomUUID();
			jobIdToLaborId.set(job.id, laborId);
			const title = job.title?.trim() ?? '';
			const description = job.description?.trim() ?? '';
			const laborDescription = [title, description].filter(Boolean).join(' / ') || 'Automotive labor';
			if (laborDescription.length > 500) {
				throw new Error(
					`Cannot backfill AutomotiveJob ${job.id}: title and description exceed the 500-character AutomotiveJobLabor description limit.`
				);
			}
			const laborStatus =
				job.status === 'COMPLETED'
					? 'COMPLETED'
					: job.status === 'CANCELLED'
						? 'CANCELLED'
						: job.status === 'IN_PROGRESS'
							? 'IN_PROGRESS'
							: 'OPEN';

			return {
				id: laborId,
				createdAt: job.createdAt,
				updatedAt: job.updatedAt,
				deletedAt: job.deletedAt,
				archivedAt: job.archivedAt,
				isActive: job.isActive,
				isArchived: job.isArchived,
				createdByUserId: job.createdByUserId,
				updatedByUserId: job.updatedByUserId,
				deletedByUserId: job.deletedByUserId,
				tenantId: job.tenantId,
				organizationId: job.organizationId,
				automotiveJobId: job.id,
				estimateLineId: job.estimateLineId,
				customerWorkApprovalLineId: job.customerWorkApprovalLineId,
				description: laborDescription,
				billedHours: job.estimatedHours,
				status: laborStatus,
				completedAt: laborStatus === 'COMPLETED' ? job.updatedAt : null
			};
		});
		for (let offset = 0; offset < laborRows.length; offset += 25) {
			await queryRunner.manager
				.createQueryBuilder()
				.insert()
				.into('automotive_job_labor')
				.values(laborRows.slice(offset, offset + 25))
				.execute();
		}

		await queryRunner.createTable(
			new Table({
				name: 'automotive_job_labor_employee',
				columns: [
					{
						name: 'automotiveJobLaborId',
						type: idType,
						length: idLength,
						isPrimary: true,
						isNullable: false
					},
					{ name: 'employeeId', type: idType, length: idLength, isPrimary: true, isNullable: false }
				],
				foreignKeys: [
					fk(
						'FK_automotive_job_labor_employee_labor',
						'automotiveJobLaborId',
						'automotive_job_labor',
						'RESTRICT'
					),
					fk('FK_automotive_job_labor_employee_employee', 'employeeId', 'employee', 'RESTRICT')
				],
				indices: [
					new TableIndex({ name: 'IDX_automotive_job_labor_employee_employee', columnNames: ['employeeId'] })
				]
			})
		);

		const assignedEmployeeIds = [...new Set(existingJobs.map((job) => job.assignedEmployeeId).filter(Boolean))];
		if (assignedEmployeeIds.length) {
			const existingEmployees: Array<{ id: string; tenantId: string | null; organizationId: string | null }> =
				await queryRunner.manager
					.createQueryBuilder()
					.select('employee.id', 'id')
					.addSelect('employee.tenantId', 'tenantId')
					.addSelect('employee.organizationId', 'organizationId')
					.from('employee', 'employee')
					.where('employee.id IN (:...assignedEmployeeIds)', { assignedEmployeeIds })
					.getRawMany();
			const employeesById = new Map(existingEmployees.map((employee) => [employee.id, employee]));
			const laborEmployeeRows: Array<{ automotiveJobLaborId: string; employeeId: string }> = [];
			for (const job of existingJobs) {
				if (!job.assignedEmployeeId) continue;
				const employee = employeesById.get(job.assignedEmployeeId);
				if (!employee || employee.tenantId !== job.tenantId || employee.organizationId !== job.organizationId) {
					throw new Error(
						`Cannot backfill AutomotiveJob ${job.id}: assigned employee ${job.assignedEmployeeId} is not in the same tenant and organization.`
					);
				}
				const automotiveJobLaborId = jobIdToLaborId.get(job.id);
				if (!automotiveJobLaborId) {
					throw new Error(
						`Cannot backfill AutomotiveJob ${job.id}: no AutomotiveJobLabor ID mapping exists.`
					);
				}
				laborEmployeeRows.push({ automotiveJobLaborId, employeeId: job.assignedEmployeeId });
			}
			for (let offset = 0; offset < laborEmployeeRows.length; offset += 50) {
				await queryRunner.manager
					.createQueryBuilder()
					.insert()
					.into('automotive_job_labor_employee')
					.values(laborEmployeeRows.slice(offset, offset + 50))
					.execute();
			}
		}

		await queryRunner.addColumn(
			'time_log',
			new TableColumn({
				name: 'automotiveJobLaborId',
				type: idType,
				length: idLength,
				isNullable: true
			})
		);
		await queryRunner.createIndex(
			'time_log',
			new TableIndex({ name: 'IDX_time_log_automotive_job_labor', columnNames: ['automotiveJobLaborId'] })
		);
		await queryRunner.createForeignKey(
			'time_log',
			fk('FK_time_log_automotive_job_labor', 'automotiveJobLaborId', 'automotive_job_labor', 'RESTRICT')
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropForeignKey('time_log', 'FK_time_log_automotive_job_labor');
		await queryRunner.dropIndex('time_log', 'IDX_time_log_automotive_job_labor');
		await queryRunner.dropColumn('time_log', 'automotiveJobLaborId');
		await queryRunner.dropTable('automotive_job_labor_employee');
		await queryRunner.dropTable('automotive_job_labor');
	}
}
