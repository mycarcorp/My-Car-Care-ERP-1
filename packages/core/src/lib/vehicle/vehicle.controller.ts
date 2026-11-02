import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPagination, IVehicle, IVehicleVinDecodeResult, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CreateVehicleDTO, DecodeVehicleVinDTO, UpdateVehicleDTO } from './dto';
import { Vehicle } from './vehicle.entity';
import { VehicleVinDecoderService } from './vehicle-vin-decoder.service';
import { VehicleService } from './vehicle.service';

@ApiTags('Vehicle')
@UseGuards(TenantPermissionGuard)
@Controller('/vehicles')
export class VehicleController extends CrudController<Vehicle> {
	constructor(
		private readonly vehicleService: VehicleService,
		private readonly vehicleVinDecoderService: VehicleVinDecoderService
	) {
		super(vehicleService);
	}

	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: BaseQueryDTO<Vehicle>): Promise<IPagination<IVehicle>> {
		return this.vehicleService.paginate(filter);
	}

	@Post('decode-vin')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Decode a VIN via the configured provider (server-side)' })
	@ApiResponse({ status: HttpStatus.OK })
	async decodeVin(@Body() input: DecodeVehicleVinDTO): Promise<IVehicleVinDecodeResult> {
		return this.vehicleVinDecoderService.decode(input.vin);
	}

	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IVehicle>> {
		const { relations, findInput, order } = data;
		return this.vehicleService.findAll({ where: findInput, order, relations });
	}

	@Post()
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Create a vehicle' })
	@ApiResponse({ status: HttpStatus.CREATED, type: Vehicle })
	async create(@Body() entity: CreateVehicleDTO): Promise<IVehicle> {
		return this.vehicleService.create(entity);
	}

	@Put(':id')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@UseValidationPipe({ transform: true })
	@ApiOperation({ summary: 'Update a vehicle' })
	@ApiResponse({ status: HttpStatus.OK, type: Vehicle })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<Vehicle>
	): Promise<IVehicle> {
		return this.vehicleService.create({ ...entity, id } as Partial<Vehicle>);
	}
}
