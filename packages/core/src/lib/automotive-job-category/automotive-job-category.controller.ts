import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { AutomotiveJobCategory } from './automotive-job-category.entity';
import { AutomotiveJobCategoryService } from './automotive-job-category.service';
import { AutomotiveJobCategoryQueryDTO, CreateAutomotiveJobCategoryDTO, UpdateAutomotiveJobCategoryDTO } from './dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/automotive-job-categories')
export class AutomotiveJobCategoryController {
	constructor(private readonly categories: AutomotiveJobCategoryService) {}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	list(@Query() query: AutomotiveJobCategoryQueryDTO): Promise<IPagination<AutomotiveJobCategory>> {
		return this.categories.list(query);
	}

	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_VIEW)
	@Get(':id')
	findOne(@Param('id', UUIDValidationPipe) id: ID): Promise<AutomotiveJobCategory> {
		return this.categories.findOneScoped(id);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_ADD)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	create(@Body() body: CreateAutomotiveJobCategoryDTO): Promise<AutomotiveJobCategory> {
		return this.categories.createCategory(body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_EDIT)
	@Patch(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdateAutomotiveJobCategoryDTO
	): Promise<AutomotiveJobCategory> {
		return this.categories.updateCategory(id, body);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_DELETE)
	@Patch(':id/archive')
	archive(@Param('id', UUIDValidationPipe) id: ID): Promise<AutomotiveJobCategory> {
		return this.categories.archive(id);
	}

	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_DELETE)
	@Delete(':id')
	remove(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		return this.categories.remove(id);
	}
}
