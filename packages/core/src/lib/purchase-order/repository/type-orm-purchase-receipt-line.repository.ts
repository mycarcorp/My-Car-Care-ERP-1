import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseReceiptLine } from '../purchase-receipt-line.entity';
@Injectable()
export class TypeOrmPurchaseReceiptLineRepository extends Repository<PurchaseReceiptLine> {
	constructor(@InjectRepository(PurchaseReceiptLine) repository: Repository<PurchaseReceiptLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
