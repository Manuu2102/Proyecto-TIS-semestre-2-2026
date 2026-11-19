import { createReadStream } from 'node:fs';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobServiceClient,
  ContainerClient,
} from '@azure/storage-blob';

@Injectable()
export class AzureBlobService {
  private readonly logger = new Logger(AzureBlobService.name);

  private credential: DefaultAzureCredential | null = null;
  private containerClientPromise: Promise<ContainerClient> | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async getContainerClient(): Promise<ContainerClient> {
    if (!this.containerClientPromise) {
      this.containerClientPromise = this.initializeContainerClient();
    }

    try {
      return await this.containerClientPromise;
    } catch (error) {
      this.containerClientPromise = null;
      throw error;
    }
  }

  private async initializeContainerClient(): Promise<ContainerClient> {
    const accountName = this.configService
      .get<string>('AZURE_STORAGE_ACCOUNT_NAME')
      ?.trim();

    const containerName = this.configService
      .get<string>('AZURE_STORAGE_CONTAINER_NAME')
      ?.trim();

    if (!accountName || !containerName) {
      throw new InternalServerErrorException(
        'Falta configurar AZURE_STORAGE_ACCOUNT_NAME o AZURE_STORAGE_CONTAINER_NAME',
      );
    }

    if (!/^[a-z0-9]{3,24}$/.test(accountName)) {
      throw new InternalServerErrorException(
        'El nombre de la cuenta de Azure Storage no tiene un formato válido',
      );
    }

    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(containerName)) {
      throw new InternalServerErrorException(
        'El nombre del contenedor de Azure Storage no tiene un formato válido',
      );
    }

    this.credential = new DefaultAzureCredential();

    const accountUrl = `https://${accountName}.blob.core.windows.net`;

    const blobServiceClient = new BlobServiceClient(
      accountUrl,
      this.credential,
    );

    const containerClient =
      blobServiceClient.getContainerClient(containerName);

    const containerExists = await containerClient.exists();

    if (!containerExists) {
      throw new InternalServerErrorException(
        `El contenedor de Azure Storage "${containerName}" no existe o no está disponible`,
      );
    }

    this.logger.log(
      `Conexión con Azure Blob Storage inicializada para el contenedor "${containerName}"`,
    );

    return containerClient;
  }

  private validateBlobName(blobName: string): string {
    const normalizedName = blobName.trim();

    if (
      !normalizedName ||
      normalizedName.startsWith('/') ||
      normalizedName.includes('\\') ||
      normalizedName.split('/').some((segment) => segment === '..') ||
      normalizedName.includes('\0')
    ) {
      throw new InternalServerErrorException(
        'El nombre del archivo en Blob Storage no es válido',
      );
    }

    return normalizedName;
  }

  private isPreconditionFailed(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 412
    );
  }

  async uploadBuffer(
    blobName: string,
    data: Buffer,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blockBlobClient =
      containerClient.getBlockBlobClient(safeBlobName);

    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    this.logger.log(`Archivo almacenado en Blob Storage: ${safeBlobName}`);
  }

  async downloadBuffer(blobName: string): Promise<Buffer | null> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blobClient = containerClient.getBlobClient(safeBlobName);
    const exists = await blobClient.exists();

    if (!exists) {
      return null;
    }

    return blobClient.downloadToBuffer();
  }

  async uploadJson(
    blobName: string,
    data: unknown,
  ): Promise<void> {
    const jsonBuffer = Buffer.from(
      JSON.stringify(data, null, 2),
      'utf-8',
    );

    await this.uploadBuffer(
      blobName,
      jsonBuffer,
      'application/json; charset=utf-8',
    );
  }

  async downloadJson<T>(blobName: string): Promise<T | null> {
    const buffer = await this.downloadBuffer(blobName);

    if (!buffer) {
      return null;
    }

    try {
      return JSON.parse(buffer.toString('utf-8')) as T;
    } catch {
      this.logger.error(
        `No fue posible interpretar el JSON almacenado: ${blobName}`,
      );

      throw new InternalServerErrorException(
        'El archivo almacenado en Azure no contiene un JSON válido',
      );
    }
  }

  /**
   * Descarga un JSON junto con su ETag.
   *
   * La descarga se condiciona al ETag obtenido previamente para
   * evitar leer contenido que haya cambiado entre ambas operaciones.
   */
  async downloadJsonWithEtag<T>(
    blobName: string,
  ): Promise<{ data: T; etag: string } | null> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlobClient(safeBlobName);

    const exists = await blobClient.exists();

    if (!exists) {
      return null;
    }

    try {
      const properties = await blobClient.getProperties();

      if (!properties.etag) {
        throw new InternalServerErrorException(
          'Azure no devolvió el ETag del archivo',
        );
      }

      const response = await blobClient.download(0, undefined, {
        conditions: {
          ifMatch: properties.etag,
        },
      });

      const stream = response.readableStreamBody;

      if (!stream) {
        throw new InternalServerErrorException(
          'Azure no devolvió el contenido del archivo',
        );
      }

      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
        );
      }

      const buffer = Buffer.concat(chunks);

      try {
        return {
          data: JSON.parse(buffer.toString('utf-8')) as T,
          etag: properties.etag,
        };
      } catch {
        this.logger.error(
          `No fue posible interpretar el JSON almacenado: ${safeBlobName}`,
        );

        throw new InternalServerErrorException(
          'El archivo de configuración almacenado en Azure no contiene un JSON válido',
        );
      }
    } catch (error) {
      if (this.isPreconditionFailed(error)) {
        throw new ConflictException(
          'El archivo cambió durante la lectura. Intenta nuevamente.',
        );
      }

      throw error;
    }
  }

  /**
   * Escritura condicional de JSON.
   *
   * expectedEtag = null: crea el archivo solamente si no existe.
   * expectedEtag = valor: actualiza solamente si el ETag coincide.
   */
  async uploadJsonConditional(
    blobName: string,
    data: unknown,
    expectedEtag: string | null,
  ): Promise<void> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blockBlobClient =
      containerClient.getBlockBlobClient(safeBlobName);

    const jsonBuffer = Buffer.from(
      JSON.stringify(data, null, 2),
      'utf-8',
    );

    try {
      await blockBlobClient.uploadData(jsonBuffer, {
        blobHTTPHeaders: {
          blobContentType: 'application/json; charset=utf-8',
        },
        conditions:
          expectedEtag === null
            ? { ifNoneMatch: '*' }
            : { ifMatch: expectedEtag },
      });
    } catch (error) {
      if (this.isPreconditionFailed(error)) {
        throw new ConflictException(
          'La configuración fue modificada por otra operación. Intenta nuevamente.',
        );
      }

      throw error;
    }

    this.logger.log(
      `JSON actualizado mediante escritura condicional: ${safeBlobName}`,
    );
  }

  async blobExists(blobName: string): Promise<boolean> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blobClient = containerClient.getBlobClient(safeBlobName);

    return blobClient.exists();
  }

  async listBlobs(prefix?: string): Promise<string[]> {
    const containerClient = await this.getContainerClient();

    const normalizedPrefix = prefix
      ? this.validateBlobName(prefix)
      : undefined;

    const blobNames: string[] = [];

    for await (const blob of containerClient.listBlobsFlat({
      prefix: normalizedPrefix,
    })) {
      blobNames.push(blob.name);
    }

    return blobNames;
  }

  async deleteBlob(blobName: string): Promise<boolean> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blobClient = containerClient.getBlobClient(safeBlobName);

    const result = await blobClient.deleteIfExists();

    if (result.succeeded) {
      this.logger.log(
        `Archivo eliminado de Blob Storage: ${safeBlobName}`,
      );
    }

    return result.succeeded;
  }

  async uploadFile(
    blobName: string,
    filePath: string,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    const safeBlobName = this.validateBlobName(blobName);
    const containerClient = await this.getContainerClient();

    const blockBlobClient =
      containerClient.getBlockBlobClient(safeBlobName);

    const fileStream = createReadStream(filePath);

    try {
      await blockBlobClient.uploadStream(
        fileStream,
        4 * 1024 * 1024,
        5,
        {
          blobHTTPHeaders: {
            blobContentType: contentType,
          },
        },
      );

      this.logger.log(
        `Archivo cargado mediante streaming en Blob Storage: ${safeBlobName}`,
      );
    } catch {
      fileStream.destroy();

      this.logger.error(
        `Falló la carga del archivo en Blob Storage: ${safeBlobName}`,
      );

      throw new InternalServerErrorException(
        'No fue posible almacenar el respaldo en Azure Blob Storage.',
      );
    }
  }
}