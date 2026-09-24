import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosticFinding } from '../diagnostic-finding.entity';
@Injectable()
export class TypeOrmDiagnosticFindingRepository extends Repository<DiagnosticFinding> {
	constructor(@InjectRepository(DiagnosticFinding) repo: Repository<DiagnosticFinding>) {
		super(repo.target, repo.manager, repo.queryRunner);
	}
}
