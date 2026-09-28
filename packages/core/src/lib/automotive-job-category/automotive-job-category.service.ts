import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { CreateAutomotiveJobCategoryDTO, UpdateAutomotiveJobCategoryDTO } from './dto';
import { AutomotiveJobCategory } from './automotive-job-category.entity';
import { MikroOrmAutomotiveJobCategoryRepository } from './repository/mikro-orm-automotive-job-category.repository';
import { TypeOrmAutomotiveJobCategoryRepository } from './repository/type-orm-automotive-job-category.repository';

@Injectable()
export class AutomotiveJobCategoryService extends TenantAwareCrudService<AutomotiveJobCategory> {
	constructor(
		private readonly categories: TypeOrmAutomotiveJobCategoryRepository,
		mikroOrmRepository: MikroOrmAutomotiveJobCategoryRepository,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>
	) {
		super(categories, mikroOrmRepository);
	}

	async list(options: {
		page?: number;
		limit?: number;
		activeOnly?: boolean;
	}): Promise<IPagination<AutomotiveJobCategory>> {
		const scope = this.scope();
		const page = options.page ?? 1;
		const limit = Math.min(options.limit ?? 100, 500);
		const where = {
			...scope,
			...(options.activeOnly ? { isActive: true, isArchived: false } : {})
		};
		return this.findAll({
			where,
			order: { displayOrder: 'ASC', name: 'ASC' },
			skip: (page - 1) * limit,
			take: limit
		});
	}

	async findOneScoped(id: ID): Promise<AutomotiveJobCategory> {
		return this.findOneByWhereOptions({ id, ...this.scope() });
	}

	async createCategory(input: CreateAutomotiveJobCategoryDTO): Promise<AutomotiveJobCategory> {
		const scope = this.scope();
		const name = this.normalizeName(input.name);
		await this.assertUniqueName(name, scope);
		return this.create({
			...scope,
			name,
			description: input.description?.trim() || undefined,
			displayOrder: input.displayOrder,
			isActive: true,
			isArchived: false,
			createdByUserId: RequestContext.currentUser()?.id
		});
	}

	async updateCategory(id: ID, input: UpdateAutomotiveJobCategoryDTO): Promise<AutomotiveJobCategory> {
		const scope = this.scope();
		const category = await this.findOneScoped(id);
		if (input.name !== undefined) {
			category.name = this.normalizeName(input.name);
			await this.assertUniqueName(category.name, scope, id);
		}
		if (input.description !== undefined) category.description = input.description.trim() || undefined;
		if (input.displayOrder !== undefined) category.displayOrder = input.displayOrder;
		if (input.isActive !== undefined) {
			category.isActive = input.isActive;
			category.isArchived = !input.isActive;
			category.archivedAt = input.isActive ? null : new Date();
		}
		category.updatedByUserId = RequestContext.currentUser()?.id;
		return this.save(category);
	}

	async archive(id: ID): Promise<AutomotiveJobCategory> {
		return this.updateCategory(id, { isActive: false });
	}

	async remove(id: ID): Promise<void> {
		const scope = this.scope();
		const category = await this.findOneScoped(id);
		const references = await this.jobs.count({ where: { categoryId: id, ...scope } });
		if (references) throw new ConflictException('A category referenced by automotive jobs cannot be deleted.');
		await this.delete({ id: category.id, ...scope });
	}

	private async assertUniqueName(name: string, scope: { tenantId: ID; organizationId: ID }, excludeId?: ID) {
		const matches = await this.find({ where: scope });
		const duplicate = matches.some(
			(category) =>
				category.id !== excludeId && category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
		);
		if (duplicate) throw new ConflictException('An automotive job category with this name already exists.');
	}

	private normalizeName(name: string): string {
		const normalized = name?.trim();
		if (!normalized) throw new BadRequestException('Category name is required.');
		return normalized;
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
