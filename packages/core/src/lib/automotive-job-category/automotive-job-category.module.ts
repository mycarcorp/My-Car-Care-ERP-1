import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobCategoryController } from './automotive-job-category.controller';
import { AutomotiveJobCategory } from './automotive-job-category.entity';
import { AutomotiveJobCategoryService } from './automotive-job-category.service';
import { MikroOrmAutomotiveJobCategoryRepository } from './repository/mikro-orm-automotive-job-category.repository';
import { TypeOrmAutomotiveJobCategoryRepository } from './repository/type-orm-automotive-job-category.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([AutomotiveJobCategory, AutomotiveJob]),
		MikroOrmModule.forFeature([AutomotiveJobCategory]),
		RolePermissionModule
	],
	controllers: [AutomotiveJobCategoryController],
	providers: [
		AutomotiveJobCategoryService,
		TypeOrmAutomotiveJobCategoryRepository,
		MikroOrmAutomotiveJobCategoryRepository
	],
	exports: [AutomotiveJobCategoryService]
})
export class AutomotiveJobCategoryModule {}
