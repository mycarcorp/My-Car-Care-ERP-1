import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IAutomotiveJobCategory } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/tenant-organization-base.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmAutomotiveJobCategoryRepository } from './repository/mikro-orm-automotive-job-category.repository';

@ColumnIndex('IDX_automotive_job_category_scope', ['tenantId', 'organizationId'])
@ColumnIndex('IDX_automotive_job_category_name_unique', ['tenantId', 'organizationId', 'name'], { unique: true })
@MultiORMEntity('automotive_job_category', {
	mikroOrmRepository: () => MikroOrmAutomotiveJobCategoryRepository
})
export class AutomotiveJobCategory extends TenantOrganizationBaseEntity implements IAutomotiveJobCategory {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	@MultiORMColumn({ length: 255 })
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ nullable: true })
	displayOrder?: number;
}
