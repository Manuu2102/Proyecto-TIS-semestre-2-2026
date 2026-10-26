import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearIngresoDto } from './dto/crear-ingreso.dto.js';
import { ConsultarIngresosDto } from './dto/consultar-ingresos.dto.js';
import { AnularIngresoDto } from './dto/anular-ingreso.dto.js';
import { CajaService } from '../caja/caja.service.js';
import { BancosService } from '../bancos/bancos.service.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { bs, fechaCorta, isoDia, aFecha } from '../lib/formato.js';
import { leerTexto } from '../lib/validacion.js';
import { anularFlujoEnTx, conContexto, leerRegistro, registrarFlujoEnTx } from '../lib/flujo-fondos.js';

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const usuarioSelect = { select: { nombres: true, apellido_paterno: true } } as const;

// Datos que devuelve la API (sin el contenido del comprobante)
const incluir = {
  categoria_movimiento: { select: { id: true, nombre: true, tipo: true } },
  cuenta_bancaria: { select: { id: true, nombre: true, banco: true, numero_cuenta: true } },
  usuario: usuarioSelect,
  usuario_ingreso_id_usuario_anuloTousuario: usuarioSelect,
  movimiento_caja: { select: { numero: true } },
  movimiento_banco: { select: { numero: true } },
} as const;

const nombreDe = (u: { nombres: string; apellido_paterno: string } | null) =>
  u ? `${u.nombres} ${u.apellido_paterno}`.trim() : null;

/**
 * HU-15: ingresos extraordinarios. Al registrar, el dinero entra a caja (efectivo) o a la
 * cuenta bancaria (transferencia o depósito) en la misma transacción; si ese movimiento
 * no se puede generar, el ingreso tampoco se guarda. No se eliminan: se anulan con motivo,
 * revirtiendo caja o banco, y todo queda en auditoría.
 */
@Injectable()
export class IngresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caja: CajaService,
    private readonly bancos: BancosService,
  ) {}

  private formatear(i: {
    comprobante_contenido?: unknown;
    categoria_movimiento: unknown;
    usuario: { nombres: string; apellido_paterno: string };
    usuario_ingreso_id_usuario_anuloTousuario: { nombres: string; apellido_paterno: string } | null;
    movimiento_caja: { numero: string } | null;
    movimiento_banco: { numero: string } | null;
    [k: string]: unknown;
  }) {
    const {
      comprobante_contenido,
      categoria_movimiento,
      cuenta_bancaria,
      usuario,
      usuario_ingreso_id_usuario_anuloTousuario: anulo,
      movimiento_caja,
      movimiento_banco,
      ...resto
    } = i;
    void comprobante_contenido;
    return serialize({
      ...resto,
      // En el schema la relación se llama categoria_movimiento; la API responde "categoria"
      categoria: categoria_movimiento,
      cuenta: cuenta_bancaria ?? null,
      registrado_por: nombreDe(usuario),
      anulado_por: nombreDe(anulo),
      // Movimiento de caja o banco que generó el ingreso
      movimiento: movimiento_caja?.numero ?? movimiento_banco?.numero ?? null,
    });
  }

  async crear(
    dto: CrearIngresoDto,
    archivo: Express.Multer.File | undefined,
    idUsuario: string,
  ) {
    const datos = await leerRegistro(this.prisma, this.bancos, dto as Record<string, unknown>, 'ingreso');

    if (archivo) {
      if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
        throw new BadRequestException('Formato no permitido. Solo PDF, JPG, JPEG, PNG');
      }
      if (archivo.size > TAMANO_MAXIMO) {
        throw new BadRequestException('El archivo supera los 5 MB');
      }
    }

    const { ingreso, movimiento } = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.ingreso.create({
        data: {
          fecha: aFecha(datos.fecha),
          monto: datos.monto,
          id_categoria: datos.idCategoria,
          descripcion: datos.descripcion,
          metodo: datos.metodo,
          id_cuenta: datos.idCuenta,
          id_usuario: idUsuario,
          comprobante_nombre: archivo?.originalname ?? null,
          comprobante_contenido: archivo ? Buffer.from(archivo.buffer) : null,
          comprobante_mime: archivo?.mimetype ?? null,
          comprobante_peso: archivo ? BigInt(archivo.size) : null,
        },
      });

      // HU-15 #6 y #7: el dinero entra a caja o banco en la misma operación
      let movimiento: Awaited<ReturnType<typeof registrarFlujoEnTx>>;
      try {
        movimiento = await registrarFlujoEnTx(tx, { caja: this.caja, bancos: this.bancos }, { tipo: 'ingreso', id: nuevo.id, datos, idUsuario });
      } catch (e) {
        conContexto(e, 'El ingreso no pudo registrarse');
      }

      await registrarAuditoria(tx, {
        tabla: 'ingreso',
        registroId: nuevo.id,
        accion: 'CREAR',
        despues: { ...nuevo, comprobante_contenido: undefined },
        usuarioId: idUsuario,
      });

      return {
        ingreso: await tx.ingreso.findUniqueOrThrow({ where: { id: nuevo.id }, include: incluir }),
        movimiento,
      };
    });

    const destino = movimiento.medio === 'caja' ? 'Caja' : 'Cuenta bancaria';
    return {
      ...this.formatear(ingreso),
      message: `Ingreso registrado por ${bs(datos.monto)}. ${destino}: movimiento ${movimiento.numero}.`,
    };
  }

  async listar(filtros: ConsultarIngresosDto) {
    const ingresos = await this.prisma.ingreso.findMany({
      where: {
        ...((filtros.fecha_desde || filtros.fecha_hasta) && {
          fecha: {
            ...(filtros.fecha_desde && { gte: new Date(filtros.fecha_desde) }),
            ...(filtros.fecha_hasta && { lte: new Date(filtros.fecha_hasta) }),
          },
        }),
        ...(filtros.id_categoria && { id_categoria: BigInt(filtros.id_categoria) }),
        ...(filtros.anulado !== undefined && { anulado: filtros.anulado }),
      },
      include: incluir,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });

    return {
      total: ingresos.length,
      ingresos: ingresos.map((i) => this.formatear(i)),
    };
  }

  /** HU-15 #8: anular con motivo, revertir caja o banco y registrar en auditoría. */
  async anular(id: bigint, dto: AnularIngresoDto, idUsuario: string) {
    const motivo = leerTexto(
      dto.motivo_anulacion ?? dto.motivo,
      'motivo de anulación',
      'El motivo de anulación debe tener entre 10 y 255 caracteres.',
    );

    const ingreso = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.ingreso.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException(`El ingreso #${id} no existe.`);
      if (actual.anulado) {
        const fecha = actual.fecha_anulacion ?? actual.updated_at;
        throw new BadRequestException(`El ingreso #${id} ya fue anulado el ${fechaCorta(isoDia(fecha))}.`);
      }

      const anulado = await tx.ingreso.update({
        where: { id },
        data: {
          anulado: true,
          motivo_anulacion: motivo,
          fecha_anulacion: new Date(),
          id_usuario_anulo: idUsuario,
          updated_at: new Date(),
        },
      });

      try {
        await anularFlujoEnTx(tx, { caja: this.caja, bancos: this.bancos }, { tipo: 'ingreso', id, motivo, idUsuario });
      } catch (e) {
        conContexto(e, 'El ingreso no pudo anularse');
      }

      await registrarAuditoria(tx, {
        tabla: 'ingreso',
        registroId: id,
        accion: 'ANULAR',
        antes: { ...actual, comprobante_contenido: undefined },
        despues: { ...anulado, comprobante_contenido: undefined },
        usuarioId: idUsuario,
      });

      return tx.ingreso.findUniqueOrThrow({ where: { id }, include: incluir });
    });

    return { ...this.formatear(ingreso), message: `Ingreso #${id} anulado.` };
  }
}
