import {
  IsBoolean,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class ActualizarConfiguracionDto {
  @IsOptional()
  @IsBoolean({
    message: 'El campo automatico debe ser verdadero o falso.',
  })
  automatico?: boolean;

  @IsOptional()
  @IsIn(['diaria', 'semanal'], {
    message: 'La frecuencia debe ser diaria o semanal.',
  })
  frecuencia?: 'diaria' | 'semanal';

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora debe tener el formato HH:mm.',
  })
  hora?: string;
}