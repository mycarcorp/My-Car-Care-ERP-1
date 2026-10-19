import { BadRequestException } from '@nestjs/common';
import { EntitySchema, DataSource, Repository } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	CustomerFollowUpSourceEventTypeEnum,
	CustomerFollowUpStatusEnum,
	CustomerFollowUpTypeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CustomerFollowUpService } from './customer-follow-up.service';

type ScopeRow = {
	id: string;
	tenantId: string;
	organizationId: string;
	customerId?: string;
	vehicleId?: string;
	repairOrderId?: string;
	estimateId?: string;
	organizationContactId?: string;
	isActive?: boolean;
};

const TENANT_ID = '6b6c8a5e-0b0a-4e2b-9d1a-0f1f2a3b4c5d';
const ORGANIZATION_ID = '9f0e1d2c-3b4a-4958-8a7b-6c5d4e3f2a1b';
const EMPLOYEE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const VEHICLE_ID = 'cccccccc-3333-4333-8333-cccccccccccc';
const REPAIR_ORDER_ID = 'dddddddd-4444-4444-8444-dddddddddddd';
const ESTIMATE_ID = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const INVOICE_ID = 'ffffffff-6666-4666-8666-ffffffffffff';
const TASK_ID = '99999999-7777-4777-8777-999999999999';

class FollowUpRow {}
class ContactRow {}
class VehicleRow {}
class RepairOrderRow {}
class EstimateRow {}
class InvoiceRow {}
class TaskRow {}
class EmployeeRow {}

const followUpSchema = new EntitySchema<FollowUpRow>({
	target: FollowUpRow,
	name: 'FollowUpRow',
	tableName: 'customer_follow_up',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		title: { type: 'varchar' },
		description: { type: 'text', nullable: true },
		type: { type: 'varchar' },
		status: { type: 'varchar' },
		dueAt: { type: 'datetime', nullable: true },
		scheduledAt: { type: 'datetime', nullable: true },
		completedAt: { type: 'datetime', nullable: true },
		deferredUntil: { type: 'datetime', nullable: true },
		statusReason: { type: 'text', nullable: true },
		sourceEntityType: { type: 'varchar', nullable: true },
		sourceEntityId: { type: 'varchar', nullable: true },
		sourceEventType: { type: 'varchar', nullable: true },
		sourceEventKey: { type: 'varchar', nullable: true },
		sourceEventAt: { type: 'datetime', nullable: true },
		customerId: { type: 'varchar' },
		vehicleId: { type: 'varchar', nullable: true },
		repairOrderId: { type: 'varchar', nullable: true },
		estimateId: { type: 'varchar', nullable: true },
		invoiceId: { type: 'varchar', nullable: true },
		taskId: { type: 'varchar', nullable: true },
		ownerEmployeeId: { type: 'varchar', nullable: true }
	}
});

const contactSchema = new EntitySchema<ContactRow>({
	target: ContactRow,
	name: 'ContactRow',
	tableName: 'organization_contact',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

const vehicleSchema = new EntitySchema<VehicleRow>({
	target: VehicleRow,
	name: 'VehicleRow',
	tableName: 'vehicle',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		customerId: { type: 'varchar', nullable: true }
	}
});

const repairOrderSchema = new EntitySchema<RepairOrderRow>({
	target: RepairOrderRow,
	name: 'RepairOrderRow',
	tableName: 'repair_order',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		customerId: { type: 'varchar', nullable: true },
		vehicleId: { type: 'varchar', nullable: true }
	}
});

const estimateSchema = new EntitySchema<EstimateRow>({
	target: EstimateRow,
	name: 'EstimateRow',
	tableName: 'estimate',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		customerId: { type: 'varchar', nullable: true },
		vehicleId: { type: 'varchar', nullable: true },
		repairOrderId: { type: 'varchar', nullable: true }
	}
});

const invoiceSchema = new EntitySchema<InvoiceRow>({
	target: InvoiceRow,
	name: 'InvoiceRow',
	tableName: 'invoice',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		organizationContactId: { type: 'varchar', nullable: true }
	}
});

const taskSchema = new EntitySchema<TaskRow>({
	target: TaskRow,
	name: 'TaskRow',
	tableName: 'task',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

const employeeSchema = new EntitySchema<EmployeeRow>({
	target: EmployeeRow,
	name: 'EmployeeRow',
	tableName: 'employee',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		isActive: { type: 'boolean', nullable: true }
	}
});

describe('CustomerFollowUpService', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('unit lifecycle behavior', () => {
		let service: CustomerFollowUpService;
		let followUps: any;
		let employees: any;
		let activityLogService: any;
		let organizationContacts: any;
		let vehicles: any;
		let repairOrders: any;
		let estimates: any;
		let invoices: any;
		let tasks: any;

		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
			followUps = {
				manager: { transaction: jest.fn(async (callback) => callback({ getRepository: () => ({ create: jest.fn((value) => value), save: jest.fn(async (value) => value) }) })) },
				findOne: jest.fn(async () => null),
				save: jest.fn(async (value) => value),
				merge: jest.fn((entity, patch) => ({ ...entity, ...patch }))
			};
			employees = { findOneByIdString: jest.fn(async () => ({ id: EMPLOYEE_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })) };
			organizationContacts = { findOneByIdString: jest.fn(async () => ({ id: CUSTOMER_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })) };
			vehicles = { findOneByIdString: jest.fn(async () => null) };
			repairOrders = { findOneByIdString: jest.fn(async () => null) };
			estimates = { findOneByIdString: jest.fn(async () => null) };
			invoices = { findOneByIdString: jest.fn(async () => null) };
			tasks = { findOneByIdString: jest.fn(async () => null) };
			activityLogService = { logActivity: jest.fn() };
			service = new CustomerFollowUpService(
				followUps,
				{} as never,
				organizationContacts,
				vehicles,
				repairOrders,
				estimates,
				invoices,
				tasks,
				employees,
				activityLogService
			);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'follow-up-1',
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				status: CustomerFollowUpStatusEnum.OPEN,
				title: 'Follow up'
			} as never);
		});

		it('returns the existing follow-up when sourceEventKey already exists', async () => {
			const existing = { id: 'existing-1' };
			followUps.findOne.mockResolvedValueOnce(existing);
			const result = await service.createFollowUp({
				title: 'Duplicate event',
				customerId: CUSTOMER_ID,
				sourceEventKey: 'event-1',
				sourceEventType: CustomerFollowUpSourceEventTypeEnum.MANUAL,
				type: CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION
			} as never);
			expect(result).toBe(existing);
			expect(followUps.manager.transaction).not.toHaveBeenCalled();
		});

		it('rejects invalid status transitions', async () => {
			await expect(
				service.transition('follow-up-1', { status: CustomerFollowUpStatusEnum.COMPLETED })
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it('marks a follow-up completed through the lifecycle helper', async () => {
			jest.spyOn(service, 'findOneByIdString').mockResolvedValueOnce({
				id: 'follow-up-1',
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				status: CustomerFollowUpStatusEnum.SCHEDULED,
				title: 'Follow up'
			} as never);
			const result = await service.complete('follow-up-1', 'done');
			expect(result.status).toBe(CustomerFollowUpStatusEnum.COMPLETED);
			expect(activityLogService.logActivity).toHaveBeenCalledWith(
				BaseEntityEnum.CustomerFollowUp,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				'follow-up-1',
				'Follow up',
				expect.any(Object),
				ORGANIZATION_ID,
				TENANT_ID,
				expect.anything(),
				expect.anything()
			);
		});
	});

	describe('real-database integration', () => {
		let dbPath: string;
		let dataSource: DataSource;
		let service: CustomerFollowUpService;
		let followUpRepository: Repository<any>;
		let followUpRepositoryAdapter: any;
		let contactRepository: Repository<ContactRow>;
		let vehicleRepository: Repository<VehicleRow>;
		let repairOrderRepository: Repository<RepairOrderRow>;
		let employeeRepository: Repository<EmployeeRow>;

		beforeAll(async () => {
			dbPath = path.join(os.tmpdir(), `gauzy-customer-follow-up-${process.pid}-${Date.now()}.sqlite3`);
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: dbPath,
				entities: [followUpSchema, contactSchema, vehicleSchema, repairOrderSchema, estimateSchema, invoiceSchema, taskSchema, employeeSchema],
				synchronize: true,
				logging: false
			});
			await dataSource.initialize();
			followUpRepository = dataSource.getRepository(FollowUpRow);
			followUpRepositoryAdapter = {
				create: followUpRepository.create.bind(followUpRepository),
				merge: followUpRepository.merge.bind(followUpRepository),
				save: followUpRepository.save.bind(followUpRepository),
				findOne: followUpRepository.findOne.bind(followUpRepository),
				manager: {
					transaction: async (callback: any) => callback({ getRepository: () => followUpRepositoryAdapter })
				}
			};
			contactRepository = dataSource.getRepository(ContactRow);
			vehicleRepository = dataSource.getRepository(VehicleRow);
			repairOrderRepository = dataSource.getRepository(RepairOrderRow);
			employeeRepository = dataSource.getRepository(EmployeeRow);

			await contactRepository.save({ id: CUSTOMER_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID });
			await contactRepository.save({
				id: 'bbbbbbbb-2222-4222-8222-cccccccccccc',
				tenantId: '00000000-0000-4000-8000-000000000000',
				organizationId: '11111111-1111-4111-8111-111111111111'
			});
			await vehicleRepository.save({ id: VEHICLE_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, customerId: CUSTOMER_ID });
			await repairOrderRepository.save({
				id: REPAIR_ORDER_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				customerId: CUSTOMER_ID,
				vehicleId: VEHICLE_ID
			});
			await employeeRepository.save({
				id: EMPLOYEE_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				isActive: true
			});
		});

		afterAll(async () => {
			if (dataSource?.isInitialized) {
				await dataSource.destroy();
			}
			fs.rmSync(dbPath, { force: true });
		});

		beforeEach(() => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
			const dependency = {
				findOneByIdString: jest.fn(async (id: string) => {
					if (id === CUSTOMER_ID) return contactRepository.findOneBy({ id });
					if (id === 'bbbbbbbb-2222-4222-8222-cccccccccccc') return contactRepository.findOneBy({ id });
					if (id === VEHICLE_ID) return vehicleRepository.findOneBy({ id });
					if (id === REPAIR_ORDER_ID) return repairOrderRepository.findOneBy({ id });
					if (id === EMPLOYEE_ID) return employeeRepository.findOneBy({ id });
					if (id === ESTIMATE_ID) return null;
					if (id === INVOICE_ID) return null;
					if (id === TASK_ID) return null;
					return null;
				})
			};
			service = new CustomerFollowUpService(
				followUpRepositoryAdapter as never,
				{ } as never,
				dependency as never,
				dependency as never,
				dependency as never,
				dependency as never,
				dependency as never,
				dependency as never,
				dependency as never,
				{ logActivity: jest.fn() } as never
			);
		});

		it('creates, persists, and deduplicates a follow-up on the same source event', async () => {
			const first = await service.createFollowUp({
				title: 'Call customer after repair order update',
				customerId: CUSTOMER_ID,
				repairOrderId: REPAIR_ORDER_ID,
				sourceEntityType: 'repair_order',
				sourceEntityId: REPAIR_ORDER_ID,
				sourceEventKey: 'repair-order:updated:1',
				sourceEventType: CustomerFollowUpSourceEventTypeEnum.MANUAL,
				type: CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION
			} as never);

			const second = await service.createFollowUp({
				title: 'Duplicate call',
				customerId: CUSTOMER_ID,
				repairOrderId: REPAIR_ORDER_ID,
				sourceEntityType: 'repair_order',
				sourceEntityId: REPAIR_ORDER_ID,
				sourceEventKey: 'repair-order:updated:1',
				sourceEventType: CustomerFollowUpSourceEventTypeEnum.MANUAL,
				type: CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION
			} as never);

			expect(second.id).toBe(first.id);
			expect(await followUpRepository.count()).toBe(1);
			expect(first.customerId).toBe(CUSTOMER_ID);
			expect(first.repairOrderId).toBe(REPAIR_ORDER_ID);
			expect(first.status).toBe(CustomerFollowUpStatusEnum.OPEN);
		});

		it('persists lifecycle changes across the real repository', async () => {
			const created = await service.createFollowUp({
				title: 'Scheduled follow-up',
				customerId: CUSTOMER_ID,
				status: CustomerFollowUpStatusEnum.SCHEDULED,
				type: CustomerFollowUpTypeEnum.INVOICE_PAYMENT,
				sourceEventKey: 'repair-order:updated:2'
			} as never);

			const deferred = await service.defer(created.id as string, new Date('2025-01-01T00:00:00.000Z'), 'customer requested more time');
			const completed = await service.complete(created.id as string, 'completed after callback');
			const reloaded: any = await followUpRepository.findOneByOrFail({ id: created.id as string });

			expect(deferred.status).toBe(CustomerFollowUpStatusEnum.DEFERRED);
			expect(completed.status).toBe(CustomerFollowUpStatusEnum.COMPLETED);
			expect(reloaded.status).toBe(CustomerFollowUpStatusEnum.COMPLETED);
			expect(reloaded.completedAt).toBeTruthy();
		});

		it('rejects a follow-up when the customer is outside the current tenant and organization', async () => {
			await expect(
				service.createFollowUp({
					title: 'Wrong scope',
					customerId: 'bbbbbbbb-2222-4222-8222-cccccccccccc',
					type: CustomerFollowUpTypeEnum.POST_SERVICE_SATISFACTION
				} as never)
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});
});
