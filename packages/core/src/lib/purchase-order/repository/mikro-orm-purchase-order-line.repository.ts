import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PurchaseOrderLine } from '../purchase-order-line.entity';
export class MikroOrmPurchaseOrderLineRepository extends MikroOrmBaseEntityRepository<PurchaseOrderLine> {}
