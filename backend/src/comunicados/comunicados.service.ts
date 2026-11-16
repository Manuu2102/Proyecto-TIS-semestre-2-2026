import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearComunicadoDto, DestinatariosComunicadoDto } from './dto/crear-comunicado.dto.js';
import { registrarAuditoria } from '../lib/auditoria.js'; // <-- IMPORTAMOS LA AUDITORÍA
import { MailService } from '../mail/mail.service.js';
import { descifrar } from '../lib/cifrado.js';

// Roles que reciben comunicados por correo
const ID_ROL_COPROPIETARIO = BigInt(4);
const ID_ROL_INQUILINO = BigInt(5);

// Correos que se envían a la vez (para no saturar el proveedor)
const ENVIOS_EN_PARALELO = 5;

type Contacto = {
  id: string;
  nombre: string;
  rol: 'Copropietario' | 'Inquilino';
  email: string;
  telefono: string;
};

/** Descifra un dato; si está dañado devuelve vacío en vez de romper el listado. */
const descifrarSeguro = (valor: string | null) => {
  try {
    return descifrar(valor) ?? '';
  } catch {
    return '';
  }
};

const escaparHtml = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Correo del comunicado: el mensaje se escapa y los saltos de línea se respetan. */
function correoComunicado(asunto: string, titulo: string, contenido: string) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#2E2927">
  <h2 style="color:#C83A3A;margin:0 0 16px">${escaparHtml(titulo)}</h2>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px">${escaparHtml(contenido).replace(/\r?\n/g, '<br>')}</p>
  <p style="font-size:12px;color:#8A817B;margin:0">Comunicado oficial de la administración del edificio.</p>
</div>`;
  const texto = `${titulo}\n\n${contenido}\n\nComunicado oficial de la administración del edificio.`;
  return { asunto, html, texto };
}

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  /** Copropietarios e inquilinos activos, con su correo descifrado. */
  async contactos(): Promise<Contacto[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        estatus: true,
        rol_usuario: { some: { id_rol: { in: [ID_ROL_COPROPIETARIO, ID_ROL_INQUILINO] } } },
      },
      select: {
        id: true,
        nombres: true,
        apellido_paterno: true,
        apellido_materno: true,
        email: true,
        telefono: true,
        rol_usuario: { select: { id_rol: true } },
      },
      orderBy: [{ nombres: 'asc' }, { apellido_paterno: 'asc' }],
    });

    return usuarios.map((u) => ({
      id: u.id,
      nombre: [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' '),
      rol: u.rol_usuario.some((r) => r.id_rol === ID_ROL_COPROPIETARIO) ? 'Copropietario' : 'Inquilino',
      email: descifrarSeguro(u.email),
      telefono: descifrarSeguro(u.telefono),
    }));
  }

  /** Contactos a los que va el correo según lo elegido en la pantalla. */
  private async resolverDestinatarios(d: DestinatariosComunicadoDto | undefined) {
    const todos = await this.contactos();
    if (!d || d.modo === 'todos') return todos;
    if (d.modo === 'cargo') return todos.filter((c) => (d.cargos ?? []).includes(c.rol));
    const elegidos = new Set(d.personas ?? []);
    return todos.filter((c) => elegidos.has(c.id));
  }

  /** Envía el comunicado por correo. Nunca lanza: un correo que falla solo se cuenta. */
  private async enviarCorreos(data: CrearComunicadoDto) {
    const destinatarios = await this.resolverDestinatarios(data.destinatarios);
    const conCorreo = destinatarios.filter((c) => c.email.includes('@'));
    const correo = correoComunicado(data.asunto?.trim() || data.titulo, data.titulo, data.contenido);

    let enviados = 0;
    for (let i = 0; i < conCorreo.length; i += ENVIOS_EN_PARALELO) {
      const lote = conCorreo.slice(i, i + ENVIOS_EN_PARALELO);
      const resultados = await Promise.all(lote.map((c) => this.mail.enviar(c.email, correo)));
      enviados += resultados.filter(Boolean).length;
    }

    const resumen = {
      destinatarios: destinatarios.length,
      enviados,
      fallidos: conCorreo.length - enviados,
      sinCorreo: destinatarios.length - conCorreo.length,
    };
    this.logger.log(`Comunicado "${data.titulo}" por correo: ${JSON.stringify(resumen)}`);
    return resumen;
  }

  async crear(data: CrearComunicadoDto, adminId: string) {
    const comunicado = await this.prisma.$transaction(async (tx) => {
      // 1. Creamos el comunicado
      const comunicado = await tx.comunicado.create({
        data: {
          titulo: data.titulo,
          contenido: data.contenido,
          tipo: data.tipo ?? 'Informativo',
          id_usuario: adminId,
        },
      });

      // 2. Registramos en auditoría (Cumple SAE-385)
      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: comunicado.id,
        accion: 'CREAR',
        usuarioId: adminId,
        despues: comunicado,
      });

      return comunicado;
    });

    // El correo se envía después de guardar: si falla, el comunicado igual queda registrado
    const correos = data.enviar_correo ? await this.enviarCorreos(data) : null;
    return { ...comunicado, correos };
  }

  async listar(adminId: string) { // <-- Ahora recibe el adminId para la auditoría
    return this.prisma.$transaction(async (tx) => {
      const comunicados = await tx.comunicado.findMany({
        where: { estatus: true },
        include: {
          usuario: {
            select: { nombres: true, apellido_paterno: true },
          },
        },
        orderBy: { fecha_publicacion: 'desc' },
      });

      // 3. Registramos la consulta en auditoría (Cumple SAE-389)
      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: '0', // No es un registro específico, es una consulta general
        accion: 'ACTUALIZAR', // Usamos ACTUALIZAR porque el tipo 'CONSULTAR' no existe en tu función
        usuarioId: adminId,
        despues: { mensaje: 'El administrador consultó el historial de comunicados' },
      });

      return comunicados;
    });
  }

  async actualizar(id: bigint, data: any, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comunicado = await tx.comunicado.findUnique({ where: { id } });
      if (!comunicado) throw new NotFoundException('Comunicado no encontrado');

      const actualizado = await tx.comunicado.update({
        where: { id },
        data: {
          titulo: data.titulo,
          contenido: data.contenido,
          tipo: data.tipo,
        },
      });

      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: actualizado.id,
        accion: 'ACTUALIZAR',
        usuarioId: adminId,
        antes: comunicado,
        despues: actualizado,
      });

      return actualizado;
    });
  }

  async eliminar(id: bigint, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comunicado = await tx.comunicado.findUnique({ where: { id } });
      if (!comunicado) throw new NotFoundException('Comunicado no encontrado');

      const eliminado = await tx.comunicado.update({
        where: { id },
        data: { estatus: false },
      });

      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: eliminado.id,
        accion: 'DESACTIVAR',
        usuarioId: adminId,
        antes: comunicado,
        despues: eliminado,
      });

      return eliminado;
    });
  }
}