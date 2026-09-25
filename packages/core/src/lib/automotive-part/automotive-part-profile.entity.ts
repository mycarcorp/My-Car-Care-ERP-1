import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { IAutomotivePartProfile, ID } from '@gauzy/contracts';
import { ProductVariant, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from '../core/decorators/entity';
import { MikroOrmAutomotivePartProfileRepository } from './repository/mikro-orm-automotive-part-profile.repository';

@ColumnIndex('IDX_automotive_part_profile_variant_unique', ['productVariantId'], { unique: true })
@ColumnIndex('IDX_automotive_part_profile_number_unique', ['tenantId', 'organizationId', 'normalizedPartNumber'], {
	unique: true
})
@MultiORMEntity('automotive_part_profile', { mikroOrmRepository: () => MikroOrmAutomotivePartProfileRepository })
export class AutomotivePartProfile extends TenantOrganizationBaseEntity implements IAutomotivePartProfile {
	@MultiORMOneToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT', owner: true })
	@JoinColumn()
	productVariant?: ProductVariant;

	@IsUUID()
	@RelationId((it: AutomotivePartProfile) => it.productVariant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	productVariantId: ID;

	@IsString() @ColumnIndex() @MultiORMColumn() normalizedPartNumber: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) manufacturer?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) oemPartNumber?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) aftermarketPartNumber?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) barcode?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) internalNotes?: string;
	@IsBoolean() @MultiORMColumn({ default: true }) enabled: boolean;
}
