import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnostic } from '../diagnostic.entity';
@Injectable()
export class TypeOrmDiagnosticRepository extends Repository<Diagnostic> {
	constructor(@InjectRepository(Diagnostic) repo: Repository<Diagnostic>) {
		super(repo.target, repo.manager, repo.queryRunner);
	}
}
