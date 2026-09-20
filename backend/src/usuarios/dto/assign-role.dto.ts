import { IsInt, IsPositive, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  id_usuario: string;

  @IsInt()
  @IsPositive()
  id_rol: number;
}