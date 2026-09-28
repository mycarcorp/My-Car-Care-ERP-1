import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IAutomotiveJobCategory extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description?: string;
	displayOrder?: number;
}

export interface IAutomotiveJobCategoryCreateInput {
	name: string;
	description?: string;
	displayOrder?: number;
}

export interface IAutomotiveJobCategoryUpdateInput {
	name?: string;
	description?: string;
	displayOrder?: number;
	isActive?: boolean;
}

export interface IAutomotiveJobCategoryListInput {
	page?: number;
	limit?: number;
	activeOnly?: boolean;
}
