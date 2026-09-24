import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeModule } from '../employee/employee.module';
import { InspectionModule } from '../inspection/inspection.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Diagnostic } from './diagnostic.entity';
import { DiagnosticFinding } from './diagnostic-finding.entity';
import { DiagnosticService } from './diagnostic.service';
import { DiagnosticController } from './diagnostic.controller';
import { TypeOrmDiagnosticRepository } from './repository/type-orm-diagnostic.repository';
import { MikroOrmDiagnosticRepository } from './repository/mikro-orm-diagnostic.repository';
import { TypeOrmDiagnosticFindingRepository } from './repository/type-orm-diagnostic-finding.repository';
import { MikroOrmDiagnosticFindingRepository } from './repository/mikro-orm-diagnostic-finding.repository';
@Module({
	imports: [
		TypeOrmModule.forFeature([Diagnostic, DiagnosticFinding]),
		MikroOrmModule.forFeature([Diagnostic, DiagnosticFinding]),
		InspectionModule,
		EmployeeModule,
		RolePermissionModule
	],
	controllers: [DiagnosticController],
	providers: [
		DiagnosticService,
		TypeOrmDiagnosticRepository,
		MikroOrmDiagnosticRepository,
		TypeOrmDiagnosticFindingRepository,
		MikroOrmDiagnosticFindingRepository
	],
	exports: [DiagnosticService]
})
export class DiagnosticModule {}
