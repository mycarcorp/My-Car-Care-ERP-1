import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PurchaseOrder } from '../purchase-order.entity';
export class MikroOrmPurchaseOrderRepository extends MikroOrmBaseEntityRepository<PurchaseOrder> {}
