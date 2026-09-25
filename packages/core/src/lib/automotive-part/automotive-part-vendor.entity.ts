import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { IAutomotivePartVendor, ID } from '@gauzy/contracts';
import { OrganizationVendor, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { MikroOrmAutomotivePartVendorRepository } from './repository/mikro-orm-automotive-part-vendor.repository';

@ColumnIndex('IDX_automotive_part_vendor_unique', ['automotivePartProfileId', 'organizationVendorId'], { unique: true })
@MultiORMEntity('automotive_part_vendor', { mikroOrmRepository: () => MikroOrmAutomotivePartVendorRepository })
export class AutomotivePartVendor extends TenantOrganizationBaseEntity implements IAutomotivePartVendor {
	@MultiORMManyToOne(() => AutomotivePartProfile, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	automotivePartProfile?: AutomotivePartProfile;

	@IsUUID()
	@RelationId((it: AutomotivePartVendor) => it.automotivePartProfile)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	automotivePartProfileId: ID;

	@MultiORMManyToOne(() => OrganizationVendor, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	organizationVendor?: OrganizationVendor;

	@IsUUID()
	@RelationId((it: AutomotivePartVendor) => it.organizationVendor)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationVendorId: ID;

	@IsOptional() @IsString() @MultiORMColumn({ nullable: true }) supplierPartNumber?: string;
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe(2) })
	supplierCost?: number;
	@IsOptional() @IsNumber() @Min(0) @MultiORMColumn({ nullable: true, type: 'int' }) leadTimeDays?: number;
	@IsBoolean() @MultiORMColumn({ default: false }) preferred: boolean;
	@IsBoolean() @MultiORMColumn({ default: true }) active: boolean;
}
