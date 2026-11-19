import { BackupRetentionService } from './services/backup-retention.service.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RespaldosController } from './respaldos.controller.js';

import { AzureBlobService } from './services/azure-blob.service.js';
import { RespaldosService } from './services/respaldos.services.js';
import { BackupExecutorService } from './services/backup-executor.service.js';

import { BackupValidator } from './utils/backup-validator.js';

@Module({
  imports: [ConfigModule],
  controllers: [RespaldosController],
  providers: [
    AzureBlobService,
    RespaldosService,
    BackupExecutorService,
    BackupRetentionService,
    BackupValidator,
  ],
  exports: [
    AzureBlobService,
    RespaldosService,
    BackupExecutorService,
  ],
})
export class RespaldosModule {}