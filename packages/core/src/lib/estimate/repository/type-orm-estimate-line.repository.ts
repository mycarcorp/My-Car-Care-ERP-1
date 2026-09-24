import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstimateLine } from '../estimate-line.entity';
@Injectable()
export class TypeOrmEstimateLineRepository extends Repository<EstimateLine> {
	constructor(@InjectRepository(EstimateLine) r: Repository<EstimateLine>) {
		super(r.target, r.manager, r.queryRunner);
	}
}
