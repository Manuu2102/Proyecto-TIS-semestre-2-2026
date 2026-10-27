import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * HU-20: si un rol sin permiso intenta operar la caja, se responde 403 "Acceso denegado"
 * (el guard de roles compartido usa otro mensaje; aquí solo se cambia para caja).
 */
@Catch(ForbiddenException)
export class AccesoDenegadoFilter implements ExceptionFilter {
  catch(_exception: ForbiddenException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(403)
      .json({ statusCode: 403, message: 'Acceso denegado', error: 'Forbidden' });
  }
}
