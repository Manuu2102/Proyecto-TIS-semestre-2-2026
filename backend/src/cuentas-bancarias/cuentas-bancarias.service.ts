import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearCuentaDto } from './dto/crear-cuenta.dto.js';
import { ActualizarCuentaDto } from './dto/actualizar-cuenta.dto.js';

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

@Injectable()
export class CuentasBancariasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearCuentaDto, idUsuario: string) {
    const numeroTrim = dto.numero_cuenta.trim();

    const existente = await this.prisma.cuenta_bancaria.findFirst({
      where: { numero_cuenta: numeroTrim },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe una cuenta con el número ${numeroTrim}`,
      );
    }

    const cuenta = await this.prisma.cuenta_bancaria.create({
      data: {
        nombre: dto.nombre.trim(),
        banco: dto.banco.trim(),
        numero_cuenta: numeroTrim,
        tipo_cuenta: dto.tipo_cuenta,
        saldo: (dto.saldo ?? 0).toFixed(2),
        activa: dto.activa ?? true,
      },
    });

    await this.registrarAuditoria(cuenta.id, 'CREAR', null, cuenta, idUsuario);

    return serialize(cuenta);
  }

  async listar(filtros: { activa?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filtros.activa !== undefined) where.activa = filtros.activa;

    const cuentas = await this.prisma.cuenta_bancaria.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    return {
      total: cuentas.length,
      cuentas: cuentas.map(serialize),
    };
  }

  async buscarPorId(id: bigint) {
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({
      where: { id },
    });
    if (!cuenta) {
      throw new NotFoundException(`Cuenta con id ${id} no encontrada`);
    }
    return cuenta;
  }

  async actualizar(id: bigint, dto: ActualizarCuentaDto, idUsuario: string) {
    const anterior = await this.buscarPorId(id);

    if (dto.numero_cuenta) {
      const existente = await this.prisma.cuenta_bancaria.findFirst({
        where: {
          id: { not: id },
          numero_cuenta: dto.numero_cuenta.trim(),
        },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe una cuenta con el número ${dto.numero_cuenta}`,
        );
      }
    }

    const cuenta = await this.prisma.cuenta_bancaria.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.banco !== undefined && { banco: dto.banco.trim() }),
        ...(dto.numero_cuenta !== undefined && {
          numero_cuenta: dto.numero_cuenta.trim(),
        }),
        ...(dto.tipo_cuenta !== undefined && { tipo_cuenta: dto.tipo_cuenta }),
        ...(dto.saldo !== undefined && { saldo: dto.saldo.toFixed(2) }),
        ...(dto.activa !== undefined && { activa: dto.activa }),
        updated_at: new Date(),
      },
    });

    await this.registrarAuditoria(id, 'ACTUALIZAR', anterior, cuenta, idUsuario);

    return serialize(cuenta);
  }

  async desactivar(id: bigint, idUsuario: string) {
    const anterior = await this.buscarPorId(id);

    const cuenta = await this.prisma.cuenta_bancaria.update({
      where: { id },
      data: { activa: false, updated_at: new Date() },
    });

    await this.registrarAuditoria(id, 'DESACTIVAR', anterior, cuenta, idUsuario);

    return serialize(cuenta);
  }

  private async registrarAuditoria(
    registroId: bigint,
    accion: string,
    datosAnteriores: unknown,
    datosNuevos: unknown,
    idUsuario: string,
  ) {
    try {
      await this.prisma.auditoria.create({
        data: {
          usuario_id: idUsuario,
          tabla_afectada: 'cuenta_bancaria',
          registro_id: registroId.toString(),
          accion,
          datos_anteriores: datosAnteriores
            ? JSON.parse(
                JSON.stringify(datosAnteriores, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v,
                ),
              )
            : null,
          datos_nuevos: datosNuevos
            ? JSON.parse(
                JSON.stringify(datosNuevos, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v,
                ),
              )
            : null,
        },
      });
    } catch (e) {
      console.error('Error al registrar auditoría:', e);
    }
  }
}