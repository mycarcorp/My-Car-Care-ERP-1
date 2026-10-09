import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { FinancingApplication } from '../financing-application.entity';

export class MikroOrmFinancingApplicationRepository extends MikroOrmBaseEntityRepository<FinancingApplication> {}
