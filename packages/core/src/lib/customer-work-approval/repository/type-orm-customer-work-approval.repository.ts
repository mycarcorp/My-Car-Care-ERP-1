import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerWorkApproval } from '../customer-work-approval.entity';
@Injectable()
export class TypeOrmCustomerWorkApprovalRepository extends Repository<CustomerWorkApproval> {
	constructor(@InjectRepository(CustomerWorkApproval) r: Repository<CustomerWorkApproval>) {
		super(r.target, r.manager, r.queryRunner);
	}
}
