import { IsUUID } from 'class-validator';

export class PagarExpensaDto {
  @IsUUID()
  id_usuario: string;
}