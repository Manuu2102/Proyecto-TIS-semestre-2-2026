/** Monto en bolivianos: 3500 → "Bs. 3.500,00" */
export const formatoBs = (monto: number) =>
  `Bs. ${monto.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-10-09" → "09/10/2026" */
export const fechaCorta = (iso: string) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "";

/** Fecha de hoy en hora local (YYYY-MM-DD). No usa toISOString para evitar el desfase UTC. */
export function hoyISO() {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Quita tildes y pasa a minúsculas, para buscar sin importar acentos. */
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Solo dígitos y un punto decimal, con máximo 2 decimales. Acepta la coma como separador. */
export function soloDecimal(v: string) {
  const limpio = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [entero, ...resto] = limpio.split(".");
  return resto.length === 0 ? entero : `${entero}.${resto.join("").slice(0, 2)}`;
}