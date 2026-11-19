import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AzureBlobService } from './azure-blob.service.js';
import {
  BackupConfig,
  BackupConfigDocument,
  UpdateBackupConfigInput,
} from '../interfaces/backup-config.interface.js';

@Injectable()
export class RespaldosService {
  private readonly configBlobName = 'config/scheduler.json';
  private readonly maxIntentosActualizacion = 3;

  private readonly configuracionPredeterminada: BackupConfig = {
    schemaVersion: 1,
    automatico: false,
    frecuencia: 'diaria',
    hora: '02:00',
    zonaHoraria: 'America/La_Paz',
    actualizadoEn: null,
    actualizadoPor: null,
  };

  constructor(
    private readonly azureBlobService: AzureBlobService,
  ) {}

  /**
   * Obtiene la configuración persistida.
   *
   * Si todavía no existe, crea una configuración predeterminada.
   * La creación es condicional para evitar sobrescribir una
   * configuración creada simultáneamente por otra instancia.
   */
  async obtenerConfiguracion(): Promise<BackupConfig> {
    for (
      let intento = 0;
      intento < this.maxIntentosActualizacion;
      intento++
    ) {
      const documento =
        await this.azureBlobService.downloadJsonWithEtag<BackupConfig>(
          this.configBlobName,
        );

      if (documento) {
        return this.validarConfiguracionAlmacenada(documento.data);
      }

      try {
        await this.azureBlobService.uploadJsonConditional(
          this.configBlobName,
          this.configuracionPredeterminada,
          null,
        );

        return { ...this.configuracionPredeterminada };
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      'No fue posible inicializar la configuración de respaldos. Intenta nuevamente.',
    );
  }

  /**
   * Actualiza parcialmente la configuración.
   *
   * Se utiliza ETag para detectar cambios concurrentes.
   * Si otra operación modifica el documento, se vuelve a leer
   * y se aplica nuevamente el cambio solicitado.
   */
  async actualizarConfiguracion(
    cambios: UpdateBackupConfigInput,
    usuarioId: string,
  ): Promise<BackupConfig> {
    this.validarCambios(cambios);

    if (!usuarioId?.trim()) {
      throw new ConflictException(
        'No se pudo identificar al usuario que modifica la configuración.',
      );
    }

    for (
      let intento = 0;
      intento < this.maxIntentosActualizacion;
      intento++
    ) {
      let documento: BackupConfigDocument | null =
        await this.azureBlobService.downloadJsonWithEtag<BackupConfig>(
          this.configBlobName,
        );

      if (!documento) {
        await this.obtenerConfiguracion();
        continue;
      }

      const configuracionActual =
        this.validarConfiguracionAlmacenada(documento.data);

      const nuevaConfiguracion: BackupConfig = {
        ...configuracionActual,
        ...cambios,
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: usuarioId,
      };

      this.validarConfiguracionAlmacenada(nuevaConfiguracion);

      try {
        await this.azureBlobService.uploadJsonConditional(
          this.configBlobName,
          nuevaConfiguracion,
          documento.etag,
        );

        return nuevaConfiguracion;
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      'La configuración está siendo modificada por otra operación. Intenta nuevamente.',
    );
  }

  /**
   * Valida los campos que se reciben para una actualización.
   */
  private validarCambios(
    cambios: UpdateBackupConfigInput,
  ): void {
    if (
      cambios.automatico !== undefined &&
      typeof cambios.automatico !== 'boolean'
    ) {
      throw new ConflictException(
        'El estado de respaldos automáticos debe ser verdadero o falso.',
      );
    }

    if (
      cambios.frecuencia !== undefined &&
      !['diaria', 'semanal'].includes(cambios.frecuencia)
    ) {
      throw new ConflictException(
        'La frecuencia debe ser diaria o semanal.',
      );
    }

    if (cambios.hora !== undefined && !this.esHoraValida(cambios.hora)) {
      throw new ConflictException(
        'La hora debe tener el formato HH:mm y ser válida.',
      );
    }

    if (
      cambios.automatico === undefined &&
      cambios.frecuencia === undefined &&
      cambios.hora === undefined
    ) {
      throw new ConflictException(
        'Debes proporcionar al menos un campo para actualizar.',
      );
    }
  }

  /**
   * Comprueba que la hora esté en formato de 24 horas.
   */
  private esHoraValida(hora: string): boolean {
    if (typeof hora !== 'string') {
      return false;
    }

    const coincidencia = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);

    return coincidencia !== null;
  }

  /**
   * Comprueba la estructura del documento recuperado de Blob Storage.
   */
  private validarConfiguracionAlmacenada(
    configuracion: BackupConfig,
  ): BackupConfig {
    if (
      !configuracion ||
      typeof configuracion !== 'object' ||
      configuracion.schemaVersion !== 1 ||
      typeof configuracion.automatico !== 'boolean' ||
      !['diaria', 'semanal'].includes(configuracion.frecuencia) ||
      !this.esHoraValida(configuracion.hora) ||
      configuracion.zonaHoraria !== 'America/La_Paz' ||
      !(
        configuracion.actualizadoEn === null ||
        (typeof configuracion.actualizadoEn === 'string' &&
          !Number.isNaN(Date.parse(configuracion.actualizadoEn)))
      ) ||
      !(
        configuracion.actualizadoPor === null ||
        typeof configuracion.actualizadoPor === 'string'
      )
    ) {
      throw new InternalServerErrorException(
        'La configuración de respaldos almacenada en Azure tiene una estructura inválida.',
      );
    }

    return configuracion;
  }
}