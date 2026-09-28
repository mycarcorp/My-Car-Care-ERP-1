import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomotiveJob } from '../automotive-job.entity';
@Injectable()
export class TypeOrmAutomotiveJobRepository extends Repository<AutomotiveJob> {
	constructor(@InjectRepository(AutomotiveJob) repository: Repository<AutomotiveJob>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
