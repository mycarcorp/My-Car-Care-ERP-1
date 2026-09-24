import { BadRequestException, Injectable } from '@nestjs/common';
import { IInspectionCreateInput, InspectionStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { MikroOrmInspectionFindingRepository } from './repository/mikro-orm-inspection-finding.repository';
import { MikroOrmInspectionRepository } from './repository/mikro-orm-inspection.repository';
import { TypeOrmInspectionFindingRepository } from './repository/type-orm-inspection-finding.repository';
import { TypeOrmInspectionRepository } from './repository/type-orm-inspection.repository';
import { Inspection } from './inspection.entity';

@Injectable()
export class InspectionService extends TenantAwareCrudService<Inspection> {
	constructor(
		typeOrmInspectionRepository: TypeOrmInspectionRepository,
		mikroOrmInspectionRepository: MikroOrmInspectionRepository,
		private readonly typeOrmFindingRepository: TypeOrmInspectionFindingRepository,
		private readonly mikroOrmFindingRepository: MikroOrmInspectionFindingRepository,
		private readonly repairOrderService: RepairOrderService,
		private readonly vehicleService: VehicleService,
		private readonly employeeService: EmployeeService
	) {
		super(typeOrmInspectionRepository, mikroOrmInspectionRepository);
	}

	async createInspection(input: IInspectionCreateInput): Promise<Inspection> {
		const [repairOrder, vehicle, technician] = await Promise.all([
			this.repairOrderService.findOneByIdString(input.repairOrderId),
			this.vehicleService.findOneByIdString(input.vehicleId),
			this.employeeService.findOneByIdString(input.technicianEmployeeId)
		]);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? repairOrder.organizationId;
		if (
			repairOrder.vehicleId !== vehicle.id ||
			(tenantId &&
				(repairOrder.tenantId !== tenantId ||
					vehicle.tenantId !== tenantId ||
					technician.tenantId !== tenantId)) ||
			(organizationId &&
				(repairOrder.organizationId !== organizationId ||
					vehicle.organizationId !== organizationId ||
					technician.organizationId !== organizationId))
		)
			throw new BadRequestException(
				'Inspection repair order, vehicle, and technician must share the current tenant and organization.'
			);

		const inspection = await super.create({
			repairOrderId: repairOrder.id,
			vehicleId: vehicle.id,
			technicianEmployeeId: technician.id,
			inspectedAt: new Date(),
			status: input.status ?? InspectionStatusEnum.DRAFT,
			organizationId: repairOrder.organizationId
		});
		for (const finding of input.findings ?? []) {
			await this.typeOrmFindingRepository.save(
				this.typeOrmFindingRepository.create({
					...finding,
					inspectionId: inspection.id,
					tenantId: inspection.tenantId,
					organizationId: inspection.organizationId
				})
			);
		}
		return inspection;
	}
}
