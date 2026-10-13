import { IsDateString, IsOptional } from 'class-validator';

export class GenerarDeudasDto {

  @IsOptional()
  @IsDateString()
  mes?: string;
}
