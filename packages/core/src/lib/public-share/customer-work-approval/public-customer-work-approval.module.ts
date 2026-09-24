import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	CustomerWorkApproval,
	CustomerWorkApprovalLine,
	CustomerWorkApprovalRequest,
	Estimate,
	EstimateLine
} from '../../core/entities/internal';
import { CustomerWorkApprovalModule } from '../../customer-work-approval/customer-work-approval.module';
import { PublicCustomerWorkApprovalController } from './public-customer-work-approval.controller';
import { PublicCustomerWorkApprovalService } from './public-customer-work-approval.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CustomerWorkApprovalRequest,
			CustomerWorkApproval,
			CustomerWorkApprovalLine,
			Estimate,
			EstimateLine
		]),
		MikroOrmModule.forFeature([
			CustomerWorkApprovalRequest,
			CustomerWorkApproval,
			CustomerWorkApprovalLine,
			Estimate,
			EstimateLine
		]),
		CustomerWorkApprovalModule
	],
	controllers: [PublicCustomerWorkApprovalController],
	providers: [PublicCustomerWorkApprovalService]
})
export class PublicCustomerWorkApprovalModule {}
