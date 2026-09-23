import { PartialType } from '@nestjs/mapped-types';
import { CrearDepartamentoDto } from './crear-departamento.dto.js';

export class ActualizarDepartamentoDto extends PartialType(CrearDepartamentoDto) {}