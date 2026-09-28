import { ConflictException, NotFoundException } from '@nestjs/common';
import '../core/entities/internal';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { RequestContext } from '../core/context';
import { AutomotiveJobCategoryService } from './automotive-job-category.service';

const scope = { tenantId: 'tenant-1', organizationId: 'organization-1' };

describe('AutomotiveJobCategoryService', () => {
	let service: AutomotiveJobCategoryService;
	let categories: any;
	let jobs: any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(scope.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(scope.organizationId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		categories = {
			create: jest.fn((input) => input),
			save: jest.fn(async (input) => ({ id: 'category-1', ...input })),
			findAndCount: jest.fn(async () => [[], 0]),
			find: jest.fn(async () => []),
			findOneBy: jest.fn(async () => ({ id: 'category-1', ...scope, name: 'Brakes', isActive: true })),
			delete: jest.fn(async () => ({ affected: 1 }))
		};
		jobs = { count: jest.fn(async () => 0) };
		service = new AutomotiveJobCategoryService(categories as never, {} as never, jobs as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a category using authenticated tenant and organization scope', async () => {
		await expect(service.createCategory({ name: ' Brakes ' })).resolves.toMatchObject({
			name: 'Brakes',
			...scope,
			isActive: true
		});
		expect(categories.create).toHaveBeenCalledWith(expect.objectContaining(scope));
	});

	it('lists categories in stable order and scopes the query', async () => {
		await service.list({ activeOnly: true, page: 2, limit: 10 });
		expect(categories.findAndCount).toHaveBeenCalledWith({
			where: { ...scope, isActive: true, isArchived: false },
			order: { displayOrder: 'ASC', name: 'ASC' },
			skip: 10,
			take: 10
		});
	});

	it('gets a category only inside current tenant and organization', async () => {
		await service.findOneScoped('category-1');
		expect(categories.findOneBy).toHaveBeenCalledWith({ id: 'category-1', ...scope });
		categories.findOneBy.mockResolvedValueOnce(null);
		await expect(service.findOneScoped('foreign-category')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('updates fields and active/archive state in scope', async () => {
		await service.updateCategory('category-1', { name: 'Electrical', displayOrder: 4, isActive: false });
		expect(categories.save).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Electrical', displayOrder: 4, isActive: false, isArchived: true })
		);
	});

	it('archives a category without deleting historical references', async () => {
		await service.archive('category-1');
		expect(categories.delete).not.toHaveBeenCalled();
		expect(categories.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, isArchived: true }));
	});

	it('rejects case-insensitive duplicate names in the same scope', async () => {
		categories.find.mockResolvedValueOnce([{ id: 'other', name: ' brakes ' }]);
		await expect(service.createCategory({ name: 'BRAKES' })).rejects.toBeInstanceOf(ConflictException);
	});

	it('rejects deletion while automotive jobs reference the category', async () => {
		jobs.count.mockResolvedValueOnce(1);
		await expect(service.remove('category-1')).rejects.toBeInstanceOf(ConflictException);
		expect(categories.delete).not.toHaveBeenCalled();
	});

	it('deletes an unreferenced category only within current scope', async () => {
		await service.remove('category-1');
		expect(categories.delete).toHaveBeenCalledWith({ id: 'category-1', ...scope });
	});
});
