import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ID } from '@gauzy/contracts';
import { Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { CreateAutomotivePartDTO, UpdateAutomotivePartDTO } from './dto';
import { MikroOrmAutomotivePartProfileRepository } from './repository/mikro-orm-automotive-part-profile.repository';
import { TypeOrmAutomotivePartProfileRepository } from './repository/type-orm-automotive-part-profile.repository';

export function normalizeAutomotivePartNumber(value: string): string {
	return value?.trim().toUpperCase().replace(/\s+/g, '') ?? '';
}

@Injectable()
export class AutomotivePartService extends TenantAwareCrudService<AutomotivePartProfile> {
	constructor(
		typeOrmRepository: TypeOrmAutomotivePartProfileRepository,
		mikroOrmRepository: MikroOrmAutomotivePartProfileRepository,
		@InjectRepository(ProductVariant) private readonly variants: Repository<ProductVariant>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async createAutomotivePart(input: CreateAutomotivePartDTO): Promise<AutomotivePartProfile> {
		const { tenantId, organizationId } = this.currentScope();
		const normalizedPartNumber = normalizeAutomotivePartNumber(input.normalizedPartNumber);
		if (!normalizedPartNumber) throw new BadRequestException('Automotive part number is required.');
		await this.variants.findOneByOrFail({ id: input.productVariantId, tenantId, organizationId });
		const duplicate = await this.typeOrmRepository.findOneBy({ tenantId, organizationId, normalizedPartNumber });
		if (duplicate) throw new ConflictException('An automotive part with this part number already exists.');
		const existingVariantProfile = await this.typeOrmRepository.findOneBy({
			productVariantId: input.productVariantId
		});
		if (existingVariantProfile)
			throw new ConflictException('This product variant already has an automotive part profile.');
		return super.create({ ...input, normalizedPartNumber, enabled: input.enabled ?? true, organizationId });
	}

	async updateAutomotivePart(id: ID, input: UpdateAutomotivePartDTO): Promise<AutomotivePartProfile> {
		const { tenantId, organizationId } = this.currentScope();
		const profile = await this.typeOrmRepository.findOneByOrFail({ id, tenantId, organizationId });
		const normalizedPartNumber = input.normalizedPartNumber
			? normalizeAutomotivePartNumber(input.normalizedPartNumber)
			: profile.normalizedPartNumber;
		if (!normalizedPartNumber) throw new BadRequestException('Automotive part number is required.');
		if (normalizedPartNumber !== profile.normalizedPartNumber) {
			const duplicate = await this.typeOrmRepository.findOneBy({
				tenantId: profile.tenantId,
				organizationId: profile.organizationId,
				normalizedPartNumber
			});
			if (duplicate && duplicate.id !== profile.id) {
				throw new ConflictException('An automotive part with this part number already exists.');
			}
		}
		await super.update(id, { ...input, normalizedPartNumber });
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
