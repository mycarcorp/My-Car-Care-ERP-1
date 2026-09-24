import { BadRequestException, Injectable } from '@nestjs/common';
import { IVehicle } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { MikroOrmVehicleRepository } from './repository/mikro-orm-vehicle.repository';
import { TypeOrmVehicleRepository } from './repository/type-orm-vehicle.repository';
import { Vehicle } from './vehicle.entity';

@Injectable()
export class VehicleService extends TenantAwareCrudService<Vehicle> {
	constructor(
		typeOrmVehicleRepository: TypeOrmVehicleRepository,
		mikroOrmVehicleRepository: MikroOrmVehicleRepository,
		private readonly organizationContactService: OrganizationContactService
	) {
		super(typeOrmVehicleRepository, mikroOrmVehicleRepository);
	}

	async create(entity: Partial<Vehicle>): Promise<Vehicle> {
		const vinNormalized = this.normalizeVin(entity.vinNormalized ?? entity.vin);
		const customer = await this.organizationContactService.findOneByIdString(entity.customerId);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? entity.organizationId;

		if (
			(tenantId && customer.tenantId !== tenantId) ||
			(organizationId && customer.organizationId !== organizationId)
		) {
			throw new BadRequestException('Vehicle customer must belong to the current tenant and organization.');
		}

		return super.create({
			...entity,
			vinNormalized,
			vin: entity.vin ? vinNormalized : undefined
		} as Partial<IVehicle>);
	}

	private normalizeVin(vin?: string): string {
		const normalized = vin?.replace(/[\s-]/g, '').toUpperCase();

		if (!normalized || !/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
			throw new BadRequestException('VIN must be 17 characters and cannot contain I, O, or Q.');
		}

		return normalized;
	}
}
