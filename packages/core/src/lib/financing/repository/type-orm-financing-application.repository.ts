import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinancingApplication } from '../financing-application.entity';

@Injectable()
export class TypeOrmFinancingApplicationRepository extends Repository<FinancingApplication> {
	constructor(@InjectRepository(FinancingApplication) repository: Repository<FinancingApplication>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
