import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PeticionesService, TAMANO_MAXIMO_FOTO } from './peticiones.service.js';
import { ExpensasService } from './expensas.service.js';
import { ListarPeticionesDto, RechazarPeticionDto } from './dto/peticion-pago.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

const imagen = (archivo: { contenido: Buffer; tipo: string }) =>
  new StreamableFile(archivo.contenido, { type: archivo.tipo, disposition: 'inline' });

// Multer corta la subida si pasa de 5 MB (un poco de margen para el resto del formulario)
const subida = (campo: string) =>
  FileInterceptor(campo, { limits: { fileSize: TAMANO_MAXIMO_FOTO + 1 } });

/**
 * Pago de expensas por QR: el copropietario paga el QR estático del edificio y envía la
 * foto del comprobante; el admin la aprueba (la deuda queda pagada) o la rechaza.
 * Las rutas sin @Roles son para cualquier usuario con sesión (el copropietario); el
 * servicio comprueba que la deuda o la petición sean suyas.
 */
@Controller('expensas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeticionesController {
  constructor(
    private readonly peticiones: PeticionesService,
    private readonly expensas: ExpensasService,
  ) {}

  /* ---------------------------------- QR del edificio ---------------------------------- */

  /** Imagen del QR de cobro del edificio. */
  @Get('qr')
  async obtenerQr() {
    return imagen(await this.peticiones.obtenerQr());
  }

  /** Carga o reemplaza el QR de cobro (multipart, campo "qr"). */
  @Put('qr')
  @Roles('ADMINISTRADOR')
  @UseInterceptors(subida('qr'))
  guardarQr(@UploadedFile() archivo: Express.Multer.File | undefined) {
    return this.peticiones.guardarQr(archivo);
  }

  /* ---------------------------------- Copropietario ---------------------------------- */

  /** Deudas sin pagar de mis departamentos (con su id, para enviar el comprobante). */
  @Get('mis-deudas')
  misDeudas(@CurrentUser('id') idUsuario: string) {
    return this.expensas.deudasDeUsuario(idUsuario);
  }

  /** Envía la foto del comprobante de una deuda (multipart, campo "foto"). */
  @Post('deudas/:id/comprobante')
  @UseInterceptors(subida('foto'))
  enviarComprobante(
    @Param('id', ParseIntPipe) idPago: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.peticiones.crear(idPago, archivo, idUsuario);
  }

  /** Peticiones que envié. */
  @Get('peticiones/mias')
  listarMias(@CurrentUser('id') idUsuario: string) {
    return this.peticiones.listarMias(idUsuario);
  }

  /** Foto del comprobante (el admin o quien la envió). */
  @Get('peticiones/:id/foto')
  async obtenerFoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: { id: string; roles?: string[] },
  ) {
    return imagen(await this.peticiones.obtenerFoto(id, usuario));
  }

  /* -------------------------------------- Admin -------------------------------------- */

  /** Peticiones de pago: ?estado=en_revision|aprobada|rechazada */
  @Get('peticiones')
  @Roles('ADMINISTRADOR')
  listar(@Query() filtros: ListarPeticionesDto) {
    return this.peticiones.listar(filtros);
  }

  /** Acepta el comprobante: la deuda queda pagada. */
  @Post('peticiones/:id/aprobar')
  @Roles('ADMINISTRADOR')
  aprobar(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') idAdmin: string) {
    return this.peticiones.aprobar(id, idAdmin);
  }

  /** Rechaza el comprobante: la deuda vuelve a pendiente (o vencida, con su mora). */
  @Post('peticiones/:id/rechazar')
  @Roles('ADMINISTRADOR')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarPeticionDto,
    @CurrentUser('id') idAdmin: string,
  ) {
    return this.peticiones.rechazar(id, dto.motivo, idAdmin);
  }
}
