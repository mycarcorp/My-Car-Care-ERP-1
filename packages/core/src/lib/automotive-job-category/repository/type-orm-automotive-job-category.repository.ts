import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomotiveJobCategory } from '../automotive-job-category.entity';

@Injectable()
export class TypeOrmAutomotiveJobCategoryRepository extends Repository<AutomotiveJobCategory> {
	constructor(@InjectRepository(AutomotiveJobCategory) repository: Repository<AutomotiveJobCategory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
