/**
 * Generates the customer-facing invoice for a My Car Care repair order.
 *
 * Intended call site: after the repair order becomes READY — invoked via
 * POST /repair-orders/:id/invoice (see RepairOrderController). It is deliberately
 * NOT called from RepairOrderService.evaluateReadiness, so readiness evaluation
 * stays decoupled from invoice transactions.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
	AutomotiveJobLaborStatusEnum,
	AutomotiveJobStatusEnum,
	CurrenciesEnum,
	ID,
	IInvoiceItemCreateInput,
	InvoiceStatusTypesEnum,
	PartStockMovementTypeEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../automotive-job-labor/automotive-job-labor.entity';
import { AutomotivePartProfile } from '../automotive-part/automotive-part-profile.entity';
import { PartStockMovement } from '../automotive-part/part-stock-movement.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { InvoiceService } from '../invoice/invoice.service';
import { RepairOrder } from './repair-order.entity';

@Injectable()
export class RepairOrderInvoiceService {
	constructor(
		@InjectRepository(RepairOrder) private readonly repairOrders: Repository<RepairOrder>,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(AutomotiveJobLabor) private readonly labors: Repository<AutomotiveJobLabor>,
		@InjectRepository(EstimateLine) private readonly estimateLines: Repository<EstimateLine>,
		@InjectRepository(PartStockMovement) private readonly movements: Repository<PartStockMovement>,
		@InjectRepository(AutomotivePartProfile) private readonly partProfiles: Repository<AutomotivePartProfile>,
		private readonly invoiceService: InvoiceService,
		private readonly invoiceItemService: InvoiceItemService
	) {}

	/**
	 * Generates (or returns the existing) DRAFT invoice for a READY/CLOSED repair order.
	 * All pricing is resolved server-side from approved estimate lines (labor) and stored
	 * part consumption costs (parts); invoice-level tax/discount stay 0 for this milestone.
	 */
	async generateForRepairOrder(repairOrderId: ID): Promise<Invoice> {
		const scope = this.scope();
		const repairOrder = await this.repairOrders.findOneByOrFail({ id: repairOrderId, ...scope });

		// Idempotency: never create a second invoice for the same repair order.
		const existing = await this.repairOrders.manager.findOne(Invoice, {
			where: { repairOrderId: repairOrder.id, ...scope },
			relations: { invoiceItems: true }
		});
		if (existing) {
			return existing;
		}

		if (![RepairOrderStatusEnum.READY, RepairOrderStatusEnum.CLOSED].includes(repairOrder.status)) {
			throw new BadRequestException('Repair order is not ready to be invoiced.');
		}

		const jobs = await this.jobs.find({ where: { repairOrderId: repairOrder.id, ...scope } });
		const activeJobs = jobs.filter((job) => job.status !== AutomotiveJobStatusEnum.CANCELLED);
		const laborRows = activeJobs.length
			? await this.labors.find({
					where: {
						automotiveJobId: In(activeJobs.map((job) => job.id)),
						status: AutomotiveJobLaborStatusEnum.COMPLETED,
						...scope
					}
				})
			: [];
		const consumedParts = await this.movements.find({
			where: {
				repairOrderId: repairOrder.id,
				type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
				...scope
			}
		});

		const items: IInvoiceItemCreateInput[] = [];
		const unsupportedAdhocLabor: string[] = [];

		// LABOR: approved labor is priced from its EstimateLine (the customer-approved price),
		// never from Employee.billRateValue.
		for (const labor of laborRows) {
			if (!labor.estimateLineId) {
				unsupportedAdhocLabor.push(labor.description);
				continue;
			}
			const line = await this.estimateLines.findOneByOrFail({ id: labor.estimateLineId, ...scope });
			items.push({
				description: line.description,
				quantity: Number(line.quantity),
				price: Number(line.unitPrice),
				totalValue: Number(line.lineTotal),
				applyTax: false,
				applyDiscount: false,
				...scope
			});
		}
		if (unsupportedAdhocLabor.length) {
			throw new BadRequestException(
				`Ad-hoc labor without an approved estimate line cannot be invoiced yet: ${unsupportedAdhocLabor.join(
					'; '
				)}.`
			);
		}

		// PARTS: consumed parts are priced from the stored consumption unitCost.
		for (const movement of consumedParts) {
			const profile = await this.partProfiles.findOneBy({ id: movement.automotivePartProfileId, ...scope });
			const quantity = Math.abs(Number(movement.quantityDelta));
			const price = Number(movement.unitCost ?? 0);
			items.push({
				description: this.partDisplayName(profile),
				quantity,
				price,
				totalValue: Math.round(quantity * price * 100) / 100,
				applyTax: false,
				applyDiscount: false,
				...scope
			});
		}

		const totalValue = Math.round(items.reduce((sum, item) => sum + Number(item.totalValue), 0) * 100) / 100;
		const currency = consumedParts.find((movement) => movement.costCurrency)?.costCurrency ?? CurrenciesEnum.USD;

		// Single transaction: re-check idempotency before inserting so a concurrent duplicate
		// generation cannot produce two invoices for the same repair order.
		return this.repairOrders.manager.transaction(async (manager) => {
			const duplicate = await manager.findOne(Invoice, {
				where: { repairOrderId: repairOrder.id, ...scope },
				relations: { invoiceItems: true }
			});
			if (duplicate) {
				return duplicate;
			}
			const highest = await this.invoiceService.getHighestInvoiceNumber();
			const now = new Date();
			const invoice = await manager.save(
				Invoice,
				manager.create(Invoice, {
					invoiceNumber: Number((highest as any)?.max ?? 0) + 1,
					invoiceDate: now,
					dueDate: now,
					currency,
					discountValue: 0,
					paid: false,
					tax: 0,
					tax2: 0,
					totalValue,
					status: InvoiceStatusTypesEnum.DRAFT,
					isEstimate: false,
					alreadyPaid: 0,
					amountDue: totalValue,
					toContactId: repairOrder.customerId,
					organizationContactId: repairOrder.customerId,
					fromOrganizationId: scope.organizationId,
					repairOrderId: repairOrder.id,
					...scope
				})
			);
			const invoiceItems = await this.invoiceItemService.createBulk(
				invoice.id,
				items.map((item) => ({ ...item, invoiceId: invoice.id }))
			);
			invoice.invoiceItems = invoiceItems;
			return invoice;
		});
	}

	private partDisplayName(profile: AutomotivePartProfile | null): string {
		if (!profile) {
			return 'Part';
		}
		const partNumber = profile.normalizedPartNumber || profile.oemPartNumber;
		return [profile.manufacturer, partNumber].filter(Boolean).join(' ') || 'Part';
	}

	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}
}
