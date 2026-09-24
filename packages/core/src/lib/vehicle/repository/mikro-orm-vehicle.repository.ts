import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Vehicle } from '../vehicle.entity';

export class MikroOrmVehicleRepository extends MikroOrmBaseEntityRepository<Vehicle> {}
