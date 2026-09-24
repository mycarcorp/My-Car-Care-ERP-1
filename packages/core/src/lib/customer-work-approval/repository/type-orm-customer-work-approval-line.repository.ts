import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerWorkApprovalLine } from '../customer-work-approval-line.entity';
@Injectable()
export class TypeOrmCustomerWorkApprovalLineRepository extends Repository<CustomerWorkApprovalLine> {
	constructor(@InjectRepository(CustomerWorkApprovalLine) r: Repository<CustomerWorkApprovalLine>) {
		super(r.target, r.manager, r.queryRunner);
	}
}
