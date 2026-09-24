import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentosService } from './documentos.service.js';
import { CrearDocumentoDto } from './dto/crear-documento.dto.js';
import { ConsultarDocumentosDto } from './dto/consultar-documentos.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private documentosService: DocumentosService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  @UseInterceptors(FileInterceptor('archivo'))
  crear(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: CrearDocumentoDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }
    return this.documentosService.crear(dto, archivo, idUsuario);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  listar(
    @Query() filtros: ConsultarDocumentosDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.documentosService.listar(filtros, idUsuario);
  }

  @Get('tipos')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  listarTipos() {
    return this.documentosService.listarTipos();
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  buscarPorId(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.documentosService.buscarPorId(BigInt(id), idUsuario);
  }

  @Get(':id/descargar')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  async descargar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') idUsuario: string,
    @Res() res: Response,
  ) {
    const doc = await this.documentosService.descargar(BigInt(id), idUsuario);

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.nombre_original}"`,
    );
    res.setHeader('Content-Length', doc.peso_bytes.toString());
    res.send(doc.contenido);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.documentosService.eliminar(BigInt(id), idUsuario);
  }
}