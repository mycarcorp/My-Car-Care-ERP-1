import { IsEnum } from 'class-validator';
import { InventorySourceEnum } from '@gauzy/contracts';

export class ClassifyWarehouseInventorySourceDTO {
	@IsEnum(InventorySourceEnum)
	inventorySource: InventorySourceEnum;
}
