import '../core/entities/internal';
import { CustomerWorkApprovalDeliveryChannelEnum, CustomerWorkApprovalDeliveryStatusEnum } from '@gauzy/contracts';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';
import { hashApprovalToken } from './customer-work-approval-request.service';
import { CustomerWorkApprovalRequestService } from './customer-work-approval-request.service';

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
	status: 'ACTIVE',
	tokenHash: hashApprovalToken('raw-secret')
};

describe('CustomerWorkApprovalRequestService delivery', () => {
	let service: CustomerWorkApprovalRequestService;
	let emailSendService: { getEmailInstance: jest.Mock };
	let requestRepository: { update: jest.Mock };
	let sendMock: jest.Mock;

	const token = signPurposeToken(
		TokenPurposeEnum.CUSTOMER_WORK_APPROVAL,
		{
			requestId: request.id,
			tenantId: request.tenantId,
			organizationId: request.organizationId,
			customerId: request.customerId,
			vehicleId: request.vehicleId,
			repairOrderId: request.repairOrderId,
			estimateId: request.estimateId,
			estimateRootId: request.estimateRootId,
			estimateRevisionNumber: String(request.estimateRevisionNumber),
			secret: 'raw-secret'
		},
		{ expiresIn: '1h' }
	);

	beforeEach(() => {
		requestRepository = { update: jest.fn(async () => ({ affected: 1 })) };
		sendMock = jest.fn(async () => ({ originalMessage: 'sent' }));
		emailSendService = {
			getEmailInstance: jest.fn(async () => ({ send: sendMock }))
		};
		service = new CustomerWorkApprovalRequestService(
			requestRepository as any,
			{} as any,
			{} as any,
			{ findOneByIdString: jest.fn() } as any,
			{} as any,
			{
				findOneByIdString: jest.fn(async () => ({
					primaryEmail: 'customer@example.com',
					primaryPhone: '+15555550123'
				}))
			} as any,
			{} as any,
			emailSendService as any
		);
		(service as any).findOneByIdString = jest.fn(async () => ({ ...request }));
	});

	it('sends a secure approval email and records a SENT delivery without persisting the token', async () => {
		const result = await service.deliverRequest(request.id, token, CustomerWorkApprovalDeliveryChannelEnum.EMAIL);

		expect(emailSendService.getEmailInstance).toHaveBeenCalledWith({
			organizationId: request.organizationId,
			tenantId: request.tenantId
		});
		expect(result.deliveryStatus).toBe(CustomerWorkApprovalDeliveryStatusEnum.SENT);
		expect(requestRepository.update).toHaveBeenCalledWith(
			{ id: request.id },
			expect.objectContaining({
				deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum.EMAIL,
				deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.SENT,
				deliveryAttemptedAt: expect.any(Date),
				deliveryError: undefined
			})
		);
		expect(sendMock).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.objectContaining({
					to: 'customer@example.com',
					subject: expect.stringContaining('Secure approval link'),
					html: expect.stringContaining('/share/customer-work-approval/request-id')
				})
			})
		);
	});

	it('marks SMS delivery as unavailable without calling the provider stack', async () => {
		const result = await service.deliverRequest(request.id, token, CustomerWorkApprovalDeliveryChannelEnum.SMS);

		expect(emailSendService.getEmailInstance).not.toHaveBeenCalled();
		expect(result.deliveryStatus).toBe(CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE);
		expect(requestRepository.update).toHaveBeenCalledWith(
			{ id: request.id },
			expect.objectContaining({
				deliveryChannel: CustomerWorkApprovalDeliveryChannelEnum.SMS,
				deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.UNAVAILABLE
			})
		);
	});

	it('records a provider failure safely and leaves the token reusable for retry', async () => {
		emailSendService.getEmailInstance.mockRejectedValueOnce(new Error('SMTP timeout'));

		const failure = await service.deliverRequest(request.id, token, CustomerWorkApprovalDeliveryChannelEnum.EMAIL);

		expect(failure.deliveryStatus).toBe(CustomerWorkApprovalDeliveryStatusEnum.FAILED);
		expect(failure.deliveryError).toContain('SMTP timeout');

		emailSendService.getEmailInstance.mockResolvedValueOnce({
			send: jest.fn(async () => ({ originalMessage: 'sent' }))
		});
		await expect(
			service.deliverRequest(request.id, token, CustomerWorkApprovalDeliveryChannelEnum.EMAIL)
		).resolves.toMatchObject({
			deliveryStatus: CustomerWorkApprovalDeliveryStatusEnum.SENT
		});
		expect((service as any).findOneByIdString).toHaveBeenCalledTimes(2);
	});

	it('rejects a mismatched token before any delivery attempt', async () => {
		const badToken = signPurposeToken(
			TokenPurposeEnum.CUSTOMER_WORK_APPROVAL,
			{
				requestId: request.id,
				tenantId: request.tenantId,
				organizationId: request.organizationId,
				customerId: request.customerId,
				vehicleId: request.vehicleId,
				repairOrderId: request.repairOrderId,
				estimateId: request.estimateId,
				estimateRootId: request.estimateRootId,
				estimateRevisionNumber: String(request.estimateRevisionNumber),
				secret: 'wrong-secret'
			},
			{ expiresIn: '1h' }
		);

		await expect(service.deliverRequest(request.id, badToken)).rejects.toThrow('no longer matches');
		expect(emailSendService.getEmailInstance).not.toHaveBeenCalled();
	});
});
