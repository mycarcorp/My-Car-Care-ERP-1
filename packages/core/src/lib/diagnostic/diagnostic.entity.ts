import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { DiagnosticStatusEnum, ID, IDiagnostic, IEmployee, IInspection } from '@gauzy/contracts';
import { Employee, Inspection, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmDiagnosticRepository } from './repository/mikro-orm-diagnostic.repository';
@MultiORMEntity('diagnostic', { mikroOrmRepository: () => MikroOrmDiagnosticRepository })
export class Diagnostic extends TenantOrganizationBaseEntity implements IDiagnostic {
	@IsNotEmpty() @IsString() @MultiORMColumn({ type: 'text' }) symptom: string;
	@IsEnum(DiagnosticStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: DiagnosticStatusEnum, default: DiagnosticStatusEnum.DRAFT })
	status: DiagnosticStatusEnum;
	@IsDate() @MultiORMColumn() diagnosedAt: Date;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) summary?: string;
	@IsOptional() @IsString() @MultiORMColumn({ nullable: true, type: 'text' }) internalNote?: string;
	@IsOptional() @IsDate() @MultiORMColumn({ nullable: true }) completedAt?: Date;
	@MultiORMManyToOne(() => Inspection, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn()
	inspection?: IInspection;
	@IsUUID()
	@RelationId((it: Diagnostic) => it.inspection)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	inspectionId: ID;
	@MultiORMManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn() technician?: IEmployee;
	@IsUUID()
	@RelationId((it: Diagnostic) => it.technician)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	technicianEmployeeId: ID;
}
