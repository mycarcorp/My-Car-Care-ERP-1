import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CreateDiagnosticDTO, CreateDiagnosticFindingDTO, UpdateDiagnosticDTO } from './dto';
import { Diagnostic } from './diagnostic.entity';
import { DiagnosticService } from './diagnostic.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/diagnostics')
export class DiagnosticController {
	constructor(private readonly diagnosticService: DiagnosticService) {}

	@Get()
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_VIEW)
	async findAll(@Query() query: BaseQueryDTO<Diagnostic>): Promise<IPagination<Diagnostic>> {
		return this.diagnosticService.findAll(query);
	}

	@Get(':id')
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() options: FindOptionsQueryDTO<Diagnostic>) {
		return this.diagnosticService.findOneByIdString(id, options);
	}

	@Post()
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_CREATE)
	@UseValidationPipe({ transform: true })
	async create(@Body() input: CreateDiagnosticDTO): Promise<Diagnostic> {
		return this.diagnosticService.createDiagnostic(input);
	}

	@Put(':id')
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_EDIT)
	@UseValidationPipe({ transform: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdateDiagnosticDTO) {
		return this.diagnosticService.update(id, input);
	}

	@Post(':id/findings')
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_EDIT)
	@UseValidationPipe({ transform: true })
	async addFinding(@Param('id', UUIDValidationPipe) id: ID, @Body() input: CreateDiagnosticFindingDTO) {
		return this.diagnosticService.addFinding(id, input);
	}

	@Post(':id/start')
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_EDIT)
	async start(@Param('id', UUIDValidationPipe) id: ID): Promise<Diagnostic> {
		return this.diagnosticService.start(id);
	}

	@Post(':id/complete')
	@Permissions(PermissionsEnum.ORG_DIAGNOSTIC_COMPLETE)
	async complete(@Param('id', UUIDValidationPipe) id: ID): Promise<Diagnostic> {
		return this.diagnosticService.complete(id);
	}
}
