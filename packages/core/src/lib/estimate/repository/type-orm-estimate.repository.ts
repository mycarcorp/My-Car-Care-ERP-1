import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estimate } from '../estimate.entity';
@Injectable()
export class TypeOrmEstimateRepository extends Repository<Estimate> {
	constructor(@InjectRepository(Estimate) r: Repository<Estimate>) {
		super(r.target, r.manager, r.queryRunner);
	}
}
