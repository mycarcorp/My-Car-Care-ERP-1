import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EntityManager, FindOptionsWhere, MoreThan } from 'typeorm';
import {
	CustomerWorkApprovalChannelEnum,
	CustomerWorkApprovalRequestStatusEnum,
	CustomerWorkApprovalSubmissionStateEnum,
	ICustomerWorkApprovalSubmitInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { TypeOrmEstimateRepository } from '../estimate/repository/type-orm-estimate.repository';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { TypeOrmEstimateLineRepository } from '../estimate/repository/type-orm-estimate-line.repository';
import { CustomerWorkApprovalRequest } from './customer-work-approval-request.entity';
import { TypeOrmCustomerWorkApprovalRequestRepository } from './repository/type-orm-customer-work-approval-request.repository';
import { CustomerWorkApproval } from './customer-work-approval.entity';
import { TypeOrmCustomerWorkApprovalRepository } from './repository/type-orm-customer-work-approval.repository';
import { MikroOrmCustomerWorkApprovalRepository } from './repository/mikro-orm-customer-work-approval.repository';
import { CustomerWorkApprovalLine } from './customer-work-approval-line.entity';

export interface ISubmissionEvidence {
	ip?: string | null;
	userAgent?: string | null;
	channel: CustomerWorkApprovalChannelEnum;
}

/** Privacy-safe: never store the raw client IP. Undefined when no evidence secret is configured. */
export function hashClientIp(ip?: string | null, salt = process.env.TERMS_IP_SALT): string | undefined {
	if (!ip || !salt) return undefined;
	return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** Deterministic canonical form (sorted keys, stable array order) so the hash never depends on key order. */
function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.keys(value as Record<string, unknown>)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = canonicalize((value as Record<string, unknown>)[key]);
					return acc;
				},
				{} as Record<string, unknown>
			);
	}
	return value;
}

/** SHA-256 over the canonical JSON of exactly what the customer was shown. */
export function hashSnapshot(snapshot: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(snapshot)))
		.digest('hex');
}

@Injectable()
export class CustomerWorkApprovalService extends TenantAwareCrudService<CustomerWorkApproval> {
	constructor(
		typeOrmRepository: TypeOrmCustomerWorkApprovalRepository,
		mikroOrmRepository: MikroOrmCustomerWorkApprovalRepository,
		private readonly requests: TypeOrmCustomerWorkApprovalRequestRepository,
		private readonly estimateRepository: TypeOrmEstimateRepository,
		private readonly estimateLines: TypeOrmEstimateLineRepository
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	/**
	 * Atomically submits a customer's line-level decisions against an ACTIVE, unexpired request
	 * pinned to an exact Estimate revision.
	 *
	 * The whole operation — revalidation, decision checks, total calculation, approval + line
	 * creation, and marking the request SUBMITTED — runs inside one transaction, and the request's
	 * ACTIVE -> SUBMITTED transition is claimed with a single conditional UPDATE (mirroring
	 * `PayrollRunService.process`'s single-writer pattern): whichever concurrent submission affects
	 * the row wins, every other one sees `affected === 0` and is rejected as a duplicate. No partial
	 * approval can ever remain on failure.
	 */
	async submit(
		requestId: ID,
		input: ICustomerWorkApprovalSubmitInput,
		evidence: ISubmissionEvidence
	): Promise<CustomerWorkApproval> {
		const request = await this.loadActiveRequestOrThrow(requestId);

		const estimate = await this.estimateRepository.findOneByOrFail({ id: request.estimateId });
		if (
			(estimate.rootEstimateId ?? estimate.id) !== request.estimateRootId ||
			estimate.revisionNumber !== request.estimateRevisionNumber
		) {
			// The estimate the request pins has moved on to a different revision than the one it was
			// issued for. `EstimateService.createRevision` supersedes the request itself when this
			// happens, so reaching here would mean the request row and the estimate disagree — fail
			// closed rather than authorize against the wrong revision.
			throw new BadRequestException('This approval request no longer matches the current estimate revision.');
		}

		const lines = await this.estimateLines.find({ where: { estimateId: request.estimateId } });
		if (!lines.length) {
			throw new BadRequestException('Estimate has no lines to approve.');
		}

		const decisionsByLineId = new Map(input.decisions.map((d) => [d.estimateLineId, d]));
		if (decisionsByLineId.size !== lines.length || lines.some((line) => !decisionsByLineId.has(line.id))) {
			throw new BadRequestException('Every presented estimate line requires an explicit decision.');
		}

		const lineSnapshots = lines.map((line) => {
			const decision = decisionsByLineId.get(line.id);
			// V1 all-or-nothing: selected -> full quantity, unselected -> zero. No partial quantities.
			const approvedQuantity = decision.selected ? Number(line.quantity) : 0;
			return { line, decision, approvedQuantity };
		});

		const approvedTotal = lineSnapshots.reduce(
			(sum, { line, decision }) => (decision.selected ? sum + Number(line.lineTotal) : sum),
			0
		);

		const estimateSnapshotHash = hashSnapshot({
			estimateId: request.estimateId,
			estimateRevisionNumber: request.estimateRevisionNumber,
			lines: lineSnapshots.map(({ line, decision, approvedQuantity }) => ({
				estimateLineId: line.id,
				selected: decision.selected,
				approvedQuantity,
				description: line.description,
				reason: line.reason,
				priority: line.priority,
				unitPrice: line.unitPrice,
				taxAmount: line.taxAmount,
				discountAmount: line.discountAmount ?? 0,
				lineTotal: line.lineTotal
			}))
		});

		return await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			// Single-use claim: only the request that is STILL ACTIVE (and this exact one) transitions.
			const claimed = await manager.update(
				CustomerWorkApprovalRequest,
				{
					id: requestId,
					status: CustomerWorkApprovalRequestStatusEnum.ACTIVE,
					expiresAt: MoreThan(new Date())
				} as FindOptionsWhere<CustomerWorkApprovalRequest>,
				{ status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED }
			);
			if (!claimed.affected) {
				throw new ConflictException('This approval request has already been submitted.');
			}

			const approval = await manager.save(CustomerWorkApproval, {
				approvalRequestId: request.id,
				customerId: request.customerId,
				vehicleId: request.vehicleId,
				repairOrderId: request.repairOrderId,
				estimateId: request.estimateId,
				estimateRevisionNumber: request.estimateRevisionNumber,
				submittedAt: new Date(),
				approvedTotal: +approvedTotal.toFixed(2),
				currency: estimate.currency,
				submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED,
				estimateSnapshotHash,
				ipHash: hashClientIp(evidence.ip),
				userAgent: evidence.userAgent ?? undefined,
				channel: evidence.channel,
				tenantId: request.tenantId,
				organizationId: request.organizationId
			});

			await manager.save(
				CustomerWorkApprovalLine,
				lineSnapshots.map(({ line, decision, approvedQuantity }) => ({
					customerWorkApprovalId: approval.id,
					estimateLineId: line.id,
					selected: decision.selected,
					approvedQuantity,
					priority: line.priority,
					description: line.description,
					reason: line.reason,
					unitPrice: line.unitPrice,
					taxAmount: line.taxAmount,
					discountAmount: line.discountAmount,
					lineTotal: line.lineTotal,
					tenantId: request.tenantId,
					organizationId: request.organizationId
				}))
			);

			return approval;
		});
	}

	/** Revalidates status/expiry/estimate-revision. Throws for revoked/expired/superseded/submitted. */
	private async loadActiveRequestOrThrow(requestId: ID): Promise<CustomerWorkApprovalRequest> {
		const request = await this.requests.findOneByOrFail({ id: requestId });

		if (request.status === CustomerWorkApprovalRequestStatusEnum.SUBMITTED) {
			throw new ConflictException('This approval request has already been submitted.');
		}
		if (request.status !== CustomerWorkApprovalRequestStatusEnum.ACTIVE) {
			throw new BadRequestException('This approval request is no longer active.');
		}
		if (request.expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException('This approval request has expired.');
		}

		return request;
	}
}
