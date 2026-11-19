
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { AzureBlobService } from './azure-blob.service.js';

import {
  BackupHistoryDocument,
  BackupMetadata,
} from '../interfaces/backup-metadata.interface.js';

@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);

  private readonly historyBlobName = 'metadata/historial.json';

  private readonly maxBackups = 5;

  private readonly maxRetries = 5;

  constructor(
    private readonly azureBlobService: AzureBlobService,
  ) {}

  /**
   * Registra un respaldo validado en el historial.
   *
   * Conserva los cinco respaldos ordinarios más recientes.
   * Los archivos antiguos se eliminan después de actualizar
   * correctamente el historial.
   */
  async registrarRespaldo(
    metadata: BackupMetadata,
  ): Promise<BackupMetadata[]> {
    this.validarMetadata(metadata);

    let respaldosEliminados: string[] = [];
    let historialActualizado = false;

    for (let intento = 1; intento <= this.maxRetries; intento++) {
      try {
        const documento =
          await this.azureBlobService.downloadJsonWithEtag<
            BackupHistoryDocument
          >(this.historyBlobName);

        const historial = documento?.data ?? {
          schemaVersion: 1 as const,
          respaldos: [],
        };

        this.validarHistorial(historial);

        const respaldoExistente = historial.respaldos.find(
          (respaldo) =>
            respaldo.id === metadata.id ||
            respaldo.blobName === metadata.blobName,
        );

        if (respaldoExistente) {
          if (
            respaldoExistente.id === metadata.id &&
            respaldoExistente.blobName === metadata.blobName
          ) {
            return historial.respaldos;
          }

          throw new ConflictException(
            'Ya existe un respaldo con el mismo identificador o archivo.',
          );
        }

        const respaldosOrdenados = [
          ...historial.respaldos,
          metadata,
        ].sort(
          (a, b) =>
            new Date(b.creadoEn).getTime() -
            new Date(a.creadoEn).getTime(),
        );

        const respaldosConservados = respaldosOrdenados.slice(
          0,
          this.maxBackups,
        );

        respaldosEliminados = respaldosOrdenados
          .slice(this.maxBackups)
          .map((respaldo) => respaldo.blobName);

        const nuevoHistorial: BackupHistoryDocument = {
          schemaVersion: 1,
          respaldos: respaldosConservados,
        };

        await this.azureBlobService.uploadJsonConditional(
          this.historyBlobName,
          nuevoHistorial,
          documento?.etag ?? null,
        );

        historialActualizado = true;

        this.logger.log(
          `Respaldo registrado correctamente. Total conservado: ${respaldosConservados.length}`,
        );

        break;
      } catch (error) {
        if (error instanceof ConflictException) {
          if (intento === this.maxRetries) {
            throw new ConflictException(
              'No fue posible actualizar el historial debido a modificaciones simultáneas. Intenta nuevamente.',
            );
          }

          this.logger.warn(
            `Conflicto al actualizar el historial. Reintento ${intento}/${this.maxRetries}.`,
          );

          continue;
        }

        throw error;
      }
    }

    if (!historialActualizado) {
      throw new InternalServerErrorException(
        'No fue posible registrar el respaldo en el historial.',
      );
    }

    await this.eliminarRespaldosAntiguos(respaldosEliminados);

    return this.obtenerHistorial();
  }

  /**
   * Devuelve el historial de respaldos ordenado del más reciente
   * al más antiguo.
   */
  async obtenerHistorial(): Promise<BackupMetadata[]> {
    const documento =
      await this.azureBlobService.downloadJsonWithEtag<
        BackupHistoryDocument
      >(this.historyBlobName);

    if (!documento) {
      return [];
    }

    this.validarHistorial(documento.data);

    return [...documento.data.respaldos].sort(
      (a, b) =>
        new Date(b.creadoEn).getTime() -
        new Date(a.creadoEn).getTime(),
    );
  }

  /**
   * Elimina los archivos que ya no forman parte de los cinco
   * respaldos conservados.
   *
   * Si falla la eliminación de un archivo, se registra el error.
   * El historial actualizado no vuelve a incluir ese respaldo.
   */
  private async eliminarRespaldosAntiguos(
    blobNames: string[],
  ): Promise<void> {
    for (const blobName of blobNames) {
      try {
        await this.azureBlobService.deleteBlob(blobName);

        this.logger.log(
          `Respaldo antiguo eliminado: ${blobName}`,
        );
      } catch {
        this.logger.error(
          `No fue posible eliminar el respaldo antiguo: ${blobName}. Se requiere limpieza posterior.`,
        );
      }
    }
  }

  /**
   * Verifica que los metadatos correspondan a un respaldo
   * válido y almacenado dentro del directorio permitido.
   */
  private validarMetadata(metadata: BackupMetadata): void {
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      typeof metadata.id !== 'string' ||
      !metadata.id.trim() ||
      typeof metadata.nombreArchivo !== 'string' ||
      !metadata.nombreArchivo.endsWith('.dump') ||
      typeof metadata.blobName !== 'string' ||
      !metadata.blobName.startsWith('backups/') ||
      metadata.blobName.includes('..') ||
      metadata.blobName.includes('\\') ||
      metadata.formato !== 'custom' ||
      metadata.esquema !== 'public' ||
      typeof metadata.creadoEn !== 'string' ||
      Number.isNaN(Date.parse(metadata.creadoEn)) ||
      !Number.isSafeInteger(metadata.tamanoBytes) ||
      metadata.tamanoBytes <= 0 ||
      !/^[a-f0-9]{64}$/i.test(metadata.checksumSha256) ||
      !['manual', 'automatico'].includes(metadata.origen) ||
      !(
        metadata.creadoPor === null ||
        typeof metadata.creadoPor === 'string'
      ) ||
      metadata.validado !== true
    ) {
      throw new InternalServerErrorException(
        'Los metadatos del respaldo no tienen una estructura válida.',
      );
    }
  }

  /**
   * Comprueba la estructura del historial descargado desde Azure.
   */
  private validarHistorial(
    historial: BackupHistoryDocument,
  ): void {
    if (
      !historial ||
      typeof historial !== 'object' ||
      historial.schemaVersion !== 1 ||
      !Array.isArray(historial.respaldos)
    ) {
      throw new InternalServerErrorException(
        'El historial de respaldos almacenado en Azure no tiene una estructura válida.',
      );
    }

    const ids = new Set<string>();
    const blobNames = new Set<string>();

    for (const respaldo of historial.respaldos) {
      this.validarMetadata(respaldo);

      if (
        ids.has(respaldo.id) ||
        blobNames.has(respaldo.blobName)
      ) {
        throw new InternalServerErrorException(
          'El historial contiene respaldos duplicados.',
        );
      }

      ids.add(respaldo.id);
      blobNames.add(respaldo.blobName);
    }
  }
}