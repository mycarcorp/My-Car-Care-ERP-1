import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ID } from '@gauzy/contracts';
import { Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationVendor } from '../organization-vendor/organization-vendor.entity';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { AutomotivePartVendor } from './automotive-part-vendor.entity';
import { CreateAutomotivePartVendorDTO, UpdateAutomotivePartVendorDTO } from './dto';
import { MikroOrmAutomotivePartVendorRepository } from './repository/mikro-orm-automotive-part-vendor.repository';
import { TypeOrmAutomotivePartVendorRepository } from './repository/type-orm-automotive-part-vendor.repository';

@Injectable()
export class AutomotivePartVendorService extends TenantAwareCrudService<AutomotivePartVendor> {
	constructor(
		typeOrmRepository: TypeOrmAutomotivePartVendorRepository,
		mikroOrmRepository: MikroOrmAutomotivePartVendorRepository,
		@InjectRepository(AutomotivePartProfile) private readonly profiles: Repository<AutomotivePartProfile>,
		@InjectRepository(OrganizationVendor) private readonly vendors: Repository<OrganizationVendor>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async createForPart(profileId: ID, input: CreateAutomotivePartVendorDTO): Promise<AutomotivePartVendor> {
		const profile = await this.findProfile(profileId);
		await this.vendors.findOneByOrFail({
			id: input.organizationVendorId,
			tenantId: profile.tenantId,
			organizationId: profile.organizationId
		});
		const duplicate = await this.typeOrmRepository.findOneBy({
			automotivePartProfileId: profile.id,
			organizationVendorId: input.organizationVendorId
		});
		if (duplicate) throw new ConflictException('This vendor is already attached to the automotive part.');
		return super.create({ ...input, automotivePartProfileId: profile.id, organizationId: profile.organizationId });
	}

	async findForPart(profileId: ID): Promise<AutomotivePartVendor[]> {
		const profile = await this.findProfile(profileId);
		return this.typeOrmRepository.find({
			where: {
				automotivePartProfileId: profile.id,
				tenantId: profile.tenantId,
				organizationId: profile.organizationId
			}
		});
	}

	async updateVendor(id: ID, input: UpdateAutomotivePartVendorDTO): Promise<AutomotivePartVendor> {
		const vendor = await this.findScopedVendor(id);
		await super.update(id, input);
		return this.typeOrmRepository.findOneByOrFail({
			id,
			tenantId: vendor.tenantId,
			organizationId: vendor.organizationId
		});
	}

	async removeVendor(id: ID): Promise<void> {
		const vendor = await this.findScopedVendor(id);
		const result = await this.typeOrmRepository.softDelete({
			id: vendor.id,
			tenantId: vendor.tenantId,
			organizationId: vendor.organizationId
		});
		if (!result.affected) throw new NotFoundException('Automotive part vendor was not found.');
	}

	private async findProfile(id: ID): Promise<AutomotivePartProfile> {
		const { tenantId, organizationId } = this.currentScope();
		return this.profiles.findOneByOrFail({
			id,
			tenantId,
			organizationId
		});
	}

	private async findScopedVendor(id: ID): Promise<AutomotivePartVendor> {
		const { tenantId, organizationId } = this.currentScope();
		return this.typeOrmRepository.findOneByOrFail({ id, tenantId, organizationId });
	}

	private currentScope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
