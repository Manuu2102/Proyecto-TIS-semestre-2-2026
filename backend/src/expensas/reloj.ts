/**
 * Reloj de expensas. En uso normal es exactamente `new Date()`.
 * Para pruebas (RELOJ_SIMULADO=true en el .env) se le puede sumar un desfase desde
 * los endpoints /dev/reloj, y así ver vencimientos y moras sin esperar días reales.
 * El desfase vive en memoria: al reiniciar el backend vuelve la hora real.
 */
let desfaseMs = 0;

export const relojSimuladoActivo = () => process.env.RELOJ_SIMULADO === 'true';

/** Hora actual del sistema (simulada si hay desfase). */
export const ahora = () => new Date(Date.now() + desfaseMs);

/** Fija la hora simulada en un instante dado. */
export const fijarHora = (instante: Date) => {
  desfaseMs = instante.getTime() - Date.now();
};

/** Adelanta (o atrasa, con negativo) la hora simulada. */
export const avanzarHora = (ms: number) => {
  desfaseMs += ms;
};

/** Vuelve a la hora real. */
export const reiniciarHora = () => {
  desfaseMs = 0;
};

export const desfaseActual = () => desfaseMs;

const UNIDADES: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000 };

/** "3d", "2h", "30m", "-1d" → milisegundos; null si el texto no es válido. */
export const duracionMs = (texto: string) => {
  const m = /^(-?\d+)([dhm])$/.exec(texto.trim());
  return m ? Number(m[1]) * UNIDADES[m[2]] : null;
};
