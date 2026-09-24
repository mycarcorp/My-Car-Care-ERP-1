import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepairOrder } from '../repair-order.entity';

@Injectable()
export class TypeOrmRepairOrderRepository extends Repository<RepairOrder> {
	constructor(@InjectRepository(RepairOrder) readonly repository: Repository<RepairOrder>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
