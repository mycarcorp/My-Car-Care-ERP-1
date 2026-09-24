import '../core/entities/internal';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiagnosticFindingKindEnum, DiagnosticStatusEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { MultiORMEnum } from '../core/utils';
import { Diagnostic } from './diagnostic.entity';
import { DiagnosticService } from './diagnostic.service';

describe('DiagnosticService', () => {
	type ScopeOverride = { tenantId?: string; organizationId?: string };
	const INSPECTION_ID = '431d24e3-a3c5-4606-b40b-4bc7bc136056';
	const TECHNICIAN_ID = '6497d7f6-03c5-44b1-8cd1-39e6b9fa6c66';
	let service: DiagnosticService;
	let tenant: ReturnType<typeof createTenantFixture>;
	let inspections: { findOneByIdString: jest.Mock };
	let employees: { findOneByIdString: jest.Mock };
	let findings: { create: jest.Mock; save: jest.Mock };

	beforeEach(() => {
		tenant = createTenantFixture();
		inspections = {
			findOneByIdString: jest.fn(async () => ({
				id: INSPECTION_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId,
				repairOrderId: 'derived-ro',
				vehicleId: 'derived-vehicle'
			}))
		};
		employees = {
			findOneByIdString: jest.fn(async () => ({
				id: TECHNICIAN_ID,
				tenantId: tenant.tenantId,
				organizationId: tenant.organizationId
			}))
		};
		findings = { create: jest.fn((input) => input), save: jest.fn(async (input) => input) };
		const repository = new InMemoryTenantRepository<Diagnostic>(
			new Set(['id', 'tenantId', 'organizationId', 'inspectionId', 'technicianEmployeeId'])
		);
		service = new DiagnosticService(
			repository as any,
			{} as any,
			findings as any,
			{} as any,
			inspections as any,
			employees as any
		);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...tenant.user,
			lastOrganizationId: tenant.organizationId
		} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenant.tenantId);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(tenant.organizationId);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it('creates a draft diagnostic through its inspection chain', async () => {
		const diagnostic = await service.createDiagnostic({
			inspectionId: INSPECTION_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Engine misfire'
		});
		expect(diagnostic).toMatchObject({
			inspectionId: INSPECTION_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Engine misfire',
			status: DiagnosticStatusEnum.DRAFT
		});
		expect(diagnostic).not.toHaveProperty('repairOrderId');
		expect(diagnostic).not.toHaveProperty('vehicleId');
	});

	it('creates diagnostic findings with their diagnostic parent', async () => {
		const diagnostic = await service.createDiagnostic({
			inspectionId: INSPECTION_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Engine misfire',
			findings: [{ kind: DiagnosticFindingKindEnum.CAUSE, description: 'Ignition coil failure' }]
		});
		expect(findings.save).toHaveBeenCalledWith(
			expect.objectContaining({ diagnosticId: diagnostic.id, kind: DiagnosticFindingKindEnum.CAUSE })
		);
	});

	it('rejects a nonexistent inspection', async () => {
		inspections.findOneByIdString.mockRejectedValue(new NotFoundException());
		await expect(
			service.createDiagnostic({
				inspectionId: INSPECTION_ID,
				technicianEmployeeId: TECHNICIAN_ID,
				symptom: 'Noise'
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it.each<[string, ScopeOverride, ScopeOverride]>([
		['inspection tenant', { tenantId: '61d078a8-2fe4-4e0e-bfe1-9d791d5b2317' }, {}],
		['technician organization', {}, { organizationId: '72998fa7-1061-48d7-a018-bbdadd4b78f4' }]
	])('rejects a foreign %s', async (_label, inspectionScope, technicianScope) => {
		inspections.findOneByIdString.mockResolvedValue({
			id: INSPECTION_ID,
			tenantId: inspectionScope.tenantId ?? tenant.tenantId,
			organizationId: tenant.organizationId
		});
		employees.findOneByIdString.mockResolvedValue({
			id: TECHNICIAN_ID,
			tenantId: tenant.tenantId,
			organizationId: technicianScope.organizationId ?? tenant.organizationId
		});
		await expect(
			service.createDiagnostic({
				inspectionId: INSPECTION_ID,
				technicianEmployeeId: TECHNICIAN_ID,
				symptom: 'Noise'
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it.each([DiagnosticStatusEnum.DRAFT, DiagnosticStatusEnum.IN_PROGRESS, DiagnosticStatusEnum.COMPLETED])(
		'accepts diagnostic status %s',
		async (status) => {
			await expect(
				service.createDiagnostic({
					inspectionId: INSPECTION_ID,
					technicianEmployeeId: TECHNICIAN_ID,
					symptom: 'Noise',
					status
				})
			).resolves.toMatchObject({ status });
		}
	);

	it('adds a finding only to an existing diagnostic in the current tenant', async () => {
		const diagnostic = await service.createDiagnostic({
			inspectionId: INSPECTION_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Noise'
		});
		await expect(
			service.addFinding(diagnostic.id, {
				kind: DiagnosticFindingKindEnum.OBSERVATION,
				description: 'Noise under load'
			})
		).resolves.toMatchObject({ diagnosticId: diagnostic.id });
	});
});
