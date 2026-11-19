import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { AzureBlobService } from './azure-blob.service.js';
import { BackupRetentionService } from './backup-retention.service.js';
import {
  BackupMetadata,
  BackupOrigin,
} from '../interfaces/backup-metadata.interface.js';
import { BackupValidator } from '../utils/backup-validator.js';

@Injectable()
export class BackupExecutorService {
  private readonly logger = new Logger(BackupExecutorService.name);
  private readonly timeoutMs = 15 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly azureBlobService: AzureBlobService,
    private readonly backupValidator: BackupValidator,
    private readonly backupRetentionService: BackupRetentionService,
  ) {}

  /**
   * Genera un respaldo PostgreSQL, lo valida, lo almacena
   * en Azure y registra sus metadatos aplicando la retención.
   */
  async generarRespaldo(
    origen: BackupOrigin,
    usuarioId: string | null = null,
  ): Promise<BackupMetadata> {
    if (!['manual', 'automatico'].includes(origen)) {
      throw new InternalServerErrorException(
        'El origen del respaldo no es válido.',
      );
    }

    const connection = this.obtenerConfiguracionConexion();
    const id = randomUUID();
    const creadoEn = new Date();

    const nombreArchivo =
      `backup-${creadoEn.toISOString().replace(/[:.]/g, '-')}-${id}.dump`;

    const blobName = `backups/${nombreArchivo}`;

    const directorioTemporal = await mkdtemp(
      join(tmpdir(), 'tis-backup-'),
    );

    const filePath = join(directorioTemporal, nombreArchivo);

    let blobSubido = false;

    try {
      this.logger.log(
        `Iniciando respaldo ${id}. Origen: ${origen}.`,
      );

      // 1. Generar el respaldo PostgreSQL.
      await this.ejecutarPgDump(filePath, connection);

      // 2. Validar la estructura del archivo.
      const validacion =
        await this.backupValidator.validarArchivo(filePath);

      // 3. Calcular el checksum SHA-256.
      const checksumSha256 =
        await this.calcularChecksum(filePath);

      // 4. Subir el archivo a Azure Blob Storage.
      await this.azureBlobService.uploadFile(
        blobName,
        filePath,
        'application/octet-stream',
      );

      blobSubido = true;

      // 5. Construir los metadatos del respaldo.
      const metadata: BackupMetadata = {
        id,
        nombreArchivo,
        blobName,
        formato: 'custom',
        esquema: 'public',
        creadoEn: creadoEn.toISOString(),
        tamanoBytes: validacion.tamanoBytes,
        checksumSha256,
        origen,
        creadoPor: usuarioId,
        validado: validacion.valido,
      };

      // 6. Registrar el respaldo y aplicar la retención.
      try {
        await this.backupRetentionService.registrarRespaldo(
          metadata,
        );
      } catch (error) {
        /*
         * Si ocurrió un error durante el registro, comprobamos
         * si Azure llegó a guardar el respaldo en el historial.
         *
         * No eliminamos el archivo si no podemos determinar
         * con certeza si el registro se completó.
         */
        const registrado =
          await this.verificarRegistro(metadata);

        if (registrado === true) {
          this.logger.warn(
            `El respaldo ${id} figura en el historial de Azure a pesar de un error durante el registro.`,
          );

          return metadata;
        }

        if (registrado === false && blobSubido) {
          try {
            await this.azureBlobService.deleteBlob(blobName);

            this.logger.warn(
              `Se eliminó el respaldo ${id} porque no quedó registrado en el historial.`,
            );
          } catch {
            this.logger.error(
              `No fue posible limpiar el respaldo ${id} después de fallar su registro.`,
            );
          }
        } else if (registrado === null) {
          this.logger.error(
            `No se pudo determinar si el respaldo ${id} quedó registrado. Se conserva el archivo para evitar eliminar un respaldo posiblemente referenciado.`,
          );
        }

        throw error;
      }

      this.logger.log(
        `Respaldo ${id} generado, validado, almacenado y registrado correctamente.`,
      );

      return metadata;
    } catch (error) {
      this.logger.error(
        `Falló el proceso de generación del respaldo ${id}.`,
      );

      throw error;
    } finally {
      try {
        await rm(directorioTemporal, {
          recursive: true,
          force: true,
        });
      } catch {
        this.logger.error(
          `No fue posible eliminar el directorio temporal del respaldo ${id}.`,
        );
      }
    }
  }

  /**
   * Comprueba si el respaldo aparece en el historial.
   *
   * true: aparece registrado.
   * false: se confirmó que no aparece.
   * null: no fue posible comprobarlo.
   */
  private async verificarRegistro(
    metadata: BackupMetadata,
  ): Promise<boolean | null> {
    try {
      const historial =
        await this.backupRetentionService.obtenerHistorial();

      return historial.some(
        (respaldo) =>
          respaldo.id === metadata.id &&
          respaldo.blobName === metadata.blobName,
      );
    } catch {
      this.logger.warn(
        `No fue posible verificar el registro del respaldo ${metadata.id}.`,
      );

      return null;
    }
  }

  /**
   * Obtiene y analiza DIRECT_URL sin registrar sus credenciales.
   */
  private obtenerConfiguracionConexion(): {
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
    sslmode: string;
  } {
    const directUrl =
      this.configService.get<string>('DIRECT_URL');

    if (!directUrl) {
      throw new InternalServerErrorException(
        'No está configurada la variable DIRECT_URL.',
      );
    }

    try {
      const parsedUrl = new URL(directUrl);

      if (
        !['postgres:', 'postgresql:'].includes(parsedUrl.protocol)
      ) {
        throw new Error('Protocolo no permitido');
      }

      const host = parsedUrl.hostname;
      const port = parsedUrl.port || '5432';
      const username = decodeURIComponent(parsedUrl.username);
      const password = decodeURIComponent(parsedUrl.password);

      const database = decodeURIComponent(
        parsedUrl.pathname.replace(/^\//, ''),
      );

      if (!host || !username || !password || !database) {
        throw new Error('Faltan parámetros de conexión');
      }

      const sslmode =
        parsedUrl.searchParams.get('sslmode') || 'require';

      return {
        host,
        port,
        username,
        password,
        database,
        sslmode,
      };
    } catch {
      throw new InternalServerErrorException(
        'DIRECT_URL no tiene un formato válido para conectarse a PostgreSQL.',
      );
    }
  }

  /**
   * Ejecuta pg_dump sin utilizar shell ni exponer la contraseña
   * en los argumentos del proceso.
   */
  private ejecutarPgDump(
    filePath: string,
    connection: {
      host: string;
      port: string;
      username: string;
      password: string;
      database: string;
      sslmode: string;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const argumentos = [
        '--no-password',
        '--format=custom',
        '--schema=public',
        '--no-owner',
        '--no-acl',
        `--file=${filePath}`,
        `--host=${connection.host}`,
        `--port=${connection.port}`,
        `--username=${connection.username}`,
        `--dbname=${connection.database}`,
      ];

      const entorno = {
        ...process.env,
        PGPASSWORD: connection.password,
        PGSSLMODE: connection.sslmode,
        PGCONNECT_TIMEOUT: '15',
        PGAPPNAME: 'tis-backup-service',
      };

      const proceso = spawn('pg_dump', argumentos, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: entorno,
      });

      let errorSalida = '';
      let finalizado = false;
      let excedioTiempo = false;

      proceso.stderr.setEncoding('utf8');

      proceso.stderr.on('data', (chunk: string) => {
        errorSalida += chunk;

        if (errorSalida.length > 16_000) {
          errorSalida = errorSalida.slice(-16_000);
        }
      });

      const temporizador = setTimeout(() => {
        excedioTiempo = true;
        proceso.kill('SIGTERM');

        setTimeout(() => {
          if (!finalizado) {
            proceso.kill('SIGKILL');
          }
        }, 10_000);
      }, this.timeoutMs);

      proceso.once('error', () => {
        if (finalizado) return;

        finalizado = true;
        clearTimeout(temporizador);

        reject(
          new InternalServerErrorException(
            'No se pudo iniciar pg_dump. Comprueba que PostgreSQL Client 17 esté instalado.',
          ),
        );
      });

      proceso.once('close', (codigo) => {
        if (finalizado) return;

        finalizado = true;
        clearTimeout(temporizador);

        if (excedioTiempo) {
          reject(
            new InternalServerErrorException(
              'La generación del respaldo superó el tiempo máximo permitido.',
            ),
          );

          return;
        }

        if (codigo !== 0) {
          this.logger.error(
            `pg_dump terminó con código ${codigo}. ${errorSalida.slice(0, 1000)}`,
          );

          reject(
            new InternalServerErrorException(
              'PostgreSQL no pudo generar el respaldo. Revisa la conexión y los permisos.',
            ),
          );

          return;
        }

        resolve();
      });
    });
  }

  /**
   * Calcula SHA-256 mediante streaming para no cargar
   * el archivo completo en memoria.
   */
  private calcularChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.once('error', () => {
        reject(
          new InternalServerErrorException(
            'No fue posible calcular el checksum del respaldo.',
          ),
        );
      });

      stream.once('end', () => {
        resolve(hash.digest('hex'));
      });
    });
  }
}