import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerWorkApprovalRequest } from '../customer-work-approval-request.entity';
@Injectable()
export class TypeOrmCustomerWorkApprovalRequestRepository extends Repository<CustomerWorkApprovalRequest> {
	constructor(@InjectRepository(CustomerWorkApprovalRequest) r: Repository<CustomerWorkApprovalRequest>) {
		super(r.target, r.manager, r.queryRunner);
	}
}
