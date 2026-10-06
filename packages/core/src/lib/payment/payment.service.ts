import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Between,
	In,
	Brackets,
	WhereExpressionBuilder,
	Raw,
	SelectQueryBuilder,
	DeleteResult,
	EntityManager,
	FindOptionsWhere,
	Repository,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { chain } from 'underscore';
import * as moment from 'moment';
import {
	CurrenciesEnum,
	ID,
	IDateRangePicker,
	IGetPaymentInput,
	IInvoice,
	InvoiceStatusTypesEnum,
	IPagination,
	IPayment,
	LanguagesEnum,
	PaymentStats,
	PermissionsEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { Payment } from './payment.entity';
import { Invoice } from '../invoice/invoice.entity';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { LIKE_OPERATOR } from '../core/util';
import {
	getDateRangeFormat,
	getDaysBetweenDates,
	LegacyFindOneOptions,
	MultiORMEnum,
	resolveTimeZone
} from '../core/utils';
import { EmailService } from './../email-send/email.service';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';
import { TypeOrmPaymentRepository } from './repository/type-orm-payment.repository';

/**
 * Rounds to two decimal places, guarding against floating point artifacts.
 */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class PaymentService extends TenantAwareCrudService<Payment> {
	constructor(
		readonly typeOrmPaymentRepository: TypeOrmPaymentRepository,
		readonly mikroOrmPaymentRepository: MikroOrmPaymentRepository,
		private readonly emailService: EmailService,
		@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>
	) {
		super(typeOrmPaymentRepository, mikroOrmPaymentRepository);
	}

	/**
	 * Creates (or, when `entity.id` is present, updates) a payment and transactionally
	 * recalculates the owning invoice's payment state. The actual payment rows are the
	 * single source of truth for the invoice's `alreadyPaid` / `amountDue` / payment
	 * status: client-supplied values for those fields are stripped and never trusted.
	 *
	 * The controller's update path calls `create({ ...entity, id })`, so this single
	 * override keeps both the create and the upsert-by-id paths safe.
	 *
	 * @param entity - The payment payload.
	 * @returns The saved payment.
	 */
	public async create(entity: IPayment): Promise<Payment> {
		const scope = this.scope();

		// Strip client-supplied invoice financial fields; they are recomputed
		// server-side from the actual payment rows and are never trusted.
		delete (entity as any).alreadyPaid;
		delete (entity as any).amountDue;
		delete (entity as any).status;

		const isUpdate = isNotEmpty(entity.id);
		const hasAmount = entity.amount !== undefined && entity.amount !== null;

		// The amount is mandatory on create and validated whenever supplied on update.
		if (!isUpdate || hasAmount) {
			const amount = Number(entity.amount);
			if (!Number.isFinite(amount) || amount <= 0) {
				throw new BadRequestException('Payment amount must be a positive number.');
			}
		}

		// Reject foreign, void or currency-mismatched invoices before opening a transaction.
		if (entity.invoiceId) {
			await this.validatePaymentInvoice(entity.invoiceId, entity.currency as CurrenciesEnum | undefined, scope);
		}

		// Inherited Gauzy self-enrichment: when the caller may not act for another
		// employee, attribute the payment to the current employee.
		const employeeId = RequestContext.currentEmployeeId();
		const canChangeSelectedEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			let previousInvoiceId: ID | undefined;
			if (isUpdate) {
				const existing = await manager.findOne(Payment, {
					where: { id: entity.id, ...scope },
					select: { id: true, invoiceId: true }
				});
				if (!existing) {
					throw new NotFoundException('Payment not found in this organization.');
				}
				previousInvoiceId = existing.invoiceId;
			}

			const payment = await manager.save(
				Payment,
				manager.create(Payment, {
					...entity,
					...scope,
					// Preserve the inherited Gauzy convention: a caller without
					// CHANGE_SELECTED_EMPLOYEE records the payment for themselves.
					...(isNotEmpty(employeeId) && !canChangeSelectedEmployee ? { employeeId } : {})
				})
			);

			// `invoiceId: null` (or a different invoice) re-parents the payment: the
			// previously linked invoice must be recalculated as well.
			const effectiveInvoiceId = entity.invoiceId !== undefined ? entity.invoiceId : previousInvoiceId;
			if (effectiveInvoiceId) {
				await this.recalculateInvoicePaymentState(effectiveInvoiceId, manager, scope);
			}
			if (previousInvoiceId && previousInvoiceId !== effectiveInvoiceId) {
				await this.recalculateInvoicePaymentState(previousInvoiceId, manager, scope);
			}
			return payment;
		});
	}

	/**
	 * Updates a payment by id through the same hardened, transactional path as create().
	 * (The payment controller's update endpoint calls `create({ ...entity, id })`; this
	 * override keeps direct `update(id, entity)` callers safe as well.)
	 *
	 * @param id - The payment id or where-conditions.
	 * @param partialEntity - The partial payment payload.
	 * @returns The updated payment.
	 */
	public async update(
		id: string | FindOptionsWhere<Payment>,
		partialEntity: QueryDeepPartialEntity<Payment>
	): Promise<Payment | UpdateResult> {
		if (typeof id !== 'string') {
			return super.update(id, partialEntity);
		}
		return this.create({ ...(partialEntity as object), id } as IPayment);
	}

	/**
	 * Deletes a payment by id and transactionally recalculates the owning invoice's
	 * payment state from the remaining payment rows.
	 *
	 * @param criteria - The payment id (string) or where-conditions.
	 * @param options - Additional find options (passed through for non-id criteria).
	 * @returns The delete result.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<Payment>,
		options?: LegacyFindOneOptions<Payment>
	): Promise<DeleteResult> {
		if (typeof criteria !== 'string') {
			return super.delete(criteria, options);
		}

		const scope = this.scope();
		const payment = await this.typeOrmRepository.findOneBy({ id: criteria, ...scope });
		if (!payment) {
			throw new NotFoundException('Payment not found in this organization.');
		}
		const invoiceId = payment.invoiceId;

		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			const result = await manager.delete(Payment, { id: criteria, ...scope });
			if (invoiceId) {
				await this.recalculateInvoicePaymentState(invoiceId, manager, scope);
			}
			return result;
		});
	}

	/**
	 * Recalculates and persists an invoice's payment-derived state (`alreadyPaid`,
	 * `amountDue`, `paid` and payment status) from the actual payment rows, inside the
	 * caller's transaction. A VOID invoice keeps its status; when nothing has been paid
	 * the existing non-payment status (DRAFT / SENT / VIEWED) is preserved.
	 *
	 * @param invoiceId - The invoice to recalculate.
	 * @param manager - The transactional entity manager.
	 * @param scope - The current tenant/organization scope.
	 */
	private async recalculateInvoicePaymentState(
		invoiceId: ID,
		manager: EntityManager,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<void> {
		const invoice = await manager.findOne(Invoice, { where: { id: invoiceId, ...scope } });
		if (!invoice) {
			throw new NotFoundException('Invoice not found in this organization.');
		}

		const rows = await manager.find(Payment, {
			where: { invoiceId, ...scope },
			select: { id: true, amount: true }
		});
		const totalPaid = round2(rows.reduce((sum, payment) => sum + Number(payment.amount), 0));

		const totalValue = Number(invoice.totalValue);
		const amountDue = round2(totalValue - totalPaid);

		invoice.alreadyPaid = totalPaid;
		invoice.amountDue = amountDue;
		invoice.paid = totalPaid >= totalValue && totalValue > 0;

		if (invoice.status === InvoiceStatusTypesEnum.VOID) {
			// A void invoice never changes status; only the money columns are refreshed.
		} else if (totalPaid > 0) {
			if (totalPaid < totalValue) {
				invoice.status = InvoiceStatusTypesEnum.PARTIALLY_PAID;
			} else if (totalPaid === totalValue) {
				invoice.status = InvoiceStatusTypesEnum.FULLY_PAID;
			} else {
				invoice.status = InvoiceStatusTypesEnum.OVERPAID;
			}
		}
		// totalPaid <= 0: preserve the existing non-payment status.

		await manager.save(Invoice, invoice);
	}

	/**
	 * Validates that the invoice belongs to the current tenant/organization scope, is
	 * not VOID, and (when a currency is supplied) matches the payment currency.
	 *
	 * @param invoiceId - The invoice the payment is being attached to.
	 * @param currency - The payment currency, when supplied.
	 * @param scope - The current tenant/organization scope.
	 * @returns The scoped invoice.
	 */
	private async validatePaymentInvoice(
		invoiceId: ID,
		currency: CurrenciesEnum | undefined,
		scope: { tenantId: ID; organizationId: ID }
	): Promise<Invoice> {
		const invoice = await this.invoices.findOneBy({ id: invoiceId, ...scope });
		if (!invoice) {
			throw new BadRequestException('Invoice not found in this organization.');
		}
		if (invoice.status === InvoiceStatusTypesEnum.VOID) {
			throw new BadRequestException('A void invoice cannot accept payments.');
		}
		if (currency && invoice.currency && currency !== invoice.currency) {
			throw new BadRequestException('Payment currency must match the invoice currency.');
		}
		return invoice;
	}

	/**
	 * The current tenant/organization scope, required for every payment mutation.
	 */
	private scope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) {
			throw new BadRequestException('Tenant and organization context are required.');
		}
		return { tenantId, organizationId };
	}

	/**
	 * Retrieves the count and total amount of payments where `isProcessed` is true.
	 *
	 * @returns {Promise<PaymentStats>} An object containing the count of payments and the total amount.
	 */
	async getPaymentStats(): Promise<PaymentStats> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmRepository.getEntityManager().getKnex();
				const result = await knex('payment').count('id as count').sum('amount as amount').first();
				return {
					count: parseInt(result?.count ?? '0', 10),
					amount: parseFloat(result?.amount ?? '0') || 0
				};
			}
			case MultiORMEnum.TypeORM:
			default: {
				const result = await this.typeOrmPaymentRepository
					.createQueryBuilder('payment')
					.select('COUNT(payment.id)', 'count')
					.addSelect('SUM(payment.amount)', 'amount')
					.getRawOne();

				return {
					count: parseInt(result.count, 10),
					amount: parseFloat(result.amount) || 0
				};
			}
		}
	}

	/**
	 * Retrieves payments based on the provided request parameters.
	 *
	 * @param request - Request parameters for filtering payments.
	 * @returns A Promise that resolves to an array of payments.
	 */
	async getPayments(request: IGetPaymentInput) {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const tenantId = RequestContext.currentTenantId();
				const { organizationId, startDate, endDate } = request;
				let { projectIds = [], contactIds = [] } = request;
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate || moment().startOf('week')),
					moment.utc(endDate || moment().endOf('week'))
				);

				const where: any = {
					tenantId,
					organizationId,
					paymentDate: { $gte: start, $lte: end }
				};
				if (isNotEmpty(projectIds)) where.projectId = { $in: projectIds };
				if (isNotEmpty(contactIds)) where.organizationContactId = { $in: contactIds };

				const items = await this.mikroOrmRepository.find(where, {
					populate: ['project', 'organizationContact'] as any[],
					orderBy: { paymentDate: 'ASC' as any },
					...(request && request.limit > 0
						? { limit: request.limit, offset: (request.page || 0) * request.limit }
						: {})
				});
				return items.map((e) => this.serialize(e));
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the Payment entity
				const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

				// Set up the find options for the query.
				// typeorm-v1: the legacy `join` find-option was removed. The `project` relation is
				// already left-joined and selected below via `relations` + nested `select`, so the
				// explicit `leftJoin` is redundant (the where/order filters use the `payment` columns
				// directly, not the joined `project` alias).
				query.setFindOptions({
					...(request && request.limit > 0
						? {
								take: request.limit,
								skip: (request.page || 0) * request.limit
							}
						: {}),
					select: {
						project: {
							id: true,
							name: true,
							imageUrl: true,
							membersCount: true
						},
						organizationContact: {
							id: true,
							name: true,
							imageUrl: true
						}
					},
					relations: {
						project: true,
						organizationContact: true
					},
					order: {
						paymentDate: 'ASC'
					}
				});

				// Set up the where clause using the provided filter function
				query.where((qb: SelectQueryBuilder<Payment>) => {
					this.getFilterQuery(qb, request);
				});

				// Set up the where clause using the provided filter function
				return await query.getMany();
			}
		}
	}

	/**
	 * Retrieves daily payment report charts based on the provided request parameters.
	 *
	 * @param request - Request parameters for filtering data.
	 * @returns A Promise that resolves to an array of daily payment report charts.
	 */
	async getDailyReportCharts(request: IGetPaymentInput) {
		let payments: IPayment[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const tenantId = RequestContext.currentTenantId();
				const { organizationId, startDate, endDate } = request;
				let { projectIds = [], contactIds = [] } = request;
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate || moment().startOf('week')),
					moment.utc(endDate || moment().endOf('week'))
				);

				const where: any = {
					tenantId,
					organizationId,
					paymentDate: { $gte: start, $lte: end }
				};
				if (isNotEmpty(projectIds)) where.projectId = { $in: projectIds };
				if (isNotEmpty(contactIds)) where.organizationContactId = { $in: contactIds };

				const items = await this.mikroOrmRepository.find(where, {
					orderBy: { paymentDate: 'ASC' as any },
					...(request.limit > 0 ? { limit: request.limit, offset: (request.page || 0) * request.limit } : {})
				});
				payments = items.map((e) => this.serialize(e));
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the Payment entity
				const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

				// Set up the find options for the query
				query.setFindOptions({
					...(request.limit > 0
						? {
								take: request.limit,
								skip: (request.page || 0) * request.limit
							}
						: {}),
					order: {
						// Order results by the 'startedAt' field in ascending order
						paymentDate: 'ASC'
					}
				});

				// Set up the where clause using the provided filter function
				query.where((qb: SelectQueryBuilder<Payment>) => {
					this.getFilterQuery(qb, request);
				});

				// Set up the where clause using the provided filter function
				payments = await query.getMany();
				break;
			}
		}

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate } = request;
		// A request without a time zone would make the grouping below format an undefined moment
		const timeZone = resolveTimeZone(request.timeZone);
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		// Group payments by date and calculate sum
		const byDate = chain(payments)
			.groupBy((payment: IPayment) => moment.utc(payment.paymentDate).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((payments: Payment[], date) => {
				const sum = payments.reduce((iteratee: any, payment: any) => {
					return iteratee + parseFloat(payment.amount);
				}, 0);
				return {
					date,
					value: {
						payment: sum.toFixed(1)
					}
				};
			})
			.value();
		// Map dates to the required format
		const dates = days.map((date) => byDate[date] || { date, value: { payment: 0 } });
		return dates;
	}

	/**
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	private getFilterQuery(query: SelectQueryBuilder<Payment>, request: IGetPaymentInput) {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, startDate, endDate } = request;
		let { projectIds = [], contactIds = [] } = request;

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where({
					paymentDate: Between(start, end)
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), {
						projectIds
					});
				}
				if (isNotEmpty(contactIds)) {
					qb.andWhere(p(`"${query.alias}"."organizationContactId" IN (:...contactIds)`), {
						contactIds
					});
				}
			})
		);
		return query;
	}

	/**
	 *
	 * @param languageCode
	 * @param params
	 * @param origin
	 */
	async sendReceipt(
		languageCode: LanguagesEnum,
		invoice: IInvoice,
		payment: IPayment,
		origin: string
	): Promise<boolean> {
		try {
			const { primaryEmail: recipientEmail, name: recipientName } = invoice.toContact;

			await this.emailService.sendPaymentReceipt(
				languageCode,
				recipientEmail,
				recipientName,
				invoice.invoiceNumber,
				payment.amount,
				payment.currency,
				invoice.fromOrganization,
				origin
			);

			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Paginates PaymentEntity records using custom filters.
	 *
	 * @param filter - The pagination parameters including custom filters.
	 * @returns A promise resolving to paginated PaymentEntity data.
	 */
	public pagination(filter?: BaseQueryDTO<any>): Promise<IPagination<IPayment>> {
		if (filter?.where) {
			const { where } = filter;

			// Apply like filter for the note field.
			if (where.note) {
				filter.where['note'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :note`, {
					note: `%${where.note}%`
				});
			}

			// Apply date range filter for paymentDate field
			if (where.paymentDate) {
				const { startDate, endDate } = where.paymentDate as IDateRangePicker;

				const start = startDate ? moment.utc(startDate) : moment().startOf('month').utc();
				const end = endDate ? moment.utc(endDate) : moment().endOf('month').utc();

				filter['where']['paymentDate'] = Between<string>(
					start.format('YYYY-MM-DD HH:mm:ss'),
					end.format('YYYY-MM-DD HH:mm:ss')
				);
			}

			// Apply filter for the tags field
			if (where.tags) {
				const { tags } = where;

				filter['where']['tags'] = {
					id: In(tags as Array<ID>)
				};
			}
		}

		return super.paginate(filter ?? {});
	}
}
