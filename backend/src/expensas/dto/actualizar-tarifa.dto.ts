import { IsIn, IsNumber, IsPositive } from 'class-validator';

export class ActualizarTarifaDto {
  @IsIn(['A', 'B', 'C'], { message: 'La categoría debe ser A, B o C' })
  categoria: 'A' | 'B' | 'C';

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con hasta 2 decimales' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  monto: number;
}
