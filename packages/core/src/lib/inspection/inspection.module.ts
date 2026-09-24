import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { RepairOrderModule } from '../repair-order/repair-order.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { InspectionController } from './inspection.controller';
import { InspectionFinding } from './inspection-finding.entity';
import { Inspection } from './inspection.entity';
import { MikroOrmInspectionFindingRepository } from './repository/mikro-orm-inspection-finding.repository';
import { MikroOrmInspectionRepository } from './repository/mikro-orm-inspection.repository';
import { TypeOrmInspectionFindingRepository } from './repository/type-orm-inspection-finding.repository';
import { TypeOrmInspectionRepository } from './repository/type-orm-inspection.repository';
import { InspectionService } from './inspection.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Inspection, InspectionFinding]),
		MikroOrmModule.forFeature([Inspection, InspectionFinding]),
		RepairOrderModule,
		VehicleModule,
		EmployeeModule,
		RolePermissionModule
	],
	controllers: [InspectionController],
	providers: [
		InspectionService,
		TypeOrmInspectionRepository,
		MikroOrmInspectionRepository,
		TypeOrmInspectionFindingRepository,
		MikroOrmInspectionFindingRepository
	],
	exports: [InspectionService]
})
export class InspectionModule {}
