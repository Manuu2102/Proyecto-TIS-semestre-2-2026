import { IsDateString, IsIn, IsNumberString, IsOptional } from 'class-validator';

export class ConsultarPagosDto {
  @IsOptional()
  @IsNumberString()
  id_personal?: string;

  @IsOptional()
  @IsIn(['Sueldo', 'Anticipo'])
  tipo?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
