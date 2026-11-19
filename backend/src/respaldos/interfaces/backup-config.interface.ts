export type BackupFrequency = 'diaria' | 'semanal';

export interface BackupConfig {
  schemaVersion: 1;
  automatico: boolean;
  frecuencia: BackupFrequency;
  hora: string;
  zonaHoraria: 'America/La_Paz';
  actualizadoEn: string | null;
  actualizadoPor: string | null;
}

export interface BackupConfigDocument {
  data: BackupConfig;
  etag: string;
}

export interface UpdateBackupConfigInput {
  automatico?: boolean;
  frecuencia?: BackupFrequency;
  hora?: string;
}