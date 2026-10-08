import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeAppointment } from '../employee-appointment/employee-appointment.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { Estimate } from '../estimate/estimate.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobQcAttempt } from '../automotive-job-qc/automotive-job-qc-attempt.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';
import { ServiceCenterDashboardController } from './service-center-dashboard.controller';
import { ServiceCenterDashboardService } from './service-center-dashboard.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EmployeeAppointment,
			RepairOrder,
			Estimate,
			CustomerWorkApprovalRequest,
			AutomotiveJob,
			AutomotiveJobQcAttempt,
			Invoice,
			Payment
		]),
		RolePermissionModule
	],
	controllers: [ServiceCenterDashboardController],
	providers: [ServiceCenterDashboardService],
	exports: [ServiceCenterDashboardService]
})
export class ServiceCenterDashboardModule {}
