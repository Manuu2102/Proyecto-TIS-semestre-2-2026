// Bolivia no usa horario de verano: La Paz está en UTC−4 todo el año
const DESFASE_LA_PAZ = 4 * 3_600_000;

/** El mismo instante con la hora de La Paz en los campos UTC (para leer año, mes, día y hora). */
export const enLaPaz = (instante: Date) => new Date(instante.getTime() - DESFASE_LA_PAZ);

/** Instante de una fecha y hora de La Paz (el mes empieza en 0, como en Date.UTC). */
export const desdeLaPaz = (anio: number, mes: number, dia: number, hora = 0, minuto = 0) =>
  new Date(Date.UTC(anio, mes, dia, hora, minuto) + DESFASE_LA_PAZ);

/** "YYYY-MM-DDTHH:mm" en hora de La Paz. */
export const momentoLaPaz = (instante: Date) => enLaPaz(instante).toISOString().slice(0, 16);

/** "HH:mm" de una columna TIME (Prisma la devuelve como 1970-01-01 en UTC). */
export const horaTexto = (hora: Date) => hora.toISOString().slice(11, 16);

/** Valor para una columna TIME a partir de "HH:mm". */
export const horaDesdeTexto = (texto: string) => {
  const [h, m] = texto.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m));
};

/** Próximo instante en que el reloj de La Paz marca "HH:mm", después de `ahora`. */
export const proximaHoraLaPaz = (hora: string, ahora = new Date()) => {
  const [h, m] = hora.split(':').map(Number);
  const hoy = enLaPaz(ahora);
  const enDias = (n: number) =>
    desdeLaPaz(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + n, h, m);
  const deHoy = enDias(0);
  return deHoy > ahora ? deHoy : enDias(1);
};
