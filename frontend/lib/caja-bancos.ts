import { api, apiDelete, apiDescargar, apiPatch, apiPost } from "./api";

// =====================================================================
// Tipos que usa la pantalla (antes estaban dentro de page.tsx)
// =====================================================================

export type TipoCaja = "ENTRADA" | "SALIDA";
export type OrigenCaja = "Manual" | "Ingreso" | "Gasto" | "Banco" | "Anulación";
export type Anulacion = { motivo: string; usuario: string; fecha: string; contrario: string };
export type Caja = { abierta: boolean; fecha: string; monto: number };

export type MovCaja = {
  numero: string;
  fecha: string;
  hora: string;
  tipo: TipoCaja;
  monto: number;
  concepto: string;
  origen: OrigenCaja;
  saldoPosterior: number;
  usuario: string;
  anulado?: Anulacion;
  anulaA?: string;
};

export type TipoBanco =
  | "Depósito"
  | "Retiro"
  | "Transferencia recibida"
  | "Transferencia enviada"
  | "Comisión"
  | "Ajuste";
export type OrigenBanco = "Manual" | "QR de expensas" | "Ingreso" | "Gasto" | "Caja";

export type Cuenta = {
  id: number;
  banco: string;
  numero: string;
  titular: string;
  apertura: number;
  activa: boolean;
};

export type MovBanco = {
  numero: string;
  cuentaId: number;
  fecha: string;
  hora: string;
  tipo: TipoBanco;
  monto: number;
  signo: 1 | -1;
  referencia: string;
  concepto: string;
  origen: OrigenBanco;
  saldoPosterior: number;
  usuario: string;
  conciliado: boolean;
  vinculoCaja?: string;
  adjunto?: string | null;
  anulado?: Anulacion;
  anulaA?: string;
};

// =====================================================================
// Forma en que responde el backend (Prisma serializa Decimal/BigInt como string)
// =====================================================================

type UsuarioRaw = { nombres?: string | null; apellido_paterno?: string | null } | null;

type CajaRaw = {
  abierta: boolean;
  fecha_apertura: string | null;
  monto_apertura: string | number | null;
};

type MovCajaRaw = {
  numero: string;
  fecha: string;
  hora: string;
  tipo: string;
  monto: string | number;
  concepto: string;
  origen: string;
  saldo_posterior: string | number;
  anulado: boolean | null;
  motivo_anulacion: string | null;
  anula_a: string | null;
  usuario?: UsuarioRaw;
};

type CuentaRaw = {
  id: string | number;
  nombre: string;
  banco: string;
  numero_cuenta: string;
  tipo_cuenta: string;
  saldo: string | number;
  activa: boolean;
};

type MovBancoRaw = {
  numero: string;
  cuenta_id: string | number;
  fecha: string;
  hora: string;
  tipo: string;
  monto: string | number;
  signo: number;
  referencia: string;
  concepto: string;
  origen: string;
  saldo_posterior: string | number;
  conciliado: boolean | null;
  vinculo_caja: string | null;
  adjunto: string | null;
  anulado: boolean | null;
  motivo_anulacion: string | null;
  anula_a: string | null;
  usuario?: UsuarioRaw;
};

// =====================================================================
// Utilidades de conversión
// =====================================================================

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/** "2026-10-09T00:00:00.000Z" → "2026-10-09" */
const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

/** Acepta "09:10" o un datetime ISO de Prisma ("1970-01-01T09:10:00.000Z") → "09:10" */
function hhmm(v: string | null | undefined) {
  if (!v) return "";
  const s = String(v);
  return s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

function nombreDe(u?: UsuarioRaw) {
  if (!u) return "—";
  return `${u.nombres ?? ""} ${u.apellido_paterno ?? ""}`.trim() || "—";
}

type ConAnulacion = {
  numero: string;
  fecha: string;
  hora: string;
  anulado: boolean | null;
  motivo_anulacion: string | null;
  anula_a: string | null;
  usuario?: UsuarioRaw;
};

/** Arma el objeto `anulado` del original buscando su movimiento contrario (anula_a === numero). */
function datosAnulacion(m: ConAnulacion, contrarios: Map<string, ConAnulacion>): Anulacion | undefined {
  if (!m.anulado) return undefined;
  const c = contrarios.get(m.numero);
  return {
    motivo: m.motivo_anulacion ?? "",
    usuario: c ? nombreDe(c.usuario) : "—",
    fecha: c ? `${fechaCorta(dia(c.fecha))} ${hhmm(c.hora)}` : "",
    contrario: c?.numero ?? "",
  };
}

function indexarContrarios<T extends ConAnulacion>(lista: T[]) {
  const mapa = new Map<string, ConAnulacion>();
  for (const m of lista) if (m.anula_a) mapa.set(m.anula_a, m);
  return mapa;
}

// =====================================================================
// Adaptadores backend → UI
// =====================================================================

function adaptarCaja(c: CajaRaw): Caja {
  return { abierta: c.abierta, fecha: dia(c.fecha_apertura), monto: num(c.monto_apertura) };
}

function adaptarMovsCaja(lista: MovCajaRaw[]): MovCaja[] {
  const contrarios = indexarContrarios(lista);
  return lista.map((m) => ({
    numero: m.numero,
    fecha: dia(m.fecha),
    hora: hhmm(m.hora),
    tipo: m.tipo as TipoCaja,
    monto: num(m.monto),
    concepto: m.concepto,
    origen: m.origen as OrigenCaja,
    saldoPosterior: num(m.saldo_posterior),
    usuario: nombreDe(m.usuario),
    ...(m.anulado ? { anulado: datosAnulacion(m, contrarios) } : {}),
    ...(m.anula_a ? { anulaA: m.anula_a } : {}),
  }));
}

function adaptarCuenta(c: CuentaRaw): Cuenta {
  return {
    id: Number(c.id),
    banco: c.banco,
    numero: c.numero_cuenta,
    titular: c.nombre,
    apertura: num(c.saldo), // en la BD "saldo" es el saldo inicial; el actual se calcula con los movimientos
    activa: c.activa,
  };
}

function adaptarMovsBanco(lista: MovBancoRaw[]): MovBanco[] {
  const contrarios = indexarContrarios(lista);
  return lista.map((m) => ({
    numero: m.numero,
    cuentaId: Number(m.cuenta_id),
    fecha: dia(m.fecha),
    hora: hhmm(m.hora),
    tipo: m.tipo as TipoBanco,
    monto: num(m.monto),
    signo: m.signo === -1 ? -1 : 1,
    referencia: m.referencia,
    concepto: m.concepto,
    origen: m.origen as OrigenBanco,
    saldoPosterior: num(m.saldo_posterior),
    usuario: nombreDe(m.usuario),
    conciliado: Boolean(m.conciliado),
    ...(m.vinculo_caja ? { vinculoCaja: m.vinculo_caja } : {}),
    adjunto: m.adjunto,
    ...(m.anulado ? { anulado: datosAnulacion(m, contrarios) } : {}),
    ...(m.anula_a ? { anulaA: m.anula_a } : {}),
  }));
}

// =====================================================================
// CAJA
// =====================================================================

export async function obtenerCaja(): Promise<Caja> {
  return adaptarCaja(await api<CajaRaw>("/caja"));
}

export async function abrirCaja(monto: number, fecha: string): Promise<Caja> {
  return adaptarCaja(await apiPost<CajaRaw>("/caja/apertura", { monto, fecha }));
}

export async function listarMovCaja(): Promise<MovCaja[]> {
  return adaptarMovsCaja(await api<MovCajaRaw[]>("/caja/movimientos"));
}

export function anularMovCaja(numero: string, motivo: string) {
  return apiPost<unknown>(`/caja/movimientos/${encodeURIComponent(numero)}/anular`, { motivo });
}

/** HU-22: saldo calculado por el backend (el mismo que usa para validar salidas). */
export type SaldoCaja = {
  desde: string;
  fechaCorte: string;
  inicial: number;
  entradas: number;
  salidas: number;
  final: number;
  calculadoEn: string; // ISO
  sinFondos: boolean;
  saldoBajo: boolean;
  montoMinimo: number | null;
  /** Números de los últimos 10 movimientos hasta la fecha de corte */
  ultimos: string[];
};

type SaldoCajaRaw = {
  desde: string;
  fecha_corte: string;
  saldo_inicial: number;
  total_entradas: number;
  total_salidas: number;
  saldo_final: number;
  calculado_en: string;
  sin_fondos: boolean;
  saldo_bajo: boolean;
  monto_minimo: number | null;
  ultimos_movimientos: { numero: string }[];
};

const consultaSaldo = (corte: string, desde?: string) => {
  const q = new URLSearchParams({ corte });
  if (desde) q.set("desde", desde);
  return q;
};

export async function consultarSaldoCaja(corte: string, desde?: string): Promise<SaldoCaja> {
  const r = await api<SaldoCajaRaw>(`/caja/saldo?${consultaSaldo(corte, desde)}`);
  return {
    desde: r.desde,
    fechaCorte: r.fecha_corte,
    inicial: r.saldo_inicial,
    entradas: r.total_entradas,
    salidas: r.total_salidas,
    final: r.saldo_final,
    calculadoEn: r.calculado_en,
    sinFondos: r.sin_fondos,
    saldoBajo: r.saldo_bajo,
    montoMinimo: r.monto_minimo,
    ultimos: r.ultimos_movimientos.map((m) => m.numero),
  };
}

/** HU-22 #9 y #10: el backend genera el PDF (con el nombre del edificio) y el .xlsx. */
export function exportarSaldoCaja(formato: "pdf" | "excel", corte: string, desde?: string) {
  const q = consultaSaldo(corte, desde);
  q.set("formato", formato);
  return apiDescargar(`/caja/saldo/exportar?${q}`, `caja-${corte}.${formato === "pdf" ? "pdf" : "xlsx"}`);
}

// =====================================================================
// CUENTAS BANCARIAS
// =====================================================================

export async function listarCuentas(): Promise<Cuenta[]> {
  const r = await api<{ cuentas: CuentaRaw[] }>("/cuentas-bancarias");
  return r.cuentas.map(adaptarCuenta);
}

export async function crearCuenta(d: {
  banco: string;
  numero: string;
  titular: string;
  apertura: number;
}): Promise<Cuenta> {
  const c = await apiPost<CuentaRaw>("/cuentas-bancarias", {
    nombre: d.titular,
    banco: d.banco,
    numero_cuenta: d.numero,
    tipo_cuenta: "corriente", // el formulario aún no tiene este campo
    saldo: d.apertura,
  });
  return adaptarCuenta(c);
}

export async function actualizarCuenta(
  id: number,
  d: { banco: string; numero: string; titular: string }
): Promise<Cuenta> {
  const c = await apiPatch<CuentaRaw>(`/cuentas-bancarias/${id}`, {
    nombre: d.titular,
    banco: d.banco,
    numero_cuenta: d.numero,
  });
  return adaptarCuenta(c);
}

export function desactivarCuenta(id: number) {
  return apiDelete<unknown>(`/cuentas-bancarias/${id}`);
}

// =====================================================================
// MOVIMIENTOS BANCARIOS
// =====================================================================

export async function listarMovBanco(cuentaId?: number): Promise<MovBanco[]> {
  const query = cuentaId ? `?cuentaId=${cuentaId}` : "";
  return adaptarMovsBanco(await api<MovBancoRaw[]>(`/bancos/movimientos${query}`));
}

export async function crearMovBanco(d: {
  cuentaId: number;
  fecha: string;
  tipo: TipoBanco;
  signo: 1 | -1;
  monto: number;
  referencia: string;
  concepto: string;
}): Promise<MovBanco> {
  const raw = await apiPost<MovBancoRaw>("/bancos/movimientos", d);
  return adaptarMovsBanco([raw])[0];
}

export function anularMovBanco(numero: string, motivo: string) {
  return apiPost<unknown>(`/bancos/movimientos/${encodeURIComponent(numero)}/anular`, { motivo });
}

export function conciliarMovBanco(numero: string) {
  return apiPost<unknown>(`/bancos/movimientos/${encodeURIComponent(numero)}/conciliar`);
}

// =====================================================================
// Carga inicial de toda la pantalla
// =====================================================================

export async function cargarTodo() {
  const [caja, cajaMovs, cuentas, movBanco] = await Promise.all([
    obtenerCaja(),
    listarMovCaja(),
    listarCuentas(),
    listarMovBanco(),
  ]);
  return { caja, cajaMovs, cuentas, movBanco };
}