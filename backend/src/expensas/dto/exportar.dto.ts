import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class FormatoDto {
  @IsIn(['pdf', 'excel'], { message: 'El formato debe ser pdf o excel.' })
  formato: 'pdf' | 'excel';
}

/** Los mismos filtros y orden que la pantalla de Saldos pendientes. */
export class ExportarSaldosDto extends FormatoDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'El período debe tener el formato AAAA-MM.' })
  periodo?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'], { message: 'La categoría debe ser A, B o C.' })
  categoria?: string;

  @IsOptional()
  @IsIn(['Al día', 'En mora', 'Pendiente'], { message: 'El estado no es válido.' })
  estado?: string;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsIn(['departamento', 'responsable', 'categoria', 'sinPagar', 'adeudado', 'mora', 'saldoTotal'], {
    message: 'El campo de orden no es válido.',
  })
  orden?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'La dirección de orden debe ser asc o desc.' })
  dir?: 'asc' | 'desc';
}
