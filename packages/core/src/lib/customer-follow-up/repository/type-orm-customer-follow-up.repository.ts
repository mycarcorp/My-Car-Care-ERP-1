import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerFollowUp } from '../customer-follow-up.entity';

@Injectable()
export class TypeOrmCustomerFollowUpRepository extends Repository<CustomerFollowUp> {
	constructor(@InjectRepository(CustomerFollowUp) readonly repository: Repository<CustomerFollowUp>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}