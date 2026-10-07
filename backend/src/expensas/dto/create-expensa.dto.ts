import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
// Ajusta la ruta si tu carpeta generada es otra
import { criterio_reparto, tipo_mora } from '../../generated/prisma/client.js';

export class ComponenteDto {
  @IsEnum(criterio_reparto)
  criterio: criterio_reparto;

  // Todos los componentes de una expensa deben sumar 100
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentaje: number;
}

export class CreateExpensaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  // Cualquier fecha del mes que cubre; se normaliza al día 1. Ej: "2026-10-01"
  @IsDateString()
  periodo: string;

  @IsDateString()
  fecha_vencimiento: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto_total: number;

  @IsOptional()
  @IsBoolean()
  pagos_anticipados?: boolean;

  @IsOptional()
  @IsEnum(tipo_mora)
  mora_tipo?: tipo_mora;

  // Monto fijo por mes o porcentaje por mes, según mora_tipo
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mora_valor?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComponenteDto)
  componentes: ComponenteDto[];
}
