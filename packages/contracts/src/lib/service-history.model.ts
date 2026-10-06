import { ID } from './base-entity.model';
import { AutomotiveJobStatusEnum } from './automotive-job.model';
import { AutomotiveJobLaborStatusEnum } from './automotive-job-labor.model';
import { AutomotiveJobQcStatusEnum } from './automotive-job-qc.model';
import { RepairOrderStatusEnum } from './repair-order.model';

/**
 * My Car Care "Service History" — a derived, read-only projection assembled live
 * from existing repair order, job, labor, part-consumption, QC-attempt and
 * invoice records. There is intentionally NO persistent entity/table behind
 * these interfaces and nothing here duplicates stored operational/financial data.
 */
export interface IServiceHistoryJobItem {
	jobId: ID;
	title: string;
	description?: string;
	status: AutomotiveJobStatusEnum;
}

export interface IServiceHistoryLaborItem {
	laborId: ID;
	description: string;
	billedHours?: number;
	status: AutomotiveJobLaborStatusEnum;
}

export interface IServiceHistoryPartItem {
	partMovementId: ID;
	description: string;
	quantity: number;
	unitCost?: number;
	costCurrency?: string;
}

export interface IServiceHistoryQcSummary {
	totalAttempts: number;
	latestStatus?: AutomotiveJobQcStatusEnum;
	latestCheckedAt?: Date;
}

export interface IServiceHistoryInvoiceSummary {
	invoiceId: ID;
	invoiceNumber: number;
	totalValue: number;
	amountPaid: number;
	amountDue: number;
	status?: string;
	paid: boolean;
}

export interface IServiceHistoryRecord {
	repairOrderId: ID;
	repairOrderNumber: string;
	status: RepairOrderStatusEnum;
	arrivedAt: Date;
	arrivalOdometer?: number;
	customerId: ID;
	vehicleId: ID;
	concern?: string;
	workPerformed: IServiceHistoryJobItem[];
	labor: IServiceHistoryLaborItem[];
	partsUsed: IServiceHistoryPartItem[];
	qc: IServiceHistoryQcSummary;
	invoice?: IServiceHistoryInvoiceSummary;
}
