import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicle.entity';

@Injectable()
export class TypeOrmVehicleRepository extends Repository<Vehicle> {
	constructor(@InjectRepository(Vehicle) readonly repository: Repository<Vehicle>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
