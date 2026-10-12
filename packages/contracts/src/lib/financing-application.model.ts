import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * Financing application lifecycle.
 *
 * DRAFT → SUBMITTED → PENDING → APPROVED / DECLINED → ACCEPTED / CANCELLED → FUNDED.
 * DECLINED and CANCELLED are terminal. FUNDED is terminal and reached only from ACCEPTED
 * by recording the funding payment against the repair order's invoice (server-side `fund()`),
 * never through the generic transition input.
 */
export enum FinancingApplicationStatusEnum {
	DRAFT = 'DRAFT',
	SUBMITTED = 'SUBMITTED',
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	DECLINED = 'DECLINED',
	ACCEPTED = 'ACCEPTED',
	CANCELLED = 'CANCELLED',
	FUNDED = 'FUNDED'
}

/**
 * Non-null sentinel written to `activeKey` on every active (non-terminal) application. All active
 * applications share this constant, so the composite unique index on (tenantId, repairOrderId,
 * activeKey) rejects a second active application per repair order. Terminal applications use NULL,
 * and NULL markers never collide across SQLite/MySQL/Postgres.
 */
export const FINANCING_ACTIVE_KEY = 'ACTIVE';

export interface IFinancingApplication extends IBasePerTenantAndOrganizationEntityModel {
	customerId: ID;
	vehicleId: ID;
	repairOrderId: ID;
	estimateId: ID;
	customerWorkApprovalId?: ID;
	invoiceId?: ID;
	/** Provider name / configuration reference (resolved via integration settings). Not provider-specific. */
	provider?: string;
	/** External provider's application reference (nullable until a provider is integrated). */
	providerApplicationId?: string;
	requestedAmount: number;
	approvedAmount?: number;
	/** Reserved for later funding phases. */
	fundedAmount?: number;
	currency: string;
	status: FinancingApplicationStatusEnum;
	submittedAt?: Date;
	decidedAt?: Date;
	acceptedAt?: Date;
	/** Reserved for later funding phases. */
	fundedAt?: Date;
	rejectionReason?: string;
	/**
	 * Uniqueness marker: the FINANCING_ACTIVE_KEY sentinel while the application is in an active
	 * (non-terminal) status, NULL once it reaches a terminal state. Enables a portable DB-enforced
	 * "one active application per repair order" invariant via a composite unique index on
	 * (tenantId, repairOrderId, activeKey).
	 */
	activeKey?: string;
}

export interface IFinancingApplicationCreateInput {
	repairOrderId: ID;
	estimateId: ID;
	customerWorkApprovalId: ID;
	provider?: string;
	requestedAmount: number;
	currency: string;
}

export interface IFinancingApplicationUpdateInput {
	provider?: string;
	requestedAmount?: number;
	rejectionReason?: string;
}

/**
 * Controlled lifecycle transition input. `status` is the target status. `approvedAmount` and
 * `rejectionReason` are only meaningful for APPROVED and DECLINED decisions respectively and are
 * ignored for every other target. Clients can never set status timestamps, `activeKey`,
 * `providerApplicationId`, or FUNDED through any input.
 */
export interface IFinancingApplicationTransitionInput {
	status: FinancingApplicationStatusEnum;
	approvedAmount?: number;
	rejectionReason?: string;
}
