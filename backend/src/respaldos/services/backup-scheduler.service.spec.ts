import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  cronJobFrom: vi.fn(),
}));

vi.mock('cron', () => ({
  CronJob: {
    from: mocks.cronJobFrom,
  },
}));

import { BackupSchedulerService } from './backup-scheduler.service.js';

describe('BackupSchedulerService', () => {
  let service: BackupSchedulerService;

  const tareaCron = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  const tareas = new Map<string, typeof tareaCron>();

  const schedulerRegistry = {
    addCronJob: vi.fn((nombre: string, tarea: typeof tareaCron) => {
      tareas.set(nombre, tarea);
    }),
    doesExist: vi.fn((_tipo: string, nombre: string) =>
      tareas.has(nombre),
    ),
    getCronJob: vi.fn((nombre: string) => tareas.get(nombre)!),
    deleteCronJob: vi.fn((nombre: string) => {
      tareas.delete(nombre);
    }),
  };

  const respaldosService = {
    obtenerConfiguracion: vi.fn(),
  };

  const backupExecutorService = {
    generarRespaldo: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tareas.clear();

    respaldosService.obtenerConfiguracion.mockResolvedValue({
      schemaVersion: 1,
      automatico: false,
      frecuencia: 'diaria',
      hora: '02:00',
      zonaHoraria: 'America/La_Paz',
      actualizadoEn: null,
      actualizadoPor: null,
    });

    mocks.cronJobFrom.mockReturnValue(tareaCron);

    service = new BackupSchedulerService(
      schedulerRegistry as never,
      respaldosService as never,
      backupExecutorService as never,
    );
  });

  it('no programa tareas cuando los respaldos automáticos están desactivados', async () => {
    await service.sincronizar();

    expect(mocks.cronJobFrom).not.toHaveBeenCalled();
    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
  });

  it('programa respaldos diarios a la hora configurada', async () => {
    respaldosService.obtenerConfiguracion.mockResolvedValue({
      schemaVersion: 1,
      automatico: true,
      frecuencia: 'diaria',
      hora: '02:30',
      zonaHoraria: 'America/La_Paz',
      actualizadoEn: null,
      actualizadoPor: null,
    });

    await service.sincronizar();

    expect(mocks.cronJobFrom).toHaveBeenCalledWith({
      cronTime: '30 2 * * *',
      onTick: expect.any(Function),
      start: false,
      timeZone: 'America/La_Paz',
    });

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'respaldo-automatico',
      tareaCron,
    );

    expect(tareaCron.start).toHaveBeenCalledOnce();
  });

  it('programa respaldos semanales los domingos', async () => {
    respaldosService.obtenerConfiguracion.mockResolvedValue({
      schemaVersion: 1,
      automatico: true,
      frecuencia: 'semanal',
      hora: '03:15',
      zonaHoraria: 'America/La_Paz',
      actualizadoEn: null,
      actualizadoPor: null,
    });

    await service.sincronizar();

    expect(mocks.cronJobFrom).toHaveBeenCalledWith({
      cronTime: '15 3 * * 0',
      onTick: expect.any(Function),
      start: false,
      timeZone: 'America/La_Paz',
    });

    expect(tareaCron.start).toHaveBeenCalledOnce();
  });

  it('elimina la tarea anterior antes de registrar una nueva', async () => {
    respaldosService.obtenerConfiguracion.mockResolvedValue({
      schemaVersion: 1,
      automatico: true,
      frecuencia: 'diaria',
      hora: '02:00',
      zonaHoraria: 'America/La_Paz',
      actualizadoEn: null,
      actualizadoPor: null,
    });

    await service.sincronizar();

    await service.sincronizar();

    expect(tareaCron.stop).toHaveBeenCalledOnce();
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
      'respaldo-automatico',
    );

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(2);
  });

  it('detiene y elimina la tarea al apagar el módulo', async () => {
    respaldosService.obtenerConfiguracion.mockResolvedValue({
      schemaVersion: 1,
      automatico: true,
      frecuencia: 'diaria',
      hora: '02:00',
      zonaHoraria: 'America/La_Paz',
      actualizadoEn: null,
      actualizadoPor: null,
    });

    await service.sincronizar();

    service.onModuleDestroy();

    expect(tareaCron.stop).toHaveBeenCalledOnce();
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
      'respaldo-automatico',
    );

    expect(tareas.size).toBe(0);
  });
});