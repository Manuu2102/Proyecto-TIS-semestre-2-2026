import { IsInt, IsPositive } from 'class-validator';

export class AssignRoleDto {
  @IsInt()
  @IsPositive()
  id_usuario: number;

  @IsInt()
  @IsPositive()
  id_rol: number;
}