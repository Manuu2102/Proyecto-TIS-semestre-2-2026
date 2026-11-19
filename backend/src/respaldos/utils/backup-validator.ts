import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export interface BackupValidationResult {
  valido: boolean;
  tamanoBytes: number;
  cantidadEntradas: number;
}

@Injectable()
export class BackupValidator {
  async validarArchivo(
    filePath: string,
  ): Promise<BackupValidationResult> {
    let fileStats;

    try {
      fileStats = await stat(filePath);
    } catch {
      throw new InternalServerErrorException(
        'No se encontró el archivo de respaldo generado.',
      );
    }

    if (!fileStats.isFile() || fileStats.size <= 0) {
      throw new InternalServerErrorException(
        'El archivo de respaldo está vacío o no es válido.',
      );
    }

    const resultado = await this.ejecutarPgRestore(filePath);

    if (!resultado.valido || resultado.cantidadEntradas === 0) {
      throw new InternalServerErrorException(
        'El archivo generado no contiene una estructura de respaldo válida.',
      );
    }

    return {
      valido: true,
      tamanoBytes: fileStats.size,
      cantidadEntradas: resultado.cantidadEntradas,
    };
  }

  private ejecutarPgRestore(
    filePath: string,
  ): Promise<{ valido: boolean; cantidadEntradas: number }> {
    return new Promise((resolve, reject) => {
      const proceso = spawn('pg_restore', ['--list', filePath], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let salida = '';
      let errorSalida = '';
      let finalizado = false;

      proceso.stdout.setEncoding('utf8');
      proceso.stderr.setEncoding('utf8');

      proceso.stdout.on('data', (chunk: string) => {
        salida += chunk;

        if (salida.length > 2_000_000) {
          proceso.kill('SIGKILL');
        }
      });

      proceso.stderr.on('data', (chunk: string) => {
        errorSalida += chunk;

        if (errorSalida.length > 16_000) {
          errorSalida = errorSalida.slice(-16_000);
        }
      });

      proceso.once('error', (error) => {
        if (finalizado) return;
        finalizado = true;

        reject(
          new InternalServerErrorException(
            `No se pudo ejecutar pg_restore: ${error.message}`,
          ),
        );
      });

      proceso.once('close', (codigo) => {
        if (finalizado) return;
        finalizado = true;

        if (codigo !== 0) {
          reject(
            new InternalServerErrorException(
              `pg_restore no pudo validar el respaldo. ${errorSalida.slice(0, 1000)}`,
            ),
          );
          return;
        }

        const entradas = salida
          .split('\n')
          .filter((linea) => /^\s*\d+;\s/.test(linea));

        resolve({
          valido: entradas.length > 0,
          cantidadEntradas: entradas.length,
        });
      });
    });
  }
}