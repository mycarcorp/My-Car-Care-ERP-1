import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseReceipt } from '../purchase-receipt.entity';
@Injectable()
export class TypeOrmPurchaseReceiptRepository extends Repository<PurchaseReceipt> {
	constructor(@InjectRepository(PurchaseReceipt) repository: Repository<PurchaseReceipt>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
