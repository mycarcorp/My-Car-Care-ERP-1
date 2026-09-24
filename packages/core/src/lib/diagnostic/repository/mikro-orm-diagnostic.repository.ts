import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Diagnostic } from '../diagnostic.entity';
export class MikroOrmDiagnosticRepository extends MikroOrmBaseEntityRepository<Diagnostic> {}
