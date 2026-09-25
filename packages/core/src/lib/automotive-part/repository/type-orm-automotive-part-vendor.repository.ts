import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomotivePartVendor } from '../automotive-part-vendor.entity';
@Injectable()
export class TypeOrmAutomotivePartVendorRepository extends Repository<AutomotivePartVendor> {
	constructor(@InjectRepository(AutomotivePartVendor) repository: Repository<AutomotivePartVendor>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
