import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { AutomotiveJobQcAttempt } from '../automotive-job-qc/automotive-job-qc-attempt.entity';
import { AutomotiveJobQcModule } from '../automotive-job-qc/automotive-job-qc.module';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { PartStockMovement } from '../automotive-part/part-stock-movement.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceModule } from '../invoice/invoice.module';
import { InvoiceItemModule } from '../invoice-item/invoice-item.module';
import { TimeLog } from '../time-tracking/time-log/time-log.entity';
import { EmployeeAppointmentModule } from '../employee-appointment/employee-appointment.module';
import { OrganizationContactModule } from '../organization-contact/organization-contact.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { RepairOrderController } from './repair-order.controller';
import { RepairOrder } from './repair-order.entity';
import { MikroOrmRepairOrderRepository } from './repository/mikro-orm-repair-order.repository';
import { TypeOrmRepairOrderRepository } from './repository/type-orm-repair-order.repository';
import { RepairOrderInvoiceService } from './repair-order-invoice.service';
import { RepairOrderService } from './repair-order.service';
import { ServiceHistoryService } from './service-history.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			RepairOrder,
			AutomotiveJob,
			AutomotiveJobLabor,
			AutomotiveJobQcAttempt,
			TimeLog,
			EstimateLine,
			PartStockMovement,
			AutomotivePartProfile,
			Invoice
		]),
		MikroOrmModule.forFeature([
			RepairOrder,
			AutomotiveJob,
			AutomotiveJobLabor,
			AutomotiveJobQcAttempt,
			TimeLog,
			EstimateLine,
			PartStockMovement,
			AutomotivePartProfile,
			Invoice
		]),
		EmployeeAppointmentModule,
		OrganizationContactModule,
		VehicleModule,
		RolePermissionModule,
		InvoiceModule,
		InvoiceItemModule,
		forwardRef(() => AutomotiveJobQcModule)
	],
	controllers: [RepairOrderController],
	providers: [
		RepairOrderService,
		RepairOrderInvoiceService,
		ServiceHistoryService,
		TypeOrmRepairOrderRepository,
		MikroOrmRepairOrderRepository
	],
	exports: [
		RepairOrderService,
		RepairOrderInvoiceService,
		ServiceHistoryService,
		TypeOrmRepairOrderRepository,
		MikroOrmRepairOrderRepository
	]
})
export class RepairOrderModule {}
