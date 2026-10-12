import { PartialType } from '@nestjs/mapped-types';
import { CrearCuentaDto } from './crear-cuenta.dto.js';

export class ActualizarCuentaDto extends PartialType(CrearCuentaDto) {}