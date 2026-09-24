import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from '../inspection.entity';

@Injectable()
export class TypeOrmInspectionRepository extends Repository<Inspection> {
	constructor(@InjectRepository(Inspection) repository: Repository<Inspection>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
