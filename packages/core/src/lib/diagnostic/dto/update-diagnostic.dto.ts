import { PartialType } from '@nestjs/mapped-types';
import { CreateDiagnosticDTO } from './create-diagnostic.dto';

export class UpdateDiagnosticDTO extends PartialType(CreateDiagnosticDTO) {}
