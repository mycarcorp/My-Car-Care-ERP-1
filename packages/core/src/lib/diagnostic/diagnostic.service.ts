import { BadRequestException, Injectable } from '@nestjs/common';
import { DiagnosticStatusEnum, IDiagnosticCreateInput, IDiagnosticFindingCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeService } from '../employee/employee.service';
import { InspectionService } from '../inspection/inspection.service';
import { Diagnostic } from './diagnostic.entity';
import { MikroOrmDiagnosticRepository } from './repository/mikro-orm-diagnostic.repository';
import { TypeOrmDiagnosticRepository } from './repository/type-orm-diagnostic.repository';
import { TypeOrmDiagnosticFindingRepository } from './repository/type-orm-diagnostic-finding.repository';
import { MikroOrmDiagnosticFindingRepository } from './repository/mikro-orm-diagnostic-finding.repository';
import { MultiORMEnum } from '../core/utils';
@Injectable()
export class DiagnosticService extends TenantAwareCrudService<Diagnostic> {
	constructor(
		typeRepo: TypeOrmDiagnosticRepository,
		mikroRepo: MikroOrmDiagnosticRepository,
		private readonly findings: TypeOrmDiagnosticFindingRepository,
		private readonly mikroFindings: MikroOrmDiagnosticFindingRepository,
		private readonly inspections: InspectionService,
		private readonly employees: EmployeeService
	) {
		super(typeRepo, mikroRepo);
	}
	async createDiagnostic(input: IDiagnosticCreateInput): Promise<Diagnostic> {
		const { inspection, technician } = await this.validateScope(input.inspectionId, input.technicianEmployeeId);
		const diagnostic = await super.create({
			inspectionId: inspection.id,
			technicianEmployeeId: technician.id,
			symptom: input.symptom,
			summary: input.summary,
			internalNote: input.internalNote,
			diagnosedAt: new Date(),
			status: input.status ?? DiagnosticStatusEnum.DRAFT,
			organizationId: inspection.organizationId
		});
		for (const finding of input.findings ?? []) await this.addFinding(diagnostic.id, finding);
		return diagnostic;
	}

	async update(id: string, input: Partial<IDiagnosticCreateInput>) {
		const existing = await this.findOneByIdString(id);
		// A completed diagnostic is immutable: no further edits are permitted.
		this.assertNotCompleted(existing);
		const inspectionId = input.inspectionId ?? existing.inspectionId;
		const technicianEmployeeId = input.technicianEmployeeId ?? existing.technicianEmployeeId;
		await this.validateScope(inspectionId, technicianEmployeeId);
		return super.update(id, input);
	}

	/**
	 * Starts a diagnostic: DRAFT → IN_PROGRESS. Any other current status is rejected.
	 */
	async start(id: string): Promise<Diagnostic> {
		return await this.transitionStatus(id, DiagnosticStatusEnum.DRAFT, DiagnosticStatusEnum.IN_PROGRESS);
	}

	/**
	 * Completes a diagnostic: IN_PROGRESS → COMPLETED and stamps `completedAt`.
	 * COMPLETED is terminal — no lifecycle path changes it again.
	 */
	async complete(id: string): Promise<Diagnostic> {
		const diagnostic = await this.findOneByIdString(id);
		if (diagnostic.status !== DiagnosticStatusEnum.IN_PROGRESS) {
			throw new BadRequestException(`Cannot move a diagnostic from ${diagnostic.status} to ${DiagnosticStatusEnum.COMPLETED}.`);
		}
		diagnostic.status = DiagnosticStatusEnum.COMPLETED;
		diagnostic.completedAt = new Date();
		return await this.typeOrmRepository.save(diagnostic);
	}

	/**
	 * Applies the DRAFT → IN_PROGRESS start transition with tenant/org-safe lookup.
	 * Findings and the linked inspection/repair order are untouched.
	 */
	private async transitionStatus(
		id: string,
		from: DiagnosticStatusEnum,
		to: DiagnosticStatusEnum
	): Promise<Diagnostic> {
		const diagnostic = await this.findOneByIdString(id);
		if (diagnostic.status !== from) {
			throw new BadRequestException(`Cannot move a diagnostic from ${diagnostic.status} to ${to}.`);
		}
		diagnostic.status = to;
		return await this.typeOrmRepository.save(diagnostic);
	}

	/**
	 * Rejects any mutation targeting an already completed diagnostic.
	 */
	private assertNotCompleted(diagnostic: Diagnostic): void {
		if (diagnostic.status === DiagnosticStatusEnum.COMPLETED) {
			throw new BadRequestException('A completed diagnostic cannot be modified.');
		}
	}

	private async validateScope(inspectionId: string, technicianEmployeeId: string) {
		const [inspection, technician] = await Promise.all([
			this.inspections.findOneByIdString(inspectionId),
			this.employees.findOneByIdString(technicianEmployeeId)
		]);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? inspection.organizationId;
		if (
			(tenantId && (inspection.tenantId !== tenantId || technician.tenantId !== tenantId)) ||
			(organizationId &&
				(inspection.organizationId !== organizationId || technician.organizationId !== organizationId))
		)
			throw new BadRequestException(
				'Diagnostic inspection and technician must share the current tenant and organization.'
			);
		return { inspection, technician };
	}

	async addFinding(diagnosticId: string, input: IDiagnosticFindingCreateInput) {
		const diagnostic = await this.findOneByIdString(diagnosticId);
		// A completed diagnostic is immutable: no new findings may be added.
		this.assertNotCompleted(diagnostic);
		const finding = {
			...input,
			diagnosticId: diagnostic.id,
			tenantId: diagnostic.tenantId,
			organizationId: diagnostic.organizationId
		};
		if (this.ormType === MultiORMEnum.MikroORM) {
			const entity = this.mikroFindings.create(finding);
			await this.mikroFindings.persistAndFlush(entity);
			return entity;
		}
		return this.findings.save(this.findings.create(finding));
	}
}
