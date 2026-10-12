/**
 * My Car Care "Service History" — a derived, read-only projection over existing
 * repair order, job, labor, part-consumption, QC-attempt and invoice records.
 * There is intentionally NO persistent service-history entity/table: every record
 * is assembled live from the source tables on each request and nothing is ever
 * written (no create/update/delete anywhere in this service).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
	ID,
	IServiceHistoryInvoiceSummary,
	IServiceHistoryPartItem,
	IServiceHistoryRecord,
	PartStockMovementTypeEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { AutomotiveJobQcAttempt } from '../automotive-job-qc/automotive-job-qc-attempt.entity';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { PartStockMovement } from '../automotive-part/part-stock-movement.entity';
import { Invoice } from '../invoice/invoice.entity';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { RepairOrder } from './repair-order.entity';

@Injectable()
export class ServiceHistoryService {
	constructor(
		@InjectRepository(RepairOrder) private readonly repairOrders: Repository<RepairOrder>,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(AutomotiveJobLabor) private readonly labors: Repository<AutomotiveJobLabor>,
		@InjectRepository(PartStockMovement) private readonly movements: Repository<PartStockMovement>,
		@InjectRepository(AutomotiveJobQcAttempt) private readonly qcAttempts: Repository<AutomotiveJobQcAttempt>,
		@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
		@InjectRepository(AutomotivePartProfile) private readonly partProfiles: Repository<AutomotivePartProfile>,
		private readonly vehicleService: VehicleService,
		private readonly organizationContactService: OrganizationContactService
	) {}

	/**
	 * Builds the service history record for one repair order scoped to the current
	 * tenant/organization; a missing or foreign repair order surfaces as not found.
	 */
	async getRepairOrderHistory(repairOrderId: ID): Promise<IServiceHistoryRecord> {
		const scope = this.scope();
		const repairOrder = await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });
		return this.buildRecord(repairOrder, scope);
	}

	/**
	 * Returns the service history (excluding cancelled repair orders) for one
	 * vehicle, newest arrival first. The vehicle must exist in the current scope.
	 */
	async getVehicleServiceHistory(vehicleId: ID): Promise<IServiceHistoryRecord[]> {
		const scope = this.scope();
		const vehicle = await this.vehicleService.findOneByIdString(vehicleId);
		if (vehicle.tenantId !== scope.tenantId || vehicle.organizationId !== scope.organizationId) {
			throw new NotFoundException('Vehicle not found in this organization.');
		}
		const repairOrders = await this.repairOrders.find({
			where: { vehicleId, status: Not(RepairOrderStatusEnum.CANCELLED), ...scope },
			order: { arrivedAt: 'DESC' }
		});
		return Promise.all(repairOrders.map((repairOrder) => this.buildRecord(repairOrder, scope)));
	}

	/**
	 * Returns the service history (excluding cancelled repair orders) for one
	 * customer contact, newest arrival first. The contact must exist in scope.
	 */
	async getContactServiceHistory(contactId: ID): Promise<IServiceHistoryRecord[]> {
		const scope = this.scope();
		const contact = await this.organizationContactService.findOneByIdString(contactId);
		if (contact.tenantId !== scope.tenantId || contact.organizationId !== scope.organizationId) {
			throw new NotFoundException('Contact not found in this organization.');
		}
		const repairOrders = await this.repairOrders.find({
			where: { customerId: contactId, status: Not(RepairOrderStatusEnum.CANCELLED), ...scope },
			order: { arrivedAt: 'DESC' }
		});
		return Promise.all(repairOrders.map((repairOrder) => this.buildRecord(repairOrder, scope)));
	}

	/**
	 * Assembles one history record from the source records of a repair order.
	 * All values are read live from the source tables; nothing is computed into
	 * a stored copy. Only the part profile relation is eagerly loaded.
	 */
	private async buildRecord(
		repairOrder: RepairOrder,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<IServiceHistoryRecord> {
		const jobs = await this.jobs.find({ where: { repairOrderId: repairOrder.id, ...scope } });
		const jobIds = jobs.map((job) => job.id);

		const laborRows = jobIds.length
			? await this.labors.find({ where: { automotiveJobId: In(jobIds), ...scope } })
			: [];
		const consumedParts = await this.movements.find({
			where: {
				repairOrderId: repairOrder.id,
				type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
				...scope
			},
			relations: { automotivePartProfile: true }
		});
		const qcAttempts = jobIds.length
			? await this.qcAttempts.find({
					where: { automotiveJobId: In(jobIds), ...scope },
					order: { createdAt: 'DESC' }
				})
			: [];
		const invoice = await this.invoices.findOne({ where: { repairOrderId: repairOrder.id, ...scope } });

		const partsUsed: IServiceHistoryPartItem[] = [];
		for (const movement of consumedParts) {
			partsUsed.push({
				partMovementId: movement.id,
				description: await this.partDisplayName(movement, scope),
				quantity: Math.abs(Number(movement.quantityDelta)),
				unitCost: movement.unitCost,
				costCurrency: movement.costCurrency
			});
		}

		const latestQcAttempt = qcAttempts[0];
		const invoiceSummary: IServiceHistoryInvoiceSummary | undefined = invoice
			? {
					invoiceId: invoice.id,
					invoiceNumber: invoice.invoiceNumber,
					totalValue: Number(invoice.totalValue),
					amountPaid: Number(invoice.alreadyPaid ?? 0),
					amountDue: Number(invoice.amountDue ?? 0),
					status: invoice.status,
					paid: invoice.paid
				}
			: undefined;

		return {
			repairOrderId: repairOrder.id,
			repairOrderNumber: repairOrder.repairOrderNumber,
			status: repairOrder.status,
			arrivedAt: repairOrder.arrivedAt,
			arrivalOdometer: repairOrder.arrivalOdometer,
			customerId: repairOrder.customerId,
			vehicleId: repairOrder.vehicleId,
			concern: repairOrder.originalConcern,
			workPerformed: jobs.map((job) => ({
				jobId: job.id,
				title: job.title,
				description: job.description,
				status: job.status
			})),
			labor: laborRows.map((labor) => ({
				laborId: labor.id,
				description: labor.description,
				billedHours: labor.billedHours,
				status: labor.status
			})),
			partsUsed,
			qc: {
				totalAttempts: qcAttempts.length,
				latestStatus: latestQcAttempt?.status,
				latestCheckedAt: latestQcAttempt?.checkedAt
			},
			invoice: invoiceSummary
		};
	}

	/**
	 * Resolves the customer-facing part description from the loaded profile
	 * relation (falling back to a scoped profile lookup when the relation was
	 * not loaded): manufacturer + normalizedPartNumber/oemPartNumber, else 'Part'.
	 */
	private async partDisplayName(
		movement: PartStockMovement,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<string> {
		const profile =
			movement.automotivePartProfile ??
			(await this.partProfiles.findOneBy({ id: movement.automotivePartProfileId, ...scope }));
		if (!profile) {
			return 'Part';
		}
		const partNumber = profile.normalizedPartNumber || profile.oemPartNumber;
		return [profile.manufacturer, partNumber].filter(Boolean).join(' ') || 'Part';
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
