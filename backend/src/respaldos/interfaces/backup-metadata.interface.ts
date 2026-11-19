export type BackupOrigin = 'manual' | 'automatico';

export interface BackupMetadata {
  id: string;
  nombreArchivo: string;
  blobName: string;
  formato: 'custom';
  esquema: 'public';
  creadoEn: string;
  tamanoBytes: number;
  checksumSha256: string;
  origen: BackupOrigin;
  creadoPor: string | null;
  validado: boolean;
}

export interface BackupHistoryDocument {
  schemaVersion: 1;
  respaldos: BackupMetadata[];
}