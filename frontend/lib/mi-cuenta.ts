// Datos y utilidades de "Mi cuenta" del copropietario: Expensas, Extras y Estado de cuenta.
import { api, apiArchivoUrl, apiPostForm } from "./api";

// =====================================================================
// Tipos (lo que devuelve el backend)
// =====================================================================

export type EstadoDeuda = "pendiente" | "vencida" | "en_revision";

/** GET /expensas/mis-deudas */
export type Deuda = {
  id: string;
  departamento: number;
  periodo: string; // "2026-11"
  vence: string; // "2026-11-10T00:00" (hora de La Paz)
  desglose: { concepto: string; monto: number }[];
  monto: number;
  mora: number;
  total: number;
  estado: EstadoDeuda;
};

/** Expensa ya pagada (historial). */
export type ExpensaPagada = {
  id: string;
  departamento: number;
  periodo: string; // "2026-08"
  vence: string;
  monto: number;
  mora: number;
  pagadoEl: string; // "2026-08-07"
  metodo: string; // "Pago con QR"
};

/**
 * GET /expensas/mis-extras: cargo extra de la administración. Está dentro de una deuda
 * (idDeuda) y se paga junto con ella; conExpensa = esa deuda también lleva la expensa del mes.
 */
export type Extra = {
  id: string;
  idDeuda: string; // deuda a la que se envía el comprobante
  departamento: number;
  concepto: string; // "Consumo de agua"
  periodo: string; // "2026-11"
  conExpensa: boolean;
  emitido: string; // "2026-11-02"
  vence: string; // "2026-11-20T00:00"
  monto: number;
  estado: EstadoDeuda | "pagada";
  pagadoEl?: string;
  metodo?: string;
};

// =====================================================================
// LLAMADAS AL BACKEND
// =====================================================================

// BACKEND: GET /expensas/mis-deudas → deudas sin pagar de mis departamentos (de la más antigua a la más nueva)
export const cargarDeudasApi = () => api<Deuda[]>("/expensas/mis-deudas");

// BACKEND: GET /expensas/mis-pagos → expensas pagadas de mis departamentos (de la más nueva a la más antigua)
export const cargarExpensasPagadasApi = () => api<ExpensaPagada[]>("/expensas/mis-pagos");

// BACKEND: GET /expensas/mis-extras → extras de mis departamentos (del más nuevo al más antiguo)
export const cargarExtrasApi = () => api<Extra[]>("/expensas/mis-extras");

// BACKEND: GET /expensas/mi-saldo → { saldo } a favor (fondos) de mis departamentos
export const cargarSaldoFavorApi = () => api<{ saldo: number }>("/expensas/mi-saldo").then((r) => r.saldo);

// BACKEND: GET /expensas/qr → imagen del QR de cobro del edificio
export const cargarQrApi = () => apiArchivoUrl("/expensas/qr");

// BACKEND: POST /expensas/deudas/{id}/comprobante (multipart, campo "foto")
export const enviarComprobanteApi = (idDeuda: string, foto: File) => {
  const form = new FormData();
  form.append("foto", foto);
  return apiPostForm(`/expensas/deudas/${idDeuda}/comprobante`, form);
};

// =====================================================================
// Utilidades de presentación
// =====================================================================

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11" → "Noviembre 2026" */
export function nombrePeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

/** "2026-11-10..." → "10 nov 2026" */
export function fechaLarga(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return `${dia} ${MESES_CORTOS[mes - 1]} ${anio}`;
}

/** 2380 → "Bs 2.380" */
export function bs(n: number) {
  return "Bs " + n.toLocaleString("es-BO", { maximumFractionDigits: 2 });
}

export const ESTADOS: Record<EstadoDeuda | "pagada", { clase: string; texto: string }> = {
  pendiente: { clase: "status status-warning", texto: "Pendiente" },
  vencida: { clase: "status status-danger", texto: "Vencido" },
  en_revision: { clase: "status status-info", texto: "En revisión" },
  pagada: { clase: "status status-success", texto: "Pagado" },
};

/** Las expensas se pagan en orden: la siguiente es la más antigua que no está en revisión. */
export const siguienteDeuda = (deudas: Deuda[]) => deudas.find((d) => d.estado !== "en_revision") ?? null;

// =====================================================================
// Datos del modal de pago
// =====================================================================

/** Lo que se va a pagar: una expensa o un extra. */
export type PagoAbierto = {
  idDeuda: string;
  titulo: string; // "Pagar expensa"
  subtitulo: string; // "Noviembre 2026 · vence el 10 nov 2026"
  etiquetaMonto: string; // "Deuda de la expensa"
  monto: number;
  mora: number;
  nombre: string; // "Noviembre 2026" (para el aviso de enviado)
  bloqueo?: string; // si llega, no se puede pagar todavía y se muestra este mensaje
};

/** Pago de una expensa. Si hay una más antigua sin pagar, queda bloqueado con el aviso. */
export function pagoDeExpensa(deuda: Deuda, siguiente: Deuda | null, conDepto = false): PagoAbierto {
  const nombre = nombrePeriodo(deuda.periodo);
  return {
    idDeuda: deuda.id,
    titulo: "Pagar expensa",
    subtitulo: `${nombre} · vence el ${fechaLarga(deuda.vence)}${conDepto ? ` · Dpto. ${deuda.departamento}` : ""}`,
    etiquetaMonto: "Deuda de la expensa",
    monto: deuda.monto,
    mora: deuda.mora,
    nombre,
    bloqueo:
      siguiente && siguiente.id !== deuda.id
        ? `Debes pagar primero ${nombrePeriodo(siguiente.periodo)}. Las expensas se pagan en orden, así que todavía no puedes pagar ${nombre}.`
        : undefined,
  };
}

/**
 * Pago de un extra: se paga la deuda en la que está (`deuda`, de mis-deudas).
 * Si esa deuda lleva la expensa del mes, se paga todo junto y sigue el orden de las expensas;
 * si es una deuda solo de extras, se paga aparte.
 */
export function pagoDeExtra(extra: Extra, deuda: Deuda, siguiente: Deuda | null): PagoAbierto {
  const base = pagoDeExpensa(deuda, siguiente);
  return extra.conExpensa
    ? {
        ...base,
        titulo: "Pagar extra",
        subtitulo: `${extra.concepto} · se paga junto con la expensa de ${nombrePeriodo(extra.periodo)}`,
        etiquetaMonto: "Expensa + extras del mes",
      }
    : {
        ...base,
        titulo: "Pagar extra",
        subtitulo: `${extra.concepto} · vence el ${fechaLarga(extra.vence)}`,
        etiquetaMonto: "Monto de los extras",
        nombre: extra.concepto,
        bloqueo: undefined,
      };
}

/** Texto bajo el concepto del extra. */
export const detalleExtra = (extra: Extra) =>
  extra.conExpensa
    ? `Se paga junto con la expensa de ${nombrePeriodo(extra.periodo)}`
    : `Cobro aparte de ${nombrePeriodo(extra.periodo)}`;

export const MUTED = { fontSize: 11, color: "#766E69" } as const;
