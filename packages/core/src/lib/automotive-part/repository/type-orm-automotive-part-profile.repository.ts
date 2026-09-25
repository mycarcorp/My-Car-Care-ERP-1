import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomotivePartProfile } from '../automotive-part-profile.entity';
@Injectable()
export class TypeOrmAutomotivePartProfileRepository extends Repository<AutomotivePartProfile> {
	constructor(@InjectRepository(AutomotivePartProfile) repository: Repository<AutomotivePartProfile>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
