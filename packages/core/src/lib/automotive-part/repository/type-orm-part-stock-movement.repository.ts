import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartStockMovement } from '../part-stock-movement.entity';
@Injectable()
export class TypeOrmPartStockMovementRepository extends Repository<PartStockMovement> {
	constructor(@InjectRepository(PartStockMovement) repository: Repository<PartStockMovement>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
