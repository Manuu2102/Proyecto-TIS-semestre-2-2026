import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    const userRoles: string[] = (user?.roles ?? []).map((r: string) => r.toUpperCase());
    const rolesNormalizados = requiredRoles.map((r) => r.toUpperCase());

    const tieneAcceso = rolesNormalizados.some((rol) => userRoles.includes(rol));

    if (!tieneAcceso) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    return true;
  }
}