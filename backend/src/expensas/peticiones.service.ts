import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ESTADO_EN_REVISION,
  ESTADO_PENDIENTE,
  ESTADO_VENCIDA,
  ExpensasService,
} from './expensas.service.js';
import { ListarPeticionesDto } from './dto/peticion-pago.dto.js';
import { MailService } from '../mail/mail.service.js';
import { correoPagoAprobado, correoPagoRechazado } from './correos-peticion.js';
import { enLaPaz } from './hora-la-paz.js';

const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'];
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024; // 5 MB

const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

/** Valida que el archivo subido sea una imagen png, jpg o webp de hasta 5 MB. */
const validarImagen = (archivo: Express.Multer.File | undefined, campo: string) => {
  if (!archivo) throw new BadRequestException(`Falta la imagen (campo "${campo}")`);
  if (!TIPOS_IMAGEN.includes(archivo.mimetype)) {
    throw new BadRequestException('La imagen debe ser PNG, JPG o WEBP');
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO) {
    throw new BadRequestException('La imagen supera los 5 MB');
  }
  return archivo;
};

const esAdmin = (roles: string[] | undefined) =>
  (roles ?? []).some((r) => r.toUpperCase() === 'ADMINISTRADOR');

// Datos de una petición para los listados: nunca la foto (se pide aparte)
const SELECT_PETICION = {
  id: true,
  id_pago_expensa: true,
  estado: true,
  motivo_rechazo: true,
  fecha_revision: true,
  created_at: true,
  foto_mime: true,
  foto_peso: true,
  pago_expensa: {
    select: {
      id_departamento: true,
      fecha_vencimiento: true,
      monto: true,
      monto_mora: true,
      pago_expensa_extra: { select: { monto: true } },
    },
  },
  usuario_peticion_pago_id_usuarioTousuario: {
    select: { id: true, nombres: true, apellido_paterno: true, apellido_materno: true },
  },
  usuario_peticion_pago_id_usuario_revisorTousuario: {
    select: { id: true, nombres: true, apellido_paterno: true },
  },
} satisfies Prisma.peticion_pagoSelect;

type PeticionListada = Prisma.peticion_pagoGetPayload<{ select: typeof SELECT_PETICION }>;

// Mes cubierto por una deuda ("2026-10"): vence el mes siguiente, en hora de La Paz
const periodoDe = (vencimiento: Date) => {
  const v = enLaPaz(vencimiento);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
};

const nombreCompleto = (u: { nombres: string; apellido_paterno: string; apellido_materno?: string | null }) =>
  [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' ');

@Injectable()
export class PeticionesService {
  private readonly logger = new Logger(PeticionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expensas: ExpensasService,
    private readonly mail: MailService,
  ) {}

  /* ---------------------------------- QR del edificio ---------------------------------- */

  /** Imagen del QR estático del edificio. */
  async obtenerQr() {
    const edificio = await this.prisma.edificio.findFirst({
      orderBy: { id: 'asc' },
      select: { qr_contenido: true, qr_mime: true },
    });
    if (!edificio?.qr_contenido || !edificio.qr_mime) {
      throw new NotFoundException('El edificio aún no tiene un QR de cobro');
    }
    return { contenido: Buffer.from(edificio.qr_contenido), tipo: edificio.qr_mime };
  }

  /** Carga o reemplaza el QR estático del edificio. */
  async guardarQr(archivo: Express.Multer.File | undefined) {
    const imagen = validarImagen(archivo, 'qr');
    const edificio = await this.prisma.edificio.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!edificio) throw new BadRequestException('No hay un edificio registrado');

    const actualizado = await this.prisma.edificio.update({
      where: { id: edificio.id },
      data: {
        qr_contenido: Buffer.from(imagen.buffer),
        qr_mime: imagen.mimetype,
        qr_updated_at: new Date(),
      },
      select: { id: true, qr_mime: true, qr_updated_at: true },
    });
    return serialize(actualizado);
  }

  /* ------------------------------------ Peticiones ------------------------------------ */

  /**
   * El copropietario envía la foto del comprobante de una deuda suya: la petición queda
   * en revisión y la deuda pasa a "en revisión" (no vence ni suma mora hasta que el admin
   * la apruebe o la rechace).
   */
  async crear(idPago: number, archivo: Express.Multer.File | undefined, idUsuario: string) {
    const foto = validarImagen(archivo, 'foto');

    const pago = await this.prisma.pago_expensa.findUnique({
      where: { id: BigInt(idPago) },
      select: { id: true, id_departamento: true, id_estado: true },
    });
    if (!pago) throw new NotFoundException('Deuda no encontrada');

    const ocupa = await this.prisma.departamento_usuario.findFirst({
      where: { id_usuario: idUsuario, id_departamento: pago.id_departamento, estatus: true },
      select: { id: true },
    });
    if (!ocupa) throw new ForbiddenException('Esta deuda no es de tu departamento');

    if (pago.id_estado === ESTADO_EN_REVISION) {
      throw new ConflictException('Esta deuda ya tiene un comprobante en revisión');
    }

    try {
      const peticion = await this.prisma.$transaction(async (tx) => {
        // Solo pendientes (2) y vencidas (4): el filtro evita mandar a revisión una deuda
        // que se pagó o que otra petición tomó mientras tanto
        const { count } = await tx.pago_expensa.updateMany({
          where: { id: pago.id, id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] } },
          data: { id_estado: ESTADO_EN_REVISION },
        });
        if (count === 0) {
          throw new ConflictException('Esta deuda ya está pagada o tiene un comprobante en revisión');
        }

        return tx.peticion_pago.create({
          data: {
            id_pago_expensa: pago.id,
            id_usuario: idUsuario,
            foto: Buffer.from(foto.buffer),
            foto_mime: foto.mimetype,
            foto_peso: BigInt(foto.size),
          },
          select: SELECT_PETICION,
        });
      });
      return this.formatear(peticion);
    } catch (e) {
      // uq_peticion_en_revision: ya hay una petición en revisión para esta deuda
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Esta deuda ya tiene un comprobante en revisión');
      }
      throw e;
    }
  }

  /** Peticiones de todos los departamentos (admin), de la más nueva a la más antigua. */
  async listar(filtros: ListarPeticionesDto) {
    const peticiones = await this.prisma.peticion_pago.findMany({
      where: filtros.estado ? { estado: filtros.estado } : {},
      select: SELECT_PETICION,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    return this.formatearVarias(peticiones);
  }

  /** Peticiones que envió el usuario, de la más nueva a la más antigua. */
  async listarMias(idUsuario: string) {
    const peticiones = await this.prisma.peticion_pago.findMany({
      where: { id_usuario: idUsuario },
      select: SELECT_PETICION,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    return this.formatearVarias(peticiones);
  }

  /** Foto del comprobante: la ve el admin o quien la envió. */
  async obtenerFoto(idPeticion: number, usuario: { id: string; roles?: string[] }) {
    const peticion = await this.prisma.peticion_pago.findUnique({
      where: { id: BigInt(idPeticion) },
      select: { id_usuario: true, foto: true, foto_mime: true },
    });
    if (!peticion) throw new NotFoundException('Petición no encontrada');
    if (!esAdmin(usuario.roles) && peticion.id_usuario !== usuario.id) {
      throw new ForbiddenException('No puedes ver este comprobante');
    }
    return { contenido: Buffer.from(peticion.foto), tipo: peticion.foto_mime };
  }

  /**
   * El admin acepta la foto: la deuda queda pagada con la mora que tenía al enviarse la
   * foto, y se crea su factura (método QR).
   */
  async aprobar(idPeticion: number, idAdmin: string) {
    const peticion = await this.buscarEnRevision(idPeticion);

    const factura = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.peticion_pago.updateMany({
        where: { id: peticion.id, estado: 'en_revision' },
        data: { estado: 'aprobada', id_usuario_revisor: idAdmin, fecha_revision: new Date() },
      });
      if (count === 0) throw new ConflictException('Esta petición ya fue revisada');

      return this.expensas.pagarDeudaEnRevision(
        tx,
        peticion.id_pago_expensa,
        peticion.created_at,
        peticion.id,
        idAdmin,
      );
    });

    const respuesta = await this.obtener(peticion.id);
    // El correo va después de la transacción y sin esperarlo: si falla, el pago sigue aprobado
    void this.avisar(respuesta, (datos) => correoPagoAprobado(datos, factura.id.toString()));
    return respuesta;
  }

  /**
   * El admin rechaza la foto: la deuda vuelve a pendiente y, si su vencimiento ya pasó,
   * queda vencida al momento con toda la mora desde que venció.
   */
  async rechazar(idPeticion: number, motivo: string, idAdmin: string) {
    const peticion = await this.buscarEnRevision(idPeticion);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.peticion_pago.updateMany({
        where: { id: peticion.id, estado: 'en_revision' },
        data: {
          estado: 'rechazada',
          motivo_rechazo: motivo.trim(),
          id_usuario_revisor: idAdmin,
          fecha_revision: new Date(),
        },
      });
      if (count === 0) throw new ConflictException('Esta petición ya fue revisada');

      await tx.pago_expensa.updateMany({
        where: { id: peticion.id_pago_expensa, id_estado: ESTADO_EN_REVISION },
        data: { id_estado: ESTADO_PENDIENTE },
      });
    });

    // Recalcula la mora desde el vencimiento real, sin esperar al cron
    await this.expensas.aplicarVencimientos();

    const respuesta = await this.obtener(peticion.id);
    void this.avisar(respuesta, (datos) => correoPagoRechazado(datos, motivo.trim()));
    return respuesta;
  }

  /** Envía un correo al copropietario que mandó la petición. Nunca lanza errores. */
  private async avisar(
    peticion: Awaited<ReturnType<PeticionesService['obtener']>>,
    armar: (datos: Parameters<typeof correoPagoAprobado>[0]) => ReturnType<typeof correoPagoAprobado>,
  ) {
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: peticion.copropietario.id },
        select: { email: true },
      });
      if (!usuario?.email) return;
      await this.mail.enviar(
        usuario.email,
        armar({
          nombre: peticion.copropietario.nombre,
          departamento: peticion.departamento,
          periodo: peticion.deuda.periodo,
          enviada: peticion.enviada,
          monto: peticion.deuda.monto,
          mora: peticion.deuda.mora,
          total: peticion.deuda.total,
        }),
      );
    } catch (e) {
      this.logger.error(`No se pudo avisar la petición #${peticion.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /* ------------------------------------- Ayudas ------------------------------------- */

  private async buscarEnRevision(idPeticion: number) {
    const peticion = await this.prisma.peticion_pago.findUnique({
      where: { id: BigInt(idPeticion) },
      select: { id: true, id_pago_expensa: true, estado: true, created_at: true },
    });
    if (!peticion) throw new NotFoundException('Petición no encontrada');
    if (peticion.estado !== 'en_revision') {
      throw new ConflictException('Esta petición ya fue revisada');
    }
    return peticion;
  }

  private async obtener(id: bigint) {
    const peticion = await this.prisma.peticion_pago.findUniqueOrThrow({
      where: { id },
      select: SELECT_PETICION,
    });
    return this.formatear(peticion);
  }

  private async formatearVarias(peticiones: PeticionListada[]) {
    const ids = [...new Set(peticiones.map((p) => p.pago_expensa.id_departamento))];
    const departamentos = await this.prisma.departamento.findMany({
      where: { id: { in: ids } },
      select: { id: true, numero: true },
    });
    const numeros = new Map(departamentos.map((d) => [d.id, d.numero]));
    return peticiones.map((p) => this.formatearUna(p, numeros.get(p.pago_expensa.id_departamento)));
  }

  private async formatear(p: PeticionListada) {
    const [respuesta] = await this.formatearVarias([p]);
    return respuesta;
  }

  private formatearUna(p: PeticionListada, numeroDepartamento: number | undefined) {
    const deuda = p.pago_expensa;
    const monto = deuda.pago_expensa_extra.reduce((t, e) => t.plus(e.monto), deuda.monto);
    const copropietario = p.usuario_peticion_pago_id_usuarioTousuario;
    const revisor = p.usuario_peticion_pago_id_usuario_revisorTousuario;
    return {
      id: p.id.toString(),
      id_pago_expensa: p.id_pago_expensa.toString(),
      departamento: numeroDepartamento ?? null,
      estado: p.estado,
      motivo_rechazo: p.motivo_rechazo,
      enviada: p.created_at,
      fecha_revision: p.fecha_revision,
      foto: { mime: p.foto_mime, peso: Number(p.foto_peso) },
      deuda: {
        periodo: periodoDe(deuda.fecha_vencimiento),
        vencimiento: deuda.fecha_vencimiento,
        monto: monto.toNumber(),
        mora: deuda.monto_mora.toNumber(),
        total: monto.plus(deuda.monto_mora).toNumber(),
      },
      copropietario: { id: copropietario.id, nombre: nombreCompleto(copropietario) },
      revisor: revisor ? { id: revisor.id, nombre: nombreCompleto(revisor) } : null,
    };
  }
}
