import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
	CustomerWorkApprovalChannelEnum,
	CustomerWorkApprovalRequestStatusEnum,
	EstimateLinePriorityEnum
} from '@gauzy/contracts';
import { sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
import { hashApprovalToken } from './customer-work-approval-request.service';
import { CustomerWorkApprovalService, hashClientIp, hashSnapshot } from './customer-work-approval.service';

const request = {
	id: 'request-id',
	tenantId: 'tenant-id',
	organizationId: 'organization-id',
	customerId: 'customer-id',
	vehicleId: 'vehicle-id',
	repairOrderId: 'repair-order-id',
	estimateId: 'estimate-id',
	estimateRootId: 'estimate-root-id',
	estimateRevisionNumber: 2,
	expiresAt: new Date(Date.now() + 60_000),
	status: CustomerWorkApprovalRequestStatusEnum.ACTIVE
};

const lines = [
	{
		id: 'line-1',
		quantity: 2,
		priority: EstimateLinePriorityEnum.MUST_FIX,
		description: 'Brakes',
		reason: 'Safety',
		unitPrice: 100,
		taxAmount: 10,
		discountAmount: 5,
		lineTotal: 205
	},
	{
		id: 'line-2',
		quantity: 1,
		priority: EstimateLinePriorityEnum.RECOMMENDED,
		description: 'Filter',
		reason: 'Maintenance',
		unitPrice: 45,
		taxAmount: 0,
		discountAmount: 0,
		lineTotal: 45
	}
];

describe('CustomerWorkApprovalService', () => {
	let manager: { update: jest.Mock; save: jest.Mock };
	let service: CustomerWorkApprovalService;

	beforeEach(() => {
		manager = {
			update: jest.fn(async () => ({ affected: 1 })),
			save: jest.fn().mockResolvedValueOnce({ id: 'approval-id' }).mockResolvedValueOnce(undefined)
		};
		const approvals = {
			metadata: { hasColumnWithPropertyPath: () => false },
			manager: { transaction: jest.fn(async (callback) => callback(manager)) }
		};
		service = new CustomerWorkApprovalService(
			approvals as never,
			{} as never,
			{ findOneByOrFail: jest.fn(async () => ({ ...request })) } as never,
			{
				findOneByOrFail: jest.fn(async () => ({
					id: request.estimateId,
					rootEstimateId: request.estimateRootId,
					revisionNumber: 2,
					currency: 'USD'
				}))
			} as never,
			{ find: jest.fn(async () => lines) } as never
		);
	});

	it('hashes opaque tokens without retaining the original value', () => {
		expect(hashApprovalToken('opaque-secret')).toHaveLength(64);
		expect(hashApprovalToken('opaque-secret')).not.toBe('opaque-secret');
	});

	it('uses deterministic canonical snapshot hashes', () => {
		expect(hashSnapshot({ b: 2, a: { y: 1, x: 0 } })).toBe(hashSnapshot({ a: { x: 0, y: 1 }, b: 2 }));
	});

	it('stores privacy-safe IP hashes only', () => {
		expect(hashClientIp('127.0.0.1', 'salt')).toHaveLength(64);
		expect(hashClientIp(null, 'salt')).toBeUndefined();
	});

	it('requires the approval token purpose', () => {
		const token = sign({ requestId: 'request-id' }, environment.JWT_SECRET, {
			algorithm: 'HS256',
			expiresIn: '1h'
		});
		expect(() => verifyPurposeToken(token, TokenPurposeEnum.CUSTOMER_WORK_APPROVAL)).toThrow();
	});

	it('rejects expired approval tokens', () => {
		const token = sign({ purpose: TokenPurposeEnum.CUSTOMER_WORK_APPROVAL }, environment.JWT_SECRET, {
			algorithm: 'HS256',
			expiresIn: -1
		});
		expect(() => verifyPurposeToken(token, TokenPurposeEnum.CUSTOMER_WORK_APPROVAL)).toThrow('Token has expired');
	});

	it('creates selected and unselected line snapshots and derives the total server-side', async () => {
		const approval = await service.submit(
			request.id,
			{
				decisions: [
					{ estimateLineId: 'line-1', selected: true },
					{ estimateLineId: 'line-2', selected: false }
				]
			},
			{ channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK, ip: '127.0.0.1' }
		);
		expect(approval).toMatchObject({ id: 'approval-id' });
		expect(manager.save.mock.calls[0][1]).toMatchObject({ approvedTotal: 205, currency: 'USD' });
		expect(manager.save.mock.calls[1][1]).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ estimateLineId: 'line-1', selected: true, approvedQuantity: 2 }),
				expect.objectContaining({ estimateLineId: 'line-2', selected: false, approvedQuantity: 0 })
			])
		);
	});

	it('rejects a submission that omits a presented line decision', async () => {
		await expect(
			service.submit(
				request.id,
				{ decisions: [{ estimateLineId: 'line-1', selected: true }] },
				{ channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK }
			)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects an already submitted request before writing', async () => {
		(service as any).requests.findOneByOrFail.mockResolvedValueOnce({
			...request,
			status: CustomerWorkApprovalRequestStatusEnum.SUBMITTED
		});
		await expect(
			service.submit(request.id, { decisions: [] }, { channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('rejects expired requests before writing', async () => {
		(service as any).requests.findOneByOrFail.mockResolvedValueOnce({
			...request,
			expiresAt: new Date(Date.now() - 1)
		});
		await expect(
			service.submit(request.id, { decisions: [] }, { channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects superseded requests before writing', async () => {
		(service as any).requests.findOneByOrFail.mockResolvedValueOnce({
			...request,
			status: CustomerWorkApprovalRequestStatusEnum.SUPERSEDED
		});
		await expect(
			service.submit(request.id, { decisions: [] }, { channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a duplicate transaction claim without creating an approval', async () => {
		manager.update.mockResolvedValueOnce({ affected: 0 });
		await expect(
			service.submit(
				request.id,
				{ decisions: lines.map((line) => ({ estimateLineId: line.id, selected: false })) },
				{ channel: CustomerWorkApprovalChannelEnum.SMS_SECURE_LINK }
			)
		).rejects.toBeInstanceOf(ConflictException);
		expect(manager.save).not.toHaveBeenCalled();
	});
});
