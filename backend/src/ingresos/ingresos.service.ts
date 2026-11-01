import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearIngresoDto } from './dto/crear-ingreso.dto.js';
import { ConsultarIngresosDto } from './dto/consultar-ingresos.dto.js';
import { CajaService } from '../caja/caja.service.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { bs, aFecha } from '../lib/formato.js';
import { conContexto, leerRegistro, registrarFlujoEnTx } from '../lib/flujo-fondos.js';

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
  usuario: usuarioSelect,
  movimiento_caja: { select: { numero: true } },
} as const;

const nombreDe = (u: { nombres: string; apellido_paterno: string } | null) =>
  u ? `${u.nombres} ${u.apellido_paterno}`.trim() : null;

/**
 * HU-15: ingresos extraordinarios. Al registrar, el dinero entra a caja en la misma
 * transacción; si ese movimiento no se puede generar, el ingreso tampoco se guarda.
 * Queda registrado en auditoría.
 */
@Injectable()
export class IngresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caja: CajaService,
  ) {}

  private formatear(i: {
    comprobante_contenido?: unknown;
    categoria_movimiento: unknown;
    usuario: { nombres: string; apellido_paterno: string };
    movimiento_caja: { numero: string } | null;
    [k: string]: unknown;
  }) {
    const {
      comprobante_contenido,
      categoria_movimiento,
      usuario,
      movimiento_caja,
      ...resto
    } = i;
    void comprobante_contenido;
    return serialize({
      ...resto,
      // En el schema la relación se llama categoria_movimiento; la API responde "categoria"
      categoria: categoria_movimiento,
      registrado_por: nombreDe(usuario),
      // Movimiento de caja que generó el ingreso
      movimiento: movimiento_caja?.numero ?? null,
    });
  }

  async crear(
    dto: CrearIngresoDto,
    archivo: Express.Multer.File | undefined,
    idUsuario: string,
  ) {
    const datos = await leerRegistro(this.prisma, dto as Record<string, unknown>, 'ingreso');

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
          id_usuario: idUsuario,
          comprobante_nombre: archivo?.originalname ?? null,
          comprobante_contenido: archivo ? Buffer.from(archivo.buffer) : null,
          comprobante_mime: archivo?.mimetype ?? null,
          comprobante_peso: archivo ? BigInt(archivo.size) : null,
        },
      });

      // HU-15 #6 y #7: el dinero entra a caja en la misma operación
      let movimiento: Awaited<ReturnType<typeof registrarFlujoEnTx>>;
      try {
        movimiento = await registrarFlujoEnTx(tx, this.caja, { tipo: 'ingreso', id: nuevo.id, datos, idUsuario });
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

    return {
      ...this.formatear(ingreso),
      message: `Ingreso registrado por ${bs(datos.monto)}. Caja: movimiento ${movimiento.numero}.`,
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
      },
      // El contenido del comprobante no se devuelve: no se lee de la BD
      omit: { comprobante_contenido: true },
      include: incluir,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });

    return {
      total: ingresos.length,
      ingresos: ingresos.map((i) => this.formatear(i)),
    };
  }
}
