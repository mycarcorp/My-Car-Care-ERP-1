import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Estimate } from '../estimate.entity';
export class MikroOrmEstimateRepository extends MikroOrmBaseEntityRepository<Estimate> {}
