import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { RepairOrder } from '../repair-order.entity';

export class MikroOrmRepairOrderRepository extends MikroOrmBaseEntityRepository<RepairOrder> {}
