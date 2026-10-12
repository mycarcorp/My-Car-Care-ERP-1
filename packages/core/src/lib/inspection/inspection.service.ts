import { BadRequestException, Injectable } from '@nestjs/common';
import { ID, IInspectionCreateInput, InspectionStatusEnum } from '@gauzy/contracts';
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

	/**
	 * Finds a single inspection by id within the current tenant scope, including its findings.
	 *
	 * @param id - The inspection id.
	 * @returns The inspection with its findings.
	 */
	async findByIdWithFindings(id: ID): Promise<Inspection> {
		return await this.findOneByIdString(id, { relations: ['findings'] } as any);
	}

	/**
	 * Finds the inspection for a repair order within the current tenant scope, including its findings.
	 * The repair order is resolved first so an out-of-scope repair order surfaces its own
	 * not-found behavior rather than leaking an inspection. A repair order with no inspection
	 * yields the repository's standard not-found result.
	 *
	 * @param repairOrderId - The repair order id.
	 * @returns The inspection with its findings.
	 */
	async findByRepairOrderWithFindings(repairOrderId: ID): Promise<Inspection> {
		await this.repairOrderService.findOneByIdString(repairOrderId);
		return await this.findOneByOptions({
			where: { repairOrderId },
			relations: ['findings']
		} as any);
	}

	/**
	 * Starts an inspection: DRAFT → IN_PROGRESS. Any other current status is rejected.
	 */
	async start(id: ID): Promise<Inspection> {
		return await this.transitionStatus(id, InspectionStatusEnum.DRAFT, InspectionStatusEnum.IN_PROGRESS);
	}

	/**
	 * Completes an inspection: IN_PROGRESS → COMPLETED. Any other current status is rejected.
	 * COMPLETED is terminal — no lifecycle path changes it again.
	 */
	async complete(id: ID): Promise<Inspection> {
		return await this.transitionStatus(id, InspectionStatusEnum.IN_PROGRESS, InspectionStatusEnum.COMPLETED);
	}

	/**
	 * Applies a single-status lifecycle transition with tenant/org-safe lookup. Only the
	 * declared `from → to` transition is permitted; findings and the repair order are untouched.
	 */
	private async transitionStatus(id: ID, from: InspectionStatusEnum, to: InspectionStatusEnum): Promise<Inspection> {
		const inspection = await this.findOneByIdString(id);
		if (inspection.status !== from) {
			throw new BadRequestException(`Cannot move an inspection from ${inspection.status} to ${to}.`);
		}
		inspection.status = to;
		return await this.typeOrmRepository.save(inspection);
	}
}
