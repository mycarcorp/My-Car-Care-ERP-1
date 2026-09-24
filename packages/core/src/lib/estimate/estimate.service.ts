import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ID, IEstimateCreateInput, IEstimateLineInput, EstimateStatusEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RepairOrderService } from '../repair-order/repair-order.service';
import { InspectionService } from '../inspection/inspection.service';
import { DiagnosticService } from '../diagnostic/diagnostic.service';
import { RequestContext } from '../core/context';
import { Estimate } from './estimate.entity';
import { EstimateLine } from './estimate-line.entity';
import { TypeOrmEstimateRepository } from './repository/type-orm-estimate.repository';
import { MikroOrmEstimateRepository } from './repository/mikro-orm-estimate.repository';
import { TypeOrmEstimateLineRepository } from './repository/type-orm-estimate-line.repository';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { CustomerWorkApprovalRequestStatusEnum } from '@gauzy/contracts';
@Injectable()
export class EstimateService extends TenantAwareCrudService<Estimate> {
	constructor(
		t: TypeOrmEstimateRepository,
		m: MikroOrmEstimateRepository,
		private readonly lines: TypeOrmEstimateLineRepository,
		private readonly repairOrders: RepairOrderService,
		private readonly inspections: InspectionService,
		private readonly diagnostics: DiagnosticService,
		@InjectRepository(CustomerWorkApprovalRequest)
		private readonly approvalRequests: Repository<CustomerWorkApprovalRequest>
	) {
		super(t, m);
	}
	async createEstimate(input: IEstimateCreateInput): Promise<Estimate> {
		const ro = await this.repairOrders.findOneByIdString(input.repairOrderId);
		const tenantId = RequestContext.currentTenantId();
		const orgId = RequestContext.currentOrganizationId() ?? ro.organizationId;
		if (
			(tenantId && ro.tenantId !== tenantId) ||
			(orgId && ro.organizationId !== orgId) ||
			ro.customerId !== input.customerId ||
			ro.vehicleId !== input.vehicleId
		)
			throw new BadRequestException(
				'Estimate customer, vehicle, and repair order must share the current service chain.'
			);
		if (input.inspectionId) {
			const inspection = await this.inspections.findOneByIdString(input.inspectionId);
			if (
				inspection.repairOrderId !== ro.id ||
				inspection.tenantId !== ro.tenantId ||
				inspection.organizationId !== ro.organizationId
			) {
				throw new BadRequestException('Estimate inspection must belong to the repair order service chain.');
			}
		}
		if (input.diagnosticId) {
			const diagnostic = await this.diagnostics.findOneByIdString(input.diagnosticId);
			if (
				diagnostic.tenantId !== ro.tenantId ||
				diagnostic.organizationId !== ro.organizationId ||
				(input.inspectionId && diagnostic.inspectionId !== input.inspectionId)
			) {
				throw new BadRequestException('Estimate diagnostic must belong to the inspection service chain.');
			}
		}
		const totals = this.calculate(input.lines);
		const estimate = await super.create({
			repairOrderId: ro.id,
			customerId: ro.customerId,
			vehicleId: ro.vehicleId,
			currency: input.currency,
			inspectionId: input.inspectionId,
			diagnosticId: input.diagnosticId,
			estimateNumber: Date.now(),
			revisionNumber: 1,
			status: EstimateStatusEnum.DRAFT,
			...totals,
			organizationId: ro.organizationId
		});
		await super.update(estimate.id, { rootEstimateId: estimate.id });
		estimate.rootEstimateId = estimate.id;
		await this.lines.save(
			input.lines.map((line, index) =>
				this.lines.create({
					...line,
					estimateId: estimate.id,
					lineNumber: index + 1,
					lineTotal: this.lineTotal(line),
					tenantId: estimate.tenantId,
					organizationId: estimate.organizationId
				})
			)
		);
		return estimate;
	}
	async createRevision(id: ID): Promise<Estimate> {
		const source = await this.findOneByIdString(id);
		const items = await this.lines.find({ where: { estimateId: id } });
		await super.update(id, { status: EstimateStatusEnum.SUPERSEDED });
		const next = await super.create({
			...source,
			id: undefined,
			rootEstimateId: source.rootEstimateId ?? source.id,
			revisionNumber: source.revisionNumber + 1,
			status: EstimateStatusEnum.DRAFT,
			estimateNumber: source.estimateNumber
		});
		await this.lines.save(
			items.map((line) =>
				this.lines.create({
					lineNumber: line.lineNumber,
					description: line.description,
					reason: line.reason,
					priority: line.priority,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					taxAmount: line.taxAmount,
					discountAmount: line.discountAmount,
					lineTotal: line.lineTotal,
					estimateId: next.id,
					tenantId: next.tenantId,
					organizationId: next.organizationId
				})
			)
		);
		await this.approvalRequests.update(
			{
				estimateRootId: source.rootEstimateId ?? source.id,
				status: CustomerWorkApprovalRequestStatusEnum.ACTIVE
			},
			{ status: CustomerWorkApprovalRequestStatusEnum.SUPERSEDED }
		);
		return next;
	}
	async updateEstimate(id: ID, input: { status?: EstimateStatusEnum }) {
		const e = await this.findOneByIdString(id);
		if (e.status !== EstimateStatusEnum.DRAFT)
			throw new BadRequestException('Historical estimates require a new revision.');
		return super.update(id, input);
	}
	async addLine(id: ID, line: IEstimateLineInput) {
		const e = await this.findOneByIdString(id);
		if (e.status !== EstimateStatusEnum.DRAFT)
			throw new BadRequestException('Historical estimates require a new revision.');
		const lines = await this.lines.find({ where: { estimateId: id } });
		const saved = await this.lines.save(
			this.lines.create({
				...line,
				estimateId: id,
				lineNumber: lines.length + 1,
				lineTotal: this.lineTotal(line),
				tenantId: e.tenantId,
				organizationId: e.organizationId
			})
		);
		const all = [...lines, saved];
		await super.update(id, this.calculate(all));
		return saved;
	}
	async updateLine(id: ID, line: IEstimateLineInput) {
		const existing = await this.lines.findOneByOrFail({ id });
		const estimate = await this.findOneByIdString(existing.estimateId);
		if (estimate.status !== EstimateStatusEnum.DRAFT)
			throw new BadRequestException('Historical estimates require a new revision.');
		const saved = await this.lines.save({ ...existing, ...line, lineTotal: this.lineTotal(line) });
		const all = await this.lines.find({ where: { estimateId: estimate.id } });
		await super.update(estimate.id, this.calculate(all));
		return saved;
	}
	private lineTotal(line: IEstimateLineInput) {
		return Number(
			(
				Number(line.quantity) * Number(line.unitPrice) -
				Number(line.discountAmount ?? 0) +
				Number(line.taxAmount)
			).toFixed(2)
		);
	}
	private calculate(lines: Array<IEstimateLineInput | EstimateLine>) {
		if (!lines?.length) throw new BadRequestException('Estimate requires at least one line.');
		const subtotal = lines.reduce((n, l) => n + Number(l.quantity) * Number(l.unitPrice), 0);
		const taxTotal = lines.reduce((n, l) => n + Number(l.taxAmount), 0);
		const discountTotal = lines.reduce((n, l) => n + Number(l.discountAmount ?? 0), 0);
		return {
			subtotal: +subtotal.toFixed(2),
			taxTotal: +taxTotal.toFixed(2),
			discountTotal: +discountTotal.toFixed(2),
			total: +(subtotal - taxTotal * 0 - discountTotal + taxTotal).toFixed(2)
		};
	}
}
