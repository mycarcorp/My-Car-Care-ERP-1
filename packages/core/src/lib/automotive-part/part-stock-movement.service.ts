import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import {
	AutomotiveJobStatusEnum, CustomerWorkApprovalRequestStatusEnum, CustomerWorkApprovalSubmissionStateEnum,
	ID, InventorySourceEnum, PartStockMovementTypeEnum, RepairOrderStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { AutomotiveJob } from '../automotive-job/automotive-job.entity';
import { CustomerWorkApproval } from '../customer-work-approval/customer-work-approval.entity';
import { CustomerWorkApprovalLine } from '../customer-work-approval/customer-work-approval-line.entity';
import { CustomerWorkApprovalRequest } from '../customer-work-approval/customer-work-approval-request.entity';
import { Estimate } from '../estimate/estimate.entity';
import { EstimateLine } from '../estimate/estimate-line.entity';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { RepairOrder } from '../repair-order/repair-order.entity';
import { Warehouse } from '../warehouse/warehouse.entity';
import { WarehouseProductVariant } from '../warehouse/warehouse-product-variant.entity';
import { AutomotivePartProfile } from './automotive-part-profile.entity';
import { CreatePartInventoryAdjustmentDTO } from './dto';
import { ConsumeAutomotiveJobPartDTO } from './dto/automotive-part.dto';
import { PartStockMovement } from './part-stock-movement.entity';
import { MikroOrmPartStockMovementRepository } from './repository/mikro-orm-part-stock-movement.repository';
import { TypeOrmPartStockMovementRepository } from './repository/type-orm-part-stock-movement.repository';

@Injectable()
export class PartStockMovementService extends TenantAwareCrudService<PartStockMovement> {
	constructor(
		typeOrmRepository: TypeOrmPartStockMovementRepository,
		mikroOrmRepository: MikroOrmPartStockMovementRepository,
		@InjectRepository(AutomotivePartProfile) private readonly profiles: Repository<AutomotivePartProfile>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}

	async adjust(profileId: ID, input: CreatePartInventoryAdjustmentDTO): Promise<PartStockMovement> {
		if (![PartStockMovementTypeEnum.ADJUSTMENT_IN, PartStockMovementTypeEnum.ADJUSTMENT_OUT].includes(input.type)) {
			throw new BadRequestException('Only inventory adjustment movement types are allowed here.');
		}
		const { tenantId, organizationId } = this.currentScope();
		const profile = await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		const quantity = Number(input.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0)
			throw new BadRequestException('Adjustment quantity must be positive.');
		const quantityDelta = input.type === PartStockMovementTypeEnum.ADJUSTMENT_IN ? quantity : -quantity;

		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			await manager.findOneByOrFail(ProductVariant, { id: profile.productVariantId, tenantId, organizationId });
			const warehouse = await manager.findOneByOrFail(Warehouse, {
				id: input.warehouseId,
				tenantId,
				organizationId
			});
			const balance = await manager.findOne(WarehouseProductVariant, {
				where: {
					id: input.warehouseProductVariantId,
					variantId: profile.productVariantId,
					tenantId,
					organizationId
				},
				relations: { warehouseProduct: true }
			});
			if (!balance || balance.warehouseProduct?.warehouseId !== input.warehouseId) {
				throw new BadRequestException(
					'Warehouse inventory balance does not belong to this part and warehouse.'
				);
			}
			return this.postMovement(manager, {
				profile,
				warehouse,
				balance,
				quantityDelta,
				type: input.type,
				reason: input.reason,
				notes: input.notes,
				tenantId,
				organizationId,
				inventorySource: warehouse.inventorySource
			});
		});
	}

	async postReceiptIn(
		manager: EntityManager,
		input: {
			profile: AutomotivePartProfile;
			warehouse: Warehouse;
			balance: WarehouseProductVariant;
			quantity: number;
			purchaseReceiptId: ID;
			inventorySource: InventorySourceEnum;
			tenantId: ID;
			organizationId: ID;
		}
	): Promise<PartStockMovement> {
		if (input.warehouse.inventorySource !== input.inventorySource) {
			throw new BadRequestException('Warehouse does not belong to the receipt inventory source.');
		}
		return this.postMovement(manager, {
			...input,
			quantityDelta: input.quantity,
			type: PartStockMovementTypeEnum.RECEIPT_IN,
			reason: 'Purchase receipt',
			purchaseReceiptId: input.purchaseReceiptId
		});
	}

	async consumeForJob(jobId: ID, input: ConsumeAutomotiveJobPartDTO): Promise<PartStockMovement> {
		const scope = this.currentScope();
		const actorId = RequestContext.currentUserId();
		if (!actorId) throw new BadRequestException('An authenticated user is required to record consumption.');
		if (!input.operationKey) throw new BadRequestException('A client operation key is required.');
		const quantity = Number(input.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0 || !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(String(quantity))) {
			throw new BadRequestException('Consumed quantity must be positive with at most three decimal places.');
		}
		const replay = (movement: PartStockMovement) => {
			if (
				movement.type !== PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT ||
				movement.automotiveJobId !== jobId || movement.automotivePartProfileId !== input.automotivePartProfileId ||
				movement.warehouseId !== input.warehouseId ||
				movement.warehouseProductVariantId !== input.warehouseProductVariantId ||
				Number(movement.quantityDelta) !== -quantity
			) throw new ConflictException('Operation key already belongs to a different consumption.');
			return movement;
		};
		try {
			return await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
				const existing = await manager.findOneBy(PartStockMovement, { operationKey: input.operationKey, ...scope });
				if (existing) return replay(existing);
				const job = await manager.findOneByOrFail(AutomotiveJob, { id: jobId, ...scope });
				if (job.status !== AutomotiveJobStatusEnum.IN_PROGRESS) {
					throw new BadRequestException('Only an in-progress authorized job can consume parts.');
				}
				const repairOrder = await manager.findOneByOrFail(RepairOrder, { id: job.repairOrderId, ...scope });
				if (![RepairOrderStatusEnum.OPEN, RepairOrderStatusEnum.IN_PROGRESS].includes(repairOrder.status)) {
					throw new BadRequestException('Repair order is not active.');
				}
				const approvalLine = await manager.findOneByOrFail(CustomerWorkApprovalLine, {
					id: job.customerWorkApprovalLineId, customerWorkApprovalId: job.customerWorkApprovalId,
					estimateLineId: job.estimateLineId, selected: true, ...scope
				});
				if (Number(approvalLine.approvedQuantity) <= 0) throw new BadRequestException('Work is not approved.');
				const approval = await manager.findOneByOrFail(CustomerWorkApproval, {
					id: job.customerWorkApprovalId, repairOrderId: repairOrder.id,
					estimateId: job.estimateId, estimateRevisionNumber: job.estimateRevisionNumber,
					customerId: repairOrder.customerId, vehicleId: repairOrder.vehicleId,
					submissionState: CustomerWorkApprovalSubmissionStateEnum.SUBMITTED, ...scope
				});
				const request = await manager.findOneByOrFail(CustomerWorkApprovalRequest, {
					id: approval.approvalRequestId, repairOrderId: repairOrder.id,
					estimateId: job.estimateId, estimateRevisionNumber: job.estimateRevisionNumber,
					customerId: repairOrder.customerId, vehicleId: repairOrder.vehicleId,
					status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED, ...scope
				});
				const estimate = await manager.findOneByOrFail(Estimate, {
					id: job.estimateId, repairOrderId: repairOrder.id, revisionNumber: job.estimateRevisionNumber,
					customerId: repairOrder.customerId, vehicleId: repairOrder.vehicleId, ...scope
				});
				if ((estimate.rootEstimateId ?? estimate.id) !== request.estimateRootId) {
					throw new BadRequestException('Approval request does not match the job estimate lineage.');
				}
				await manager.findOneByOrFail(EstimateLine, { id: job.estimateLineId, estimateId: job.estimateId, ...scope });
				const profile = await manager.findOneByOrFail(AutomotivePartProfile, {
					id: input.automotivePartProfileId, enabled: true, ...scope
				});
				const variant = await manager.findOne(ProductVariant, {
					where: { id: profile.productVariantId, ...scope }, relations: { price: true }
				});
				if (!variant || variant.enabled === false || !variant.price ||
					variant.price.tenantId !== scope.tenantId || variant.price.organizationId !== scope.organizationId ||
					!Number.isFinite(Number(variant.price.unitCost)) || Number(variant.price.unitCost) < 0 ||
					!variant.price.unitCostCurrency) {
					throw new BadRequestException('Part variant must have a scoped, valid current cost and currency.');
				}
				const warehouse = await manager.findOneByOrFail(Warehouse, { id: input.warehouseId, ...scope });
				if (warehouse.active === false || warehouse.inventorySource !== InventorySourceEnum.SERVICE_CENTER) {
					throw new BadRequestException('Consumption requires an active service-center warehouse.');
				}
				const balance = await manager.findOne(WarehouseProductVariant, {
					where: { id: input.warehouseProductVariantId, variantId: profile.productVariantId, ...scope },
					relations: { warehouseProduct: true }
				});
				if (!balance || balance.warehouseProduct?.warehouseId !== warehouse.id) {
					throw new BadRequestException('Balance does not match the part and warehouse.');
				}
				return this.postMovement(manager, {
					profile, warehouse, balance, quantityDelta: -quantity,
					type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT, reason: 'Job part consumption',
					inventorySource: warehouse.inventorySource, ...scope,
					automotiveJobId: job.id, repairOrderId: repairOrder.id,
					unitCost: Number(variant.price.unitCost), costCurrency: variant.price.unitCostCurrency,
					recordedByUserId: actorId, operationKey: input.operationKey
				});
			});
		} catch (error) {
			const existing = await this.typeOrmRepository.findOneBy({ operationKey: input.operationKey, ...scope });
			if (existing) return replay(existing);
			throw error;
		}
	}

	async consumptionsForJob(jobId: ID): Promise<PartStockMovement[]> {
		const scope = this.currentScope();
		await this.typeOrmRepository.manager.findOneByOrFail(AutomotiveJob, { id: jobId, ...scope });
		return this.typeOrmRepository.find({
			where: { automotiveJobId: jobId, ...scope }, order: { createdAt: 'DESC' }
		});
	}

	async reverseForJob(jobId: ID, movementId: ID, reason: string): Promise<PartStockMovement> {
		const scope = this.currentScope();
		const actorId = RequestContext.currentUserId();
		if (!actorId) throw new BadRequestException('An authenticated user is required to reverse consumption.');
		if (!reason?.trim()) throw new BadRequestException('A reversal reason is required.');
		try {
			return await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
				const original = await manager.findOneByOrFail(PartStockMovement, {
					id: movementId, automotiveJobId: jobId, type: PartStockMovementTypeEnum.JOB_CONSUMPTION_OUT, ...scope
				});
				const job = await manager.findOneByOrFail(AutomotiveJob, { id: jobId, repairOrderId: original.repairOrderId, ...scope });
				await manager.findOneByOrFail(RepairOrder, { id: job.repairOrderId, ...scope });
				if (await manager.findOneBy(PartStockMovement, { reversesMovementId: original.id, ...scope })) {
					throw new ConflictException('Consumption has already been reversed.');
				}
				const profile = await manager.findOneByOrFail(AutomotivePartProfile, {
					id: original.automotivePartProfileId, productVariantId: original.productVariantId, ...scope
				});
				const warehouse = await manager.findOneByOrFail(Warehouse, {
					id: original.warehouseId, inventorySource: InventorySourceEnum.SERVICE_CENTER, ...scope
				});
				const balance = await manager.findOne(WarehouseProductVariant, {
					where: { id: original.warehouseProductVariantId, variantId: original.productVariantId, ...scope },
					relations: { warehouseProduct: true }
				});
				if (!balance || balance.warehouseProduct?.warehouseId !== warehouse.id) {
					throw new BadRequestException('Original consumption balance is no longer valid.');
				}
				return this.postMovement(manager, {
					profile, warehouse, balance, quantityDelta: -Number(original.quantityDelta),
					type: PartStockMovementTypeEnum.JOB_CONSUMPTION_REVERSAL_IN,
					reason: reason.trim(), inventorySource: original.inventorySource, ...scope,
					automotiveJobId: original.automotiveJobId, repairOrderId: original.repairOrderId,
					unitCost: original.unitCost, costCurrency: original.costCurrency,
					recordedByUserId: actorId, reversesMovementId: original.id
				});
			});
		} catch (error) {
			if (await this.typeOrmRepository.findOneBy({ reversesMovementId: movementId, ...scope })) {
				throw new ConflictException('Consumption has already been reversed.');
			}
			throw error;
		}
	}

	async stock(profileId: ID): Promise<WarehouseProductVariant[]> {
		const { tenantId, organizationId } = this.currentScope();
		const profile = await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		return this.typeOrmRepository.manager.find(WarehouseProductVariant, {
			where: { variantId: profile.productVariantId, tenantId, organizationId },
			relations: { warehouseProduct: { warehouse: true } }
		});
	}

	async movements(profileId: ID): Promise<PartStockMovement[]> {
		const { tenantId, organizationId } = this.currentScope();
		await this.profiles.findOneByOrFail({ id: profileId, tenantId, organizationId });
		return this.typeOrmRepository.find({
			where: { automotivePartProfileId: profileId, tenantId, organizationId },
			order: { createdAt: 'DESC' }
		});
	}

	async update(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async delete(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async softDelete(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	async softRemove(): Promise<never> {
		throw new BadRequestException('Part stock movements are immutable. Create a corrective movement instead.');
	}

	private currentScope(): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId)
			throw new BadRequestException('Tenant and organization context are required.');
		return { tenantId, organizationId };
	}

	private async postMovement(
		manager: EntityManager,
		input: {
			profile: AutomotivePartProfile;
			warehouse: Warehouse;
			balance: WarehouseProductVariant;
			quantityDelta: number;
			type: PartStockMovementTypeEnum;
			reason: string;
			notes?: string;
			purchaseReceiptId?: ID;
			inventorySource?: InventorySourceEnum;
			automotiveJobId?: ID;
			repairOrderId?: ID;
			unitCost?: number;
			costCurrency?: string;
			recordedByUserId?: ID;
			reversesMovementId?: ID;
			operationKey?: string;
			tenantId: ID;
			organizationId: ID;
		}
	): Promise<PartStockMovement> {
		const quantityBefore = Number(input.balance.quantity ?? 0);
		const quantityAfter = +(quantityBefore + input.quantityDelta).toFixed(3);
		if (quantityAfter < 0) throw new BadRequestException('Inventory adjustment cannot create negative stock.');
		const claimed = await manager.update(
			WarehouseProductVariant,
			{
				id: input.balance.id,
				tenantId: input.tenantId,
				organizationId: input.organizationId,
				quantity: quantityBefore
			} as FindOptionsWhere<WarehouseProductVariant>,
			{ quantity: quantityAfter }
		);
		if (!claimed.affected) throw new ConflictException('Inventory balance changed; retry the adjustment.');
		return manager.save(PartStockMovement, {
			automotivePartProfileId: input.profile.id,
			productVariantId: input.profile.productVariantId,
			warehouseId: input.warehouse.id,
			warehouseProductVariantId: input.balance.id,
			type: input.type,
			quantityDelta: input.quantityDelta,
			quantityBefore,
			quantityAfter,
			reason: input.reason,
			notes: input.notes,
			purchaseReceiptId: input.purchaseReceiptId,
			inventorySource: input.inventorySource,
			automotiveJobId: input.automotiveJobId,
			repairOrderId: input.repairOrderId,
			unitCost: input.unitCost,
			costCurrency: input.costCurrency,
			recordedByUserId: input.recordedByUserId,
			reversesMovementId: input.reversesMovementId,
			operationKey: input.operationKey,
			tenantId: input.tenantId,
			organizationId: input.organizationId
		});
	}
}
