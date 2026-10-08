import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
	AutomotiveJobQcStatusEnum,
	AutomotiveJobStatusEnum,
	CustomerWorkApprovalRequestStatusEnum,
	EstimateStatusEnum,
	RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeAppointment } from '../employee-appointment/employee-appointment.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { Estimate } from '../estimate/estimate.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { AutomotiveJobQcAttempt } from '../automotive-job-qc/automotive-job-qc-attempt.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';

/**
 * Read-only Service Center Command Center summary.
 *
 * Every metric is derived from existing operational records, scoped to the current
 * tenant/organization via RequestContext. This service performs no create/update/delete —
 * it only counts/aggregates existing rows.
 */
@Injectable()
export class ServiceCenterDashboardService {
	constructor(
		@InjectRepository(EmployeeAppointment) private readonly appointments: Repository<EmployeeAppointment>,
		@InjectRepository(RepairOrder) private readonly repairOrders: Repository<RepairOrder>,
		@InjectRepository(Estimate) private readonly estimates: Repository<Estimate>,
		@InjectRepository(CustomerWorkApprovalRequest) private readonly approvalRequests: Repository<CustomerWorkApprovalRequest>,
		@InjectRepository(AutomotiveJob) private readonly jobs: Repository<AutomotiveJob>,
		@InjectRepository(AutomotiveJobQcAttempt) private readonly qcAttempts: Repository<AutomotiveJobQcAttempt>,
		@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
		@InjectRepository(Payment) private readonly payments: Repository<Payment>
	) {}

	/** Current tenant/org scope for every query. */
	private scope(): { tenantId?: string; organizationId?: string } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	private countWhere(repo: Repository<any>, where: any): Promise<number> {
		return repo.count({ where: { ...this.scope(), ...where } });
	}

	/**
	 * Builds the full Command Center summary. Read-only.
	 */
	async getSummary() {
		const scope = this.scope();
		const { start: dayStart, end: dayEnd } = this.todayRange();

		// --- KPIs / operational counts ---
		const todaysAppointments = await this.countWhere(this.appointments, {
			startDateTime: Between(dayStart, dayEnd) as any
		});
		const scheduledAppointments = await this.countWhere(this.appointments, {});
		const openRepairOrders = await this.countWhere(this.repairOrders, { status: RepairOrderStatusEnum.OPEN });
		const inProgressRepairOrders = await this.countWhere(this.repairOrders, {
			status: RepairOrderStatusEnum.IN_PROGRESS
		});
		// Arrived/checked-in vehicles = ROs that have an arrival timestamp.
		const arrivedCount = await this.arrivedCount();
		const readyForPickup = await this.countWhere(this.repairOrders, { status: RepairOrderStatusEnum.READY });
		const estimatesAwaitingApproval = await this.countWhere(this.estimates, {
			status: In([EstimateStatusEnum.FINALIZED, EstimateStatusEnum.SENT])
		});
		const awaitingCustomerApproval = await this.countWhere(this.approvalRequests, {
			status: CustomerWorkApprovalRequestStatusEnum.ACTIVE
		});
		const jobsInProgress = await this.countWhere(this.jobs, { status: AutomotiveJobStatusEnum.IN_PROGRESS });
		const awaitingQc = await this.awaitingQcCount();

		// --- Financial (authoritative invoice/payment data) ---
		const invoicesGenerated = await this.countWhere(this.invoices, {});
		const outstandingAmount = await this.sumField(this.invoices, 'amountDue');
		const paymentsReceived = await this.countWhere(this.payments, {});
		const revenue = await this.sumField(this.payments, 'amount');

		return {
			generatedAt: new Date(),
			kpis: {
				todaysAppointments,
				scheduledAppointments,
				arrivedVehicles: arrivedCount,
				openRepairOrders,
				inProgressRepairOrders,
				readyForPickup,
				estimatesAwaitingApproval,
				awaitingCustomerApproval,
				jobsInProgress,
				awaitingQc,
				invoicesGenerated,
				outstandingAmount,
				paymentsReceived,
				revenue
			},
			// Metrics that cannot be reliably derived from the current data model are omitted
			// rather than faked. "awaiting parts" has no request/status concept in the parts
			// model, and "overdue" has no reliable target-date field; both are intentionally
			// not reported.
			limitations: ['awaitingParts', 'overdueRepairOrders']
		};
	}

	/** Counts repair orders with an arrival timestamp (checked-in vehicles). */
	private async arrivedCount(): Promise<number> {
		return this.repairOrders
			.createQueryBuilder('ro')
			.where('ro.tenantId = :tenantId', { tenantId: this.scope().tenantId })
			.andWhere('ro.organizationId = :organizationId', { organizationId: this.scope().organizationId })
			.andWhere('ro.arrivedAt IS NOT NULL')
			.getCount();
	}

	/** Jobs that are COMPLETED but have no PASSED QC attempt → awaiting QC. */
	private async awaitingQcCount(): Promise<number> {
		const completedJobs = await this.jobs.find({
			where: { ...this.scope(), status: AutomotiveJobStatusEnum.COMPLETED },
			select: { id: true } as any
		});
		if (!completedJobs.length) {
			return 0;
		}
		const jobIds = completedJobs.map((j) => j.id);
		const passedQc = await this.qcAttempts.find({
			where: { ...this.scope(), automotiveJobId: In(jobIds), status: AutomotiveJobQcStatusEnum.PASSED },
			select: { automotiveJobId: true } as any
		});
		const passedJobIds = new Set(passedQc.map((q) => q.automotiveJobId));
		return jobIds.filter((id) => !passedJobIds.has(id)).length;
	}

	/** Sums a numeric column over the current tenant/org scope. */
	private async sumField(repo: Repository<any>, field: string): Promise<number> {
		const result = await repo
			.createQueryBuilder('t')
			.select(`COALESCE(SUM(t.${field}), 0)`, 'sum')
			.where('t.tenantId = :tenantId', { tenantId: this.scope().tenantId })
			.andWhere('t.organizationId = :organizationId', { organizationId: this.scope().organizationId })
			.getRawOne();
		return Number(result?.sum ?? 0);
	}

	/** Start/end of the current day for the "today" appointment metric. */
	private todayRange(): { start: Date; end: Date } {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return { start, end };
	}
}
