import { VehicleDetailComponent } from './vehicle-detail.component';

describe('VehicleDetailComponent service history access', () => {
	let component: VehicleDetailComponent;
	let repairOrderApi: { getVehicleServiceHistory: jest.Mock };
	let permissions: { hasPermission: jest.Mock };

	beforeEach(() => {
		repairOrderApi = {
			getVehicleServiceHistory: jest.fn()
		};
		permissions = {
			hasPermission: jest.fn()
		};

		component = new VehicleDetailComponent(
			{
				instant: (key: string) => key,
				getCurrentLang: () => 'en',
				getFallbackLang: () => 'en',
				getLangs: () => ['en'],
				onLangChange: { pipe: () => ({ subscribe: () => void 0 }) },
				get: () => ({ subscribe: () => void 0 }),
				stream: () => ({ subscribe: () => void 0 }),
				use: () => ({ subscribe: () => void 0 })
			} as any,
			{} as any,
			{} as any,
			{} as any,
			repairOrderApi as any,
			{ danger: jest.fn() } as any,
			{} as any,
			permissions as any
		);
	});

	it('skips the service history request when the user lacks repair-order view permission', async () => {
		permissions.hasPermission.mockResolvedValue(false);

		await (component as any).loadServiceHistory('vehicle-1');

		expect(permissions.hasPermission).toHaveBeenCalledWith('ORG_REPAIR_ORDER_VIEW');
		expect(repairOrderApi.getVehicleServiceHistory).not.toHaveBeenCalled();
		expect(component.canViewServiceHistory).toBe(false);
		expect(component.serviceHistory).toEqual([]);
	});

	it('loads the service history when the user has repair-order view permission', async () => {
		permissions.hasPermission.mockResolvedValue(true);
		repairOrderApi.getVehicleServiceHistory.mockResolvedValue([{ repairOrderId: 'ro-1' }]);

		await (component as any).loadServiceHistory('vehicle-1');

		expect(repairOrderApi.getVehicleServiceHistory).toHaveBeenCalledWith('vehicle-1');
		expect(component.canViewServiceHistory).toBe(true);
		expect(component.serviceHistory).toEqual([{ repairOrderId: 'ro-1' }]);
	});

	it('surfaces a visible error state when service history cannot be loaded', async () => {
		permissions.hasPermission.mockResolvedValue(true);
		repairOrderApi.getVehicleServiceHistory.mockRejectedValue(new Error('History unavailable'));

		await (component as any).loadServiceHistory('vehicle-1');

		expect(component.canViewServiceHistory).toBe(true);
		expect(component.serviceHistory).toEqual([]);
		expect(component.serviceHistoryError).toBe('History unavailable');
	});
});