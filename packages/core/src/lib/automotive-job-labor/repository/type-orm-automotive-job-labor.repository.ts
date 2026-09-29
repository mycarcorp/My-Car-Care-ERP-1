import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomotiveJobLabor } from '../automotive-job-labor.entity';

@Injectable()
export class TypeOrmAutomotiveJobLaborRepository extends Repository<AutomotiveJobLabor> {
	constructor(@InjectRepository(AutomotiveJobLabor) repository: Repository<AutomotiveJobLabor>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
