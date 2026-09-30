import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { getMetadataArgsStorage } from 'typeorm';
import {
	AutomotiveJobStatusEnum, CustomerWorkApprovalRequestStatusEnum, CustomerWorkApprovalSubmissionStateEnum,
	InventorySourceEnum, PartStockMovementTypeEnum, RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { PartStockMovement } from './part-stock-movement.entity';
import { PartStockMovementService } from './part-stock-movement.service';
import { CreatePartInventoryAdjustmentDTO } from './dto';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const job = {
	id: 'job-1', repairOrderId: 'ro-1', estimateId: 'estimate-1', estimateRevisionNumber: 1,
	estimateLineId: 'line-1', customerWorkApprovalId: 'approval-1', customerWorkApprovalLineId: 'approved-line-1',
	status: AutomotiveJobStatusEnum.IN_PROGRESS, ...scope
};
const input = {
	automotivePartProfileId: 'part-1', warehouseId: 'warehouse-1', warehouseProductVariantId: 'balance-1',
	quantity: 2, operationKey: '123e4567-e89b-42d3-a456-426614174000'
};

describe('Job-attributed part stock movements', () => {
	let service: PartStockMovementService;
	let repository: any;
	let manager: any;
	let quantity: number;
	let movements: any[];
	let original: any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(scope.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(scope.organizationId);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		quantity = 5;
		movements = [];
		original = {
			id: 'movement-1', ...scope, automotiveJobId: job.id, repairOrderId: job.repairOrderId,
			automotivePartProfileId: input.automotivePartProfileId, productVariantId: 'variant-1',
			warehouseId: input.warehouseId, warehouseProductVariantId: input.warehouseProductVariantId,
			inventorySource: InventorySourceEnum.SERVICE_CENTER, quantityDelta: -2, unitCost: 12.5,
			costCurrency: 'USD', type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT
		};
		manager = {
			findOneByOrFail: jest.fn(async (entity, where) => {
				if (entity === AutomotiveJob) return { ...job };
				if (entity === RepairOrder) return { id: 'ro-1', status: RepairOrderStatusEnum.OPEN,
					customerId: 'customer-1', vehicleId: 'vehicle-1', ...scope };
				if (entity === CustomerWorkApprovalLine) return { id: 'approved-line-1', approvedQuantity: 1, ...scope };
				if (entity === CustomerWorkApproval) return { id: 'approval-1', approvalRequestId: 'request-1',
					submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED, ...scope };
				if (entity === CustomerWorkApprovalRequest) return {
					status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED, estimateRootId: 'estimate-1'
				};
				if (entity === Estimate || entity === EstimateLine) return { id: where.id, ...scope };
				if (entity === AutomotivePartProfile) return { id: input.automotivePartProfileId,
					productVariantId: 'variant-1', enabled: true, ...scope };
				if (entity === Warehouse) return { id: input.warehouseId,
					inventorySource: InventorySourceEnum.SERVICE_CENTER, active: true, ...scope };
				if (entity === PartStockMovement) return original;
				throw new Error('Unexpected entity');
			}),
			findOneBy: jest.fn(async (entity, where) => {
				if (entity === PartStockMovement) return movements.find((item) =>
					where.operationKey ? item.operationKey === where.operationKey : item.reversesMovementId === where.reversesMovementId
				) ?? null;
				return null;
			}),
			findOne: jest.fn(async (entity) => {
				if (entity === ProductVariant) return { id: 'variant-1', enabled: true, price: {
					unitCost: 12.5, unitCostCurrency: 'USD', ...scope
				} };
				if (entity === WarehouseProductVariant) return { id: 'balance-1', quantity,
					warehouseProduct: { warehouseId: 'warehouse-1' } };
				return null;
			}),
			update: jest.fn(async (_entity, where, changes) => {
				if (where.quantity !== quantity) return { affected: 0 };
				quantity = changes.quantity;
				return { affected: 1 };
			}),
			save: jest.fn(async (_entity, data) => {
				const movement = { id: `movement-${movements.length + 1}`, ...data };
				movements.push(movement);
				return movement;
			})
		};
		repository = {
			manager: { transaction: jest.fn(async (action) => {
				const oldQuantity = quantity;
				try { return await action(manager); } catch (error) { quantity = oldQuantity; movements = []; throw error; }
			}) },
			findOneBy: jest.fn(async (where) => movements.find((item) =>
				where.operationKey ? item.operationKey === where.operationKey : item.reversesMovementId === where.reversesMovementId
			) ?? null),
			find: jest.fn(async () => movements)
		};
		service = new PartStockMovementService(repository as never, {} as never, {} as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('decrements stock and snapshots job, RO, part, warehouse, actor and current cost in one transaction', async () => {
		const movement = await service.consumeForJob(job.id, input);
		expect(quantity).toBe(3);
		expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
		expect(movement).toMatchObject({
			automotiveJobId: job.id, repairOrderId: job.repairOrderId, productVariantId: 'variant-1',
			warehouseId: input.warehouseId, inventorySource: InventorySourceEnum.SERVICE_CENTER,
			quantityBefore: 5, quantityAfter: 3, quantityDelta: -2,
			unitCost: 12.5, costCurrency: 'USD', recordedByUserId: 'user-1', operationKey: input.operationKey,
			type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT
		});
		expect(manager.update).toHaveBeenCalledWith(WarehouseProductVariant,
			expect.objectContaining({ quantity: 5, ...scope }), { quantity: 3 });
		expect(manager.findOneByOrFail).toHaveBeenCalledWith(CustomerWorkApprovalLine,
			expect.objectContaining({ selected: true, estimateLineId: job.estimateLineId, ...scope }));
	});

	it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN, 0.0001])('rejects invalid quantity %s', async (invalid) => {
		await expect(service.consumeForJob(job.id, { ...input, quantity: invalid })).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.manager.transaction).not.toHaveBeenCalled();
	});

	it('accepts precisely three fractional decimal places and requires an operation key', async () => {
		await service.consumeForJob(job.id, { ...input, quantity: 1.001 });
		expect(quantity).toBe(3.999);
		await expect(service.consumeForJob(job.id, { ...input, operationKey: '' })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects absent actor and scope before touching stock', async () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.update).not.toHaveBeenCalled();
	});

	it.each([AutomotiveJobStatusEnum.COMPLETED, AutomotiveJobStatusEnum.CANCELLED, AutomotiveJobStatusEnum.OPEN])(
		'rejects a job in %s', async (status) => {
			manager.findOneByOrFail.mockImplementationOnce(async () => ({ ...job, status }));
			await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
			expect(manager.update).not.toHaveBeenCalled();
		}
	);

	it.each([RepairOrderStatusEnum.CLOSED, RepairOrderStatusEnum.CANCELLED])('rejects RO in %s', async (status) => {
		manager.findOneByOrFail.mockImplementationOnce(async () => ({ ...job }));
		manager.findOneByOrFail.mockImplementationOnce(async () => ({ id: job.repairOrderId, status }));
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('rejects unapproved work and mismatched job/RO provenance', async () => {
		manager.findOneByOrFail.mockImplementationOnce(async () => ({ ...job }));
		manager.findOneByOrFail.mockImplementationOnce(async () => ({ id: 'ro-1', status: RepairOrderStatusEnum.OPEN }));
		manager.findOneByOrFail.mockImplementationOnce(async () => ({ approvedQuantity: 0 }));
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('rejects an approval request from a different estimate root', async () => {
		const lookup = manager.findOneByOrFail.getMockImplementation();
		manager.findOneByOrFail.mockImplementation(async (entity, where) =>
			entity === CustomerWorkApprovalRequest ? { estimateRootId: 'other-estimate' } : lookup(entity, where));
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('uses scoped predicates for job, RO, approval, variant, warehouse and balance', async () => {
		await service.consumeForJob(job.id, input);
		for (const entity of [AutomotiveJob, RepairOrder, CustomerWorkApprovalLine,
			CustomerWorkApproval, CustomerWorkApprovalRequest, Estimate, EstimateLine,
			AutomotivePartProfile, Warehouse]) {
			expect(manager.findOneByOrFail).toHaveBeenCalledWith(entity, expect.objectContaining(scope));
		}
		expect(manager.findOne).toHaveBeenCalledWith(ProductVariant,
			expect.objectContaining({ where: expect.objectContaining(scope) }));
		expect(manager.findOne).toHaveBeenCalledWith(WarehouseProductVariant,
			expect.objectContaining({ where: expect.objectContaining(scope) }));
		expect(manager.findOneByOrFail).toHaveBeenCalledWith(CustomerWorkApproval,
			expect.objectContaining({ repairOrderId: job.repairOrderId,
				submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED }));
		expect(manager.findOneByOrFail).toHaveBeenCalledWith(CustomerWorkApprovalRequest,
			expect.objectContaining({ repairOrderId: job.repairOrderId, customerId: 'customer-1',
				vehicleId: 'vehicle-1', status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED }));
	});

	it.each([AutomotiveJob, RepairOrder, AutomotivePartProfile, Warehouse])('rejects missing/scoped-out %s', async (entity) => {
		const lookup = manager.findOneByOrFail.getMockImplementation();
		manager.findOneByOrFail.mockImplementation(async (candidate, where) => {
			if (candidate === entity) throw new Error('outside current scope');
			return lookup(candidate, where);
		});
		await expect(service.consumeForJob(job.id, input)).rejects.toThrow('outside current scope');
		expect(manager.update).not.toHaveBeenCalled();
	});

	it.each(['missing variant', 'foreign price', 'missing price', 'wrong balance'])
		('rejects %s without changing stock', async (caseName) => {
			const lookup = manager.findOne.getMockImplementation();
			manager.findOne.mockImplementation(async (entity, options) => {
				if (caseName === 'wrong balance' && entity === WarehouseProductVariant) {
					return { quantity, warehouseProduct: { warehouseId: 'other-warehouse' } };
				}
				if (entity === ProductVariant && caseName !== 'wrong balance') {
					if (caseName === 'missing variant') return null;
					const variant = await lookup(entity, options);
					return caseName === 'missing price' ? { ...variant, price: null } :
						{ ...variant, price: { ...variant.price, tenantId: 'foreign-tenant' } };
				}
				return lookup(entity, options);
			});
			await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
			expect(quantity).toBe(5);
			expect(manager.update).not.toHaveBeenCalled();
		});

	it('rejects a Recon warehouse and an inactive warehouse', async () => {
		const lookup = manager.findOneByOrFail.getMockImplementation();
		for (const changes of [{ inventorySource: InventorySourceEnum.RECON }, { active: false }]) {
			manager.findOneByOrFail.mockImplementation(async (entity, where) =>
				entity === Warehouse ? { id: input.warehouseId, ...scope, ...changes } : lookup(entity, where));
			await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		}
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('snapshots zero cost and currency without using estimate pricing', async () => {
		const lookup = manager.findOne.getMockImplementation();
		manager.findOne.mockImplementation(async (entity, options) => {
			const found = await lookup(entity, options);
			return entity === ProductVariant ? { ...found, price: { ...found.price, unitCost: 0 } } : found;
		});
		expect(await service.consumeForJob(job.id, input)).toMatchObject({ unitCost: 0, costCurrency: 'USD' });
	});

	it('preserves a cost with more than two decimal places in the ledger mapping and snapshot', async () => {
		const unitCost = 12.3456;
		const column = getMetadataArgsStorage().columns.find(
			({ target, propertyName }) => target === PartStockMovement && propertyName === 'unitCost'
		);
		expect(column).toBeDefined();
		expect(column.options.precision).toBeUndefined();
		expect(column.options.scale).toBeUndefined();
		const transformer = column.options.transformer;
		expect(transformer && !Array.isArray(transformer) && transformer.to(unitCost)).toBe(unitCost);
		expect(transformer && !Array.isArray(transformer) && transformer.from(String(unitCost))).toBe(unitCost);
		const lookup = manager.findOne.getMockImplementation();
		manager.findOne.mockImplementation(async (entity, options) => {
			const found = await lookup(entity, options);
			return entity === ProductVariant ? { ...found, price: { ...found.price, unitCost } } : found;
		});
		expect(await service.consumeForJob(job.id, input)).toMatchObject({ unitCost, costCurrency: 'USD' });
	});

	it('rejects insufficient stock and lost updates without posting a movement', async () => {
		quantity = 1;
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(BadRequestException);
		quantity = 5;
		manager.update.mockResolvedValueOnce({ affected: 0 });
		await expect(service.consumeForJob(job.id, input)).rejects.toBeInstanceOf(ConflictException);
		expect(movements).toHaveLength(0);
	});

	it('rolls back balance when movement insertion fails', async () => {
		manager.save.mockRejectedValueOnce(new Error('insert failed'));
		await expect(service.consumeForJob(job.id, input)).rejects.toThrow('insert failed');
		expect(quantity).toBe(5);
		expect(movements).toHaveLength(0);
	});

	it('replays the same operation without withdrawing twice and rejects conflicting replay', async () => {
		const first = await service.consumeForJob(job.id, input);
		expect(await service.consumeForJob(job.id, input)).toEqual(first);
		expect(quantity).toBe(3);
		await expect(service.consumeForJob(job.id, { ...input, quantity: 1 })).rejects.toBeInstanceOf(ConflictException);
		expect(manager.save).toHaveBeenCalledTimes(1);
	});

	it('returns a concurrent committed replay after a uniqueness failure rolls back its balance update', async () => {
		const committed = { ...original, operationKey: input.operationKey };
		manager.save.mockImplementationOnce(async () => {
			throw new Error('unique operation key');
		});
		repository.findOneBy.mockResolvedValueOnce(committed);
		expect(await service.consumeForJob(job.id, input)).toBe(committed);
		expect(quantity).toBe(5);
	});

	it('restores stock with one full immutable reversal, then permits a corrected consumption', async () => {
		await service.consumeForJob(job.id, input);
		const reversed = await service.reverseForJob(job.id, 'movement-1', 'Wrong quantity');
		expect(reversed).toMatchObject({
			reversesMovementId: 'movement-1', automotiveJobId: job.id, repairOrderId: job.repairOrderId,
			quantityDelta: 2, quantityBefore: 3, quantityAfter: 5,
			unitCost: 12.5, costCurrency: 'USD', recordedByUserId: 'user-1',
			type: PartStockMovementTypeEnum.JOB_CONSUMPTION_REVERSAL_IN
		});
		expect(original).toMatchObject({ quantityDelta: -2 });
		expect(quantity).toBe(5);
		await expect(service.reverseForJob(job.id, 'movement-1', 'Again')).rejects.toBeInstanceOf(ConflictException);
		await service.consumeForJob(job.id, { ...input, operationKey: '223e4567-e89b-42d3-a456-426614174000', quantity: 1 });
		expect(quantity).toBe(4);
	});

	it('can reverse after job completion and rejects a reversal belonging to another tenant', async () => {
		const lookup = manager.findOneByOrFail.getMockImplementation();
		manager.findOneByOrFail.mockImplementation(async (entity, where) =>
			entity === AutomotiveJob ? { ...job, status: AutomotiveJobStatusEnum.COMPLETED } : lookup(entity, where));
		await expect(service.reverseForJob(job.id, original.id, 'Return to stock')).resolves.toMatchObject({
			reversesMovementId: original.id, quantityDelta: 2
		});
		const scopeLookup = manager.findOneByOrFail.getMockImplementation();
		manager.findOneByOrFail.mockImplementation(async (entity, where) => {
			if (entity === PartStockMovement) throw new Error('foreign movement');
			return scopeLookup(entity, where);
		});
		await expect(service.reverseForJob('foreign-job', 'foreign-movement', 'Return')).rejects.toThrow('foreign movement');
	});

	it('rejects blank reversal reasons and a cross-job original', async () => {
		await expect(service.reverseForJob(job.id, 'movement-1', ' ')).rejects.toBeInstanceOf(BadRequestException);
		manager.findOneByOrFail.mockImplementationOnce(async () => { throw new Error('movement not found in scope'); });
		await expect(service.reverseForJob('other-job', 'movement-1', 'Wrong job')).rejects.toThrow('movement not found in scope');
		expect(manager.update).not.toHaveBeenCalled();
	});

	it('does not permit new movement types through generic inventory adjustments', async () => {
		for (const type of [PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT,
			PartStockMovementTypeEnum.JOB_CONSUMPTION_REVERSAL_IN]) {
			const dto = plainToInstance(CreatePartInventoryAdjustmentDTO, { ...input, type, reason: 'spoof' });
			expect(validateSync(dto).some((error) => error.property === 'type')).toBe(true);
			await expect(service.adjust('part-1', { ...input, type, reason: 'spoof' })).rejects.toBeInstanceOf(BadRequestException);
		}
		expect(repository.manager.transaction).not.toHaveBeenCalled();
	});
});