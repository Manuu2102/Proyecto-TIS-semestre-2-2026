import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearDocumentoDto } from './dto/crear-documento.dto.js';
import { ConsultarDocumentosDto } from './dto/consultar-documentos.dto.js';

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class DocumentosService {
  constructor(private prisma: PrismaService) {}

  async crear(
    data: CrearDocumentoDto,
    archivo: Express.Multer.File,
    idUsuario: string,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }

    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException(
        `Formato no permitido. Solo se aceptan: PDF, DOC, DOCX, JPG, JPEG, PNG`,
      );
    }

    if (archivo.size > TAMANO_MAXIMO) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo de 10 MB`,
      );
    }

    const tipo = await this.prisma.tipo_documento.findUnique({
      where: { id: BigInt(data.id_tipo) },
    });
    if (!tipo) {
      throw new NotFoundException(
        `Tipo de documento con id ${data.id_tipo} no encontrado`,
      );
    }

    const documento = await this.prisma.documento.create({
      data: {
        id_tipo: BigInt(data.id_tipo),
        descripcion: data.descripcion,
        nombre_original: archivo.originalname,
        contenido: Buffer.from(archivo.buffer),
        peso_bytes: BigInt(archivo.size),
        mime_type: archivo.mimetype,
        restringido: data.restringido ?? false,
        estatus: true,
        fecha_subida: new Date(),
        id_usuario_subio: idUsuario,
      },
      include: {
        tipo_documento: { select: { nombre: true } },
      },
    });

    return {
      message: 'Documento subido correctamente',
      documento: this.formatearSinContenido(documento),
    };
  }

  async listar(filtros: ConsultarDocumentosDto, idUsuario: string) {
    const where: any = { estatus: true };

    if (filtros.id_tipo) {
      where.id_tipo = BigInt(filtros.id_tipo);
    }

    if (filtros.busqueda) {
      where.descripcion = {
        contains: filtros.busqueda,
        mode: 'insensitive',
      };
    }

    if (filtros.restringido !== undefined) {
      where.restringido = filtros.restringido;
    }

    const documentos = await this.prisma.documento.findMany({
      where,
      include: {
        tipo_documento: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_subida: 'desc' },
    });

    if (documentos.length === 0) {
      return {
        message: 'No se encontraron documentos que coincidan con la búsqueda',
        total: 0,
        documentos: [],
      };
    }

    return {
      total: documentos.length,
      documentos: documentos.map((d) => this.formatearSinContenido(d)),
    };
  }

  async buscarPorId(id: bigint, idUsuario: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
      include: {
        tipo_documento: { select: { id: true, nombre: true } },
        usuario: {
          select: { id: true, nombres: true, apellido_paterno: true },
        },
      },
    });

    if (!documento || !documento.estatus) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }

    if (documento.restringido) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: idUsuario },
        include: {
          rol_usuario: { include: { rol: true } },
        },
      });

      const roles = usuario?.rol_usuario.map((ru) => ru.rol.nombre_rol) ?? [];
      const esAdmin = roles.includes('ADMINISTRADOR');
      const esCreador = documento.id_usuario_subio === idUsuario;

      if (!esAdmin && !esCreador) {
        throw new NotFoundException(
          `Documento con id ${id} no encontrado o no tienes permisos`,
        );
      }
    }

    return this.formatearSinContenido(documento);
  }

  async descargar(id: bigint, idUsuario: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
    });

    if (!documento || !documento.estatus) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }

    if (documento.restringido) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: idUsuario },
        include: {
          rol_usuario: { include: { rol: true } },
        },
      });

      const roles = usuario?.rol_usuario.map((ru) => ru.rol.nombre_rol) ?? [];
      const esAdmin = roles.includes('ADMINISTRADOR');
      const esCreador = documento.id_usuario_subio === idUsuario;

      if (!esAdmin && !esCreador) {
        throw new NotFoundException(
          `No tienes permisos para descargar este documento`,
        );
      }
    }

    return {
      contenido: documento.contenido,
      nombre_original: documento.nombre_original,
      mime_type: documento.mime_type,
      peso_bytes: documento.peso_bytes,
    };
  }

  async eliminar(id: bigint, idUsuario: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
    });

    if (!documento || !documento.estatus) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }

    await this.prisma.documento.update({
      where: { id },
      data: { estatus: false },
    });

    return { message: 'Documento eliminado correctamente' };
  }

  async listarTipos() {
    const tipos = await this.prisma.tipo_documento.findMany({
      orderBy: { id: 'asc' },
    });

    return {
      total: tipos.length,
      tipos: tipos.map((t) => ({
        id: t.id.toString(),
        nombre: t.nombre,
      })),
    };
  }

  private formatearSinContenido(d: any) {
    return {
      ...d,
      id: d.id.toString(),
      id_tipo: d.id_tipo.toString(),
      peso_bytes: d.peso_bytes.toString(),
      contenido: undefined,
      id_usuario_subio: d.id_usuario_subio,
    };
  }
}