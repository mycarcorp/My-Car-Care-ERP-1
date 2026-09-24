import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionFinding } from '../inspection-finding.entity';
@Injectable()
export class TypeOrmInspectionFindingRepository extends Repository<InspectionFinding> {
	constructor(@InjectRepository(InspectionFinding) repository: Repository<InspectionFinding>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
