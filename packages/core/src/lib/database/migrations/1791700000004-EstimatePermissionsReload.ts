import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS } from '../../role-permission/default-role-permissions';

const ESTIMATE_PERMISSIONS = [
	PermissionsEnum.ORG_ESTIMATE_VIEW,
	PermissionsEnum.ORG_ESTIMATE_CREATE,
	PermissionsEnum.ORG_ESTIMATE_EDIT,
	PermissionsEnum.ORG_ESTIMATE_SEND
];

export class EstimatePermissionsReload1791700000004 implements MigrationInterface {
	name = 'EstimatePermissionsReload1791700000004';

	public async up(queryRunner: QueryRunner): Promise<void> {
		if (![DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3, DatabaseTypeEnum.postgres, DatabaseTypeEnum.mysql].includes(
			queryRunner.connection.options.type as DatabaseTypeEnum
		)) throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		const roles: Array<{ id: string; tenantId: string; name: string }> = await queryRunner.manager
			.createQueryBuilder().select('role.id', 'id').addSelect('role.tenantId', 'tenantId').addSelect('role.name', 'name')
			.from('role', 'role').where('role.tenantId IS NOT NULL').getRawMany();
		for (const role of roles) {
			const defaults = DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === role.name)?.defaultEnabledPermissions ?? [];
			const existing: Array<{ permission: PermissionsEnum }> = await queryRunner.manager
				.createQueryBuilder().select('rolePermission.permission', 'permission').from('role_permission', 'rolePermission')
				.where('rolePermission.tenantId = :tenantId', { tenantId: role.tenantId })
				.andWhere('rolePermission.roleId = :roleId', { roleId: role.id })
				.andWhere('rolePermission.permission IN (:...permissions)', { permissions: ESTIMATE_PERMISSIONS }).getRawMany();
			const present = new Set(existing.map(({ permission }) => permission));
			for (const permission of ESTIMATE_PERMISSIONS) {
				if (present.has(permission)) continue;
				await queryRunner.manager.createQueryBuilder().insert().into('role_permission').values({
					id: randomUUID(), tenantId: role.tenantId, roleId: role.id, permission,
					enabled: defaults.includes(permission)
				}).execute();
			}
		}
	}

	public async down(_queryRunner: QueryRunner): Promise<void> {
		// Existing tenant permission decisions must not be removed on rollback.
	}
}
