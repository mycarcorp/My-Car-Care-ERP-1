import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { DiagnosticFindingKindEnum, ID, IDiagnostic, IDiagnosticFinding } from '@gauzy/contracts';
import { Diagnostic, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmDiagnosticFindingRepository } from './repository/mikro-orm-diagnostic-finding.repository';
@MultiORMEntity('diagnostic_finding', { mikroOrmRepository: () => MikroOrmDiagnosticFindingRepository })
export class DiagnosticFinding extends TenantOrganizationBaseEntity implements IDiagnosticFinding {
	@IsEnum(DiagnosticFindingKindEnum)
	@MultiORMColumn({ type: 'simple-enum', enum: DiagnosticFindingKindEnum })
	kind: DiagnosticFindingKindEnum;
	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) description: string;
	@MultiORMManyToOne(() => Diagnostic, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	diagnostic?: IDiagnostic;
	@IsUUID()
	@RelationId((it: DiagnosticFinding) => it.diagnostic)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	diagnosticId: ID;
}
