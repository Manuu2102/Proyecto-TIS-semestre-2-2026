import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearPersonalDto } from './dto/crear-personal.dto.js';
import { RegistrarPagoDto } from './dto/registrar-pago.dto.js';
import { ConsultarPagosDto } from './dto/consultar-pagos.dto.js';
import { registrarAuditoria } from '../lib/auditoria.js';

const METODOS_PAGO = ['Efectivo', 'Transferencia'];
const TIPOS_COMPROBANTE = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const COMPROBANTE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class PersonalService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.personal.findMany({
      include: {
        historial_personal: {
          orderBy: { fecha_inicio: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async crear(data: CrearPersonalDto) {
    const existe = await this.prisma.personal.findUnique({ 
      where: { ci: BigInt(data.ci) } 
    });
    if (existe) throw new BadRequestException('El CI ya está registrado');

    return this.prisma.personal.create({
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno ?? null,
        cargo: data.cargo, 
        ci: BigInt(data.ci),
        telefono: data.telefono,
        email: data.email,
        salario: data.sueldo, // Traducción de sueldo a salario
        fecha_inicio: new Date(data.fecha_inicio),
        fecha_nacimiento: new Date(data.fecha_nacimiento),
        sexo: data.sexo,
        estatus: true,
      },
    });
  }

  // 🚨 NUEVA FUNCIÓN: Actualizar empleado
  async actualizar(id: bigint, data: any) {
    const empleado = await this.prisma.personal.findUnique({ where: { id } });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    return this.prisma.personal.update({
      where: { id },
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno ?? null,
        cargo: data.cargo,
        telefono: data.telefono,
        email: data.email,
        salario: data.sueldo, // Traducción de sueldo a salario
      },
    });
  }

  // =====================================================================
  // PAGOS (sueldos y anticipos)
  // =====================================================================

  async listarPagos(filtros: ConsultarPagosDto) {
    const pagos = await this.prisma.pago_personal.findMany({
      where: {
        ...(filtros.id_personal && { id_personal: BigInt(filtros.id_personal) }),
        ...(filtros.tipo && { tipo_pago: { nombre: filtros.tipo } }),
        ...((filtros.desde || filtros.hasta) && {
          fecha: {
            ...(filtros.desde && { gte: new Date(filtros.desde) }),
            ...(filtros.hasta && { lte: new Date(filtros.hasta) }),
          },
        }),
      },
      // El contenido del comprobante no se devuelve en el listado
      omit: { comprobante_contenido: true },
      include: {
        tipo_pago: { select: { nombre: true } },
        personal: { select: { nombre: true, apellido_paterno: true, cargo: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });

    return pagos.map((p) => ({ ...p, tiene_comprobante: p.comprobante_nombre !== null }));
  }

  /**
   * Sueldo: un solo pago por empleado y mes; al pagarlo, los anticipos pendientes
   * de ese mes (o anteriores) quedan "Descontado".
   * Anticipo: la suma de anticipos pendientes del mes no puede pasar el 50% del salario.
   */
  async registrarPago(
    dto: RegistrarPagoDto,
    archivo: Express.Multer.File | undefined,
    idUsuario: string,
  ) {
    // ---- Validación de campos ----
    const idPersonal = Number(dto.id_personal);
    if (!Number.isInteger(idPersonal) || idPersonal <= 0) {
      throw new BadRequestException('Selecciona al empleado.');
    }

    const tipoTexto = dto.tipo_pago === 'Pago' ? 'Sueldo' : dto.tipo_pago;
    if (tipoTexto !== 'Sueldo' && tipoTexto !== 'Anticipo') {
      throw new BadRequestException('El tipo de pago debe ser Sueldo o Anticipo.');
    }
    const esAnticipo = tipoTexto === 'Anticipo';

    const monto = Math.round(Number(dto.monto) * 100) / 100;
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0.');
    }

    if (!dto.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(dto.fecha) || isNaN(Date.parse(dto.fecha))) {
      throw new BadRequestException('La fecha es obligatoria (AAAA-MM-DD).');
    }
    if (dto.fecha > new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('La fecha no puede ser futura.');
    }
    const fecha = new Date(dto.fecha);
    const periodo = new Date(`${dto.fecha.slice(0, 7)}-01`);

    if (!METODOS_PAGO.includes(dto.metodo ?? '')) {
      throw new BadRequestException('El método de pago debe ser Efectivo o Transferencia.');
    }

    if (!archivo) throw new BadRequestException('El comprobante de pago es obligatorio.');
    if (!TIPOS_COMPROBANTE.includes(archivo.mimetype)) {
      throw new BadRequestException('Formato no permitido. Solo PDF, JPG, JPEG, PNG.');
    }
    if (archivo.size > COMPROBANTE_MAX_BYTES) {
      throw new BadRequestException('El comprobante supera los 5 MB.');
    }

    // ---- Reglas de negocio ----
    const empleado = await this.prisma.personal.findUnique({ where: { id: BigInt(idPersonal) } });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    if (!empleado.estatus) throw new BadRequestException('El empleado está inactivo.');

    const tipo = await this.prisma.tipo_pago.upsert({
      where: { nombre: tipoTexto },
      update: {},
      create: { nombre: tipoTexto },
    });

    return this.prisma.$transaction(async (tx) => {
      if (esAnticipo) {
        const pendientes = await tx.pago_personal.aggregate({
          _sum: { monto: true },
          where: {
            id_personal: empleado.id,
            id_tipo_pago: tipo.id,
            estado: 'Por descontar',
            periodo,
          },
        });
        const yaAnticipado = Number(pendientes._sum.monto ?? 0);
        const limite = Math.round(Number(empleado.salario) * 0.5 * 100) / 100;
        if (yaAnticipado + monto > limite) {
          const disponible = Math.max(0, limite - yaAnticipado).toFixed(2);
          throw new BadRequestException(
            `Los anticipos del mes no pueden superar el 50% del salario (Bs ${limite.toFixed(2)}). Disponible: Bs ${disponible}.`,
          );
        }
      } else {
        const yaPagado = await tx.pago_personal.findFirst({
          where: { id_personal: empleado.id, id_tipo_pago: tipo.id, periodo },
          select: { id: true },
        });
        if (yaPagado) {
          throw new BadRequestException('El sueldo de ese mes ya fue pagado a este empleado.');
        }
      }

      const nuevo = await tx.pago_personal.create({
        data: {
          id_personal: empleado.id,
          id_tipo_pago: tipo.id,
          monto,
          fecha,
          periodo,
          metodo: dto.metodo!,
          referencia: dto.referencia?.trim() || null,
          estado: esAnticipo ? 'Por descontar' : 'Pagado',
          comprobante_nombre: archivo.originalname,
          comprobante_contenido: Buffer.from(archivo.buffer),
          comprobante_mime: archivo.mimetype,
          comprobante_peso: BigInt(archivo.size),
        },
        omit: { comprobante_contenido: true },
        include: { tipo_pago: { select: { nombre: true } } },
      });

      // Al pagar el sueldo, los anticipos pendientes hasta ese mes se descuentan
      if (!esAnticipo) {
        await tx.pago_personal.updateMany({
          where: {
            id_personal: empleado.id,
            estado: 'Por descontar',
            periodo: { lte: periodo },
          },
          data: { estado: 'Descontado' },
        });
      }

      await registrarAuditoria(tx, {
        tabla: 'pago_personal',
        registroId: nuevo.id,
        accion: 'CREAR',
        despues: nuevo,
        usuarioId: idUsuario,
      });

      return { ...nuevo, tiene_comprobante: true };
    });
  }

  async obtenerComprobante(id: bigint) {
    const pago = await this.prisma.pago_personal.findUnique({
      where: { id },
      select: { comprobante_nombre: true, comprobante_contenido: true, comprobante_mime: true },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (!pago.comprobante_contenido) throw new NotFoundException('Este pago no tiene comprobante');
    return {
      nombre: pago.comprobante_nombre ?? 'comprobante',
      tipo: pago.comprobante_mime ?? 'application/octet-stream',
      contenido: Buffer.from(pago.comprobante_contenido),
    };
  }

  async registrarHistorial(idPersonal: bigint, data: { fecha_inicio: string, fecha_fin?: string }) {
    const empleado = await this.prisma.personal.findUnique({
      where: { id: idPersonal },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    return this.prisma.historial_personal.create({
      data: {
        id_personal: idPersonal,
        fecha_inicio: new Date(data.fecha_inicio),
        fecha_fin: data.fecha_fin ? new Date(data.fecha_fin) : null,
      },
    });
  }
}