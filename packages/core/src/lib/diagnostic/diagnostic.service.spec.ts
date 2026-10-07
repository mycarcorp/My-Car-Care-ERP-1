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
	let repository: InMemoryTenantRepository<Diagnostic>;

	// Seeds a diagnostic row directly (includes entity-required fields) for lifecycle tests.
	const seedDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic =>
		repository.seed({
			inspectionId: INSPECTION_ID,
			technicianEmployeeId: TECHNICIAN_ID,
			symptom: 'Engine misfire',
			diagnosedAt: new Date('2026-10-01T09:00:00.000Z'),
			status: DiagnosticStatusEnum.DRAFT,
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId,
			...overrides
		} as Diagnostic);

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
		repository = new InMemoryTenantRepository<Diagnostic>(
			new Set(['id', 'tenantId', 'organizationId', 'inspectionId', 'technicianEmployeeId', 'status'])
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

	it('starts a draft diagnostic (DRAFT → IN_PROGRESS)', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.DRAFT });
		const updated = await service.start(existing.id);
		expect(updated.status).toBe(DiagnosticStatusEnum.IN_PROGRESS);
	});

	it('completes an in-progress diagnostic (IN_PROGRESS → COMPLETED) and stamps completedAt', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.IN_PROGRESS });
		const updated = await service.complete(existing.id);
		expect(updated.status).toBe(DiagnosticStatusEnum.COMPLETED);
		expect(updated.completedAt).toBeInstanceOf(Date);
	});

	it('rejects completing a draft diagnostic (DRAFT → COMPLETED)', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.DRAFT });
		await expect(service.complete(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects starting an in-progress diagnostic (IN_PROGRESS → IN_PROGRESS)', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.IN_PROGRESS });
		await expect(service.start(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects starting a completed diagnostic (COMPLETED → IN_PROGRESS)', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.COMPLETED });
		await expect(service.start(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects completing a completed diagnostic (COMPLETED → COMPLETED)', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.COMPLETED });
		await expect(service.complete(existing.id)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects updating a completed diagnostic', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.COMPLETED });
		await expect(service.update(existing.id, { summary: 'updated' })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects adding a finding to a completed diagnostic', async () => {
		const existing = seedDiagnostic({ status: DiagnosticStatusEnum.COMPLETED });
		await expect(
			service.addFinding(existing.id, { kind: DiagnosticFindingKindEnum.OBSERVATION, description: 'Late note' })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('enforces tenant isolation on lifecycle transitions', async () => {
		const foreign = seedDiagnostic({
			tenantId: 'c0a2c3f6-6c3b-4c66-9b9b-0f0a2b3c4d5e',
			status: DiagnosticStatusEnum.DRAFT
		});
		await expect(service.start(foreign.id)).rejects.toBeInstanceOf(NotFoundException);
	});
});
