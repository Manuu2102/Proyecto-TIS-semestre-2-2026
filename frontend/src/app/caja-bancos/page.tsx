"use client";

/**
 * Caja y bancos (EP-04)
 * ----------------------------------------------------------------------------
 * HU-22  Consultar saldo de caja        → pestaña "Saldo de caja"
 * HU-20  Registrar movimiento de caja   → pestaña "Movimientos de caja"
 * HU-21  Registrar movimiento bancario  → pestañas "Cuentas bancarias" y
 *                                         "Movimientos bancarios"
 *
 * Permisos de interfaz:
 *   - Administrador:        consulta y opera.
 *   - Directorio y Consulta: solo consulta (sin formularios ni acciones).
 *   - Demás roles:           acceso denegado.
 * Los permisos también deben validarse en el backend.
 *
 * Datos: simulados dentro de este archivo. Cada punto de integración está
 * marcado con "BACKEND:" e indica el endpoint esperado.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { BuildingIcon, CheckIcon, FileIcon, PlusIcon, WalletIcon } from "../../../components/Icons";

// =====================================================================
// 1. TIPOS
// =====================================================================

type Vista = "saldo" | "caja" | "cuentas" | "bancos";
type TipoCaja = "ENTRADA" | "SALIDA";
type OrigenCaja = "Manual" | "Ingreso" | "Gasto" | "Banco" | "Anulación";
type Aviso = { tipo: "ok" | "error"; texto: string };
type Anulacion = { motivo: string; usuario: string; fecha: string; contrario: string };

type Caja = { abierta: boolean; fecha: string; monto: number };

type MovCaja = {
  numero: string; // CAJ-AAAA-000001
  fecha: string; // AAAA-MM-DD
  hora: string;
  tipo: TipoCaja;
  monto: number;
  concepto: string;
  origen: OrigenCaja;
  saldoPosterior: number;
  usuario: string;
  anulado?: Anulacion; // presente cuando el movimiento fue anulado
  anulaA?: string; // presente en el movimiento contrario que genera una anulación
};

type TipoBanco = "Depósito" | "Retiro" | "Transferencia recibida" | "Transferencia enviada" | "Comisión" | "Ajuste";
type OrigenBanco = "Manual" | "QR de expensas" | "Ingreso" | "Gasto" | "Caja";

type Cuenta = { id: number; banco: string; numero: string; titular: string; apertura: number; activa: boolean };

type MovBanco = {
  numero: string; // BAN-AAAA-000001
  cuentaId: number;
  fecha: string;
  hora: string;
  tipo: TipoBanco;
  monto: number;
  signo: 1 | -1; // +1 incrementa el saldo, -1 lo disminuye
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

type BancosProps = {
  esAdmin: boolean;
  caja: Caja;
  cajaMovs: MovCaja[];
  setCajaMovs: React.Dispatch<React.SetStateAction<MovCaja[]>>;
  cuentas: Cuenta[];
  setCuentas: React.Dispatch<React.SetStateAction<Cuenta[]>>;
  movBanco: MovBanco[];
  setMovBanco: React.Dispatch<React.SetStateAction<MovBanco[]>>;
  irACaja: () => void;
};

type NuevoMovCaja = { fecha: string; tipo: TipoCaja; monto: number; concepto: string; origen: OrigenCaja };

type ResultadoSaldo = {
  inicial: number;
  entradas: number;
  salidas: number;
  final: number;
  calculadoEn: string;
  periodo: MovCaja[];
  ultimos: MovCaja[];
};

type FormMovimiento = { fecha: string; tipo: "" | TipoCaja; monto: string; concepto: string };

// =====================================================================
// 2. CONSTANTES
// =====================================================================

const POR_PAGINA = 8;
const ORIGENES_CAJA: OrigenCaja[] = ["Manual", "Ingreso", "Gasto", "Banco", "Anulación"];

/** true → fuerza el estado de error de la consulta de saldo para probar el botón "Reintentar". */
const FALLA_SIMULADA = false;

const MUTED = { fontSize: 11, color: "#766E69" } as const;
const FILA = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #F1ECE8", fontSize: 13 } as const;
const BTN_SM = { padding: "6px 10px", fontSize: 11 } as const;
const ERR = { color: "#9F2727", fontSize: 11, marginTop: 4 } as const;
const AVISO = { background: "#fbf1df", color: "#a16d25", border: "1px solid #f0dcb4" };

// =====================================================================
// 3. DATOS DE EJEMPLO (los reemplaza el backend)
// =====================================================================

/** BACKEND: GET /caja */
const CAJA_INICIAL: Caja = { abierta: true, fecha: "2026-08-01", monto: 2000 };

/** BACKEND: GET /caja/movimientos. Coherente con /ingresos-egresos (movimientos en efectivo). */
const CAJA_MOVS_INICIALES: MovCaja[] = [
  { numero: "CAJ-2026-000001", fecha: "2026-08-05", hora: "09:10", tipo: "ENTRADA", monto: 1500, concepto: "Retiro desde la cuenta bancaria", origen: "Banco", saldoPosterior: 3500, usuario: "Administrador" },
  { numero: "CAJ-2026-000002", fecha: "2026-08-20", hora: "17:40", tipo: "ENTRADA", monto: 300, concepto: "Alquiler del salón de eventos", origen: "Ingreso", saldoPosterior: 3800, usuario: "Administrador" },
  { numero: "CAJ-2026-000003", fecha: "2026-09-10", hora: "15:20", tipo: "SALIDA", monto: 180, concepto: "Insumos de limpieza", origen: "Gasto", saldoPosterior: 3620, usuario: "Administrador" },
  { numero: "CAJ-2026-000004", fecha: "2026-09-14", hora: "19:05", tipo: "ENTRADA", monto: 150, concepto: "Multa por ruido fuera de horario", origen: "Ingreso", saldoPosterior: 3770, usuario: "Administrador" },
  { numero: "CAJ-2026-000005", fecha: "2026-09-18", hora: "11:30", tipo: "SALIDA", monto: 200, concepto: "Compra de útiles de oficina", origen: "Manual", saldoPosterior: 3570, usuario: "Administrador" },
  { numero: "CAJ-2026-000006", fecha: "2026-10-02", hora: "08:45", tipo: "SALIDA", monto: 450, concepto: "Compra de repuestos para la bomba de agua", origen: "Manual", saldoPosterior: 3120, usuario: "Administrador" },
  { numero: "CAJ-2026-000007", fecha: "2026-10-08", hora: "08:10", tipo: "ENTRADA", monto: 250, concepto: "Ingreso registrado por error", origen: "Ingreso", saldoPosterior: 3370, usuario: "Administrador", anulado: { motivo: "Registrado por error: el monto correspondía a otro edificio.", usuario: "Administrador", fecha: "09/10/2026 08:40", contrario: "CAJ-2026-000008" } },
  { numero: "CAJ-2026-000008", fecha: "2026-10-09", hora: "08:40", tipo: "SALIDA", monto: 250, concepto: "Anulación de CAJ-2026-000007", origen: "Anulación", saldoPosterior: 3120, usuario: "Administrador", anulaA: "CAJ-2026-000007" },
];

/** BACKEND: GET /cuentas-bancarias */
const CUENTAS_INICIALES: Cuenta[] = [
  { id: 1, banco: "Banco Nacional de Bolivia", numero: "1000-123456", titular: "Edificio Central", apertura: 12170, activa: true },
  { id: 2, banco: "Banco Mercantil Santa Cruz", numero: "4020-998877", titular: "Edificio Central", apertura: 5200, activa: true },
];

/** BACKEND: GET /bancos/movimientos. Montos QR calculados con las tarifas A=400, B=450, C=500. */
const MOV_BANCO_INICIALES: MovBanco[] = [
  { numero: "BAN-2026-000001", cuentaId: 1, fecha: "2026-08-05", hora: "09:00", tipo: "Retiro", monto: 1500, signo: -1, referencia: "RET-0001", concepto: "Retiro hacia caja (CAJ-2026-000001)", origen: "Manual", saldoPosterior: 10670, usuario: "Administrador", conciliado: true, vinculoCaja: "CAJ-2026-000001" },
  { numero: "BAN-2026-000002", cuentaId: 1, fecha: "2026-08-12", hora: "10:15", tipo: "Transferencia enviada", monto: 1200, signo: -1, referencia: "TRF-0812", concepto: "Reparación de ascensor", origen: "Gasto", saldoPosterior: 9470, usuario: "Administrador", conciliado: true },
  { numero: "BAN-2026-000003", cuentaId: 1, fecha: "2026-08-31", hora: "18:00", tipo: "Depósito", monto: 2650, signo: 1, referencia: "QR-AGO", concepto: "Pagos por QR de expensas de agosto", origen: "QR de expensas", saldoPosterior: 12120, usuario: "Sistema", conciliado: true },
  { numero: "BAN-2026-000004", cuentaId: 1, fecha: "2026-09-05", hora: "11:02", tipo: "Transferencia enviada", monto: 620, signo: -1, referencia: "TRF-0905", concepto: "Electricidad de áreas comunes", origen: "Gasto", saldoPosterior: 11500, usuario: "Administrador", conciliado: true },
  { numero: "BAN-2026-000005", cuentaId: 1, fecha: "2026-09-22", hora: "16:30", tipo: "Transferencia enviada", monto: 900, signo: -1, referencia: "TRF-0922", concepto: "Servicio de vigilancia", origen: "Gasto", saldoPosterior: 10600, usuario: "Administrador", conciliado: true },
  { numero: "BAN-2026-000006", cuentaId: 1, fecha: "2026-09-30", hora: "18:00", tipo: "Depósito", monto: 2700, signo: 1, referencia: "QR-SEP", concepto: "Pagos por QR de expensas de septiembre", origen: "QR de expensas", saldoPosterior: 13300, usuario: "Sistema", conciliado: true },
  { numero: "BAN-2026-000007", cuentaId: 1, fecha: "2026-10-04", hora: "10:20", tipo: "Depósito", monto: 500, signo: 1, referencia: "QR-1001", concepto: "Pago QR · Dpto. 301", origen: "QR de expensas", saldoPosterior: 13800, usuario: "Sistema", conciliado: false },
  { numero: "BAN-2026-000008", cuentaId: 1, fecha: "2026-10-06", hora: "09:15", tipo: "Depósito", monto: 400, signo: 1, referencia: "QR-1002", concepto: "Pago QR · Dpto. 102", origen: "QR de expensas", saldoPosterior: 14200, usuario: "Sistema", conciliado: false },
  { numero: "BAN-2026-000009", cuentaId: 1, fecha: "2026-10-06", hora: "09:30", tipo: "Depósito", monto: 500, signo: 1, referencia: "DEP-1006", concepto: "Aporte para jardinería", origen: "Ingreso", saldoPosterior: 14700, usuario: "Administrador", conciliado: false },
  { numero: "BAN-2026-000010", cuentaId: 1, fecha: "2026-10-08", hora: "12:00", tipo: "Depósito", monto: 300, signo: 1, referencia: "QR-ANT-0001", concepto: "Pago anticipado QR · Dpto. 101", origen: "QR de expensas", saldoPosterior: 15000, usuario: "Sistema", conciliado: false },
];

// =====================================================================
// 4. UTILIDADES
// =====================================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}
function esperar(ms: number) {
  return new Promise<void>((resolver) => setTimeout(resolver, ms));
}
function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function horaTxt() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function ahoraTxt() {
  return `${fechaCorta(hoyISO())} ${horaTxt()}`;
}
function diaAnterior(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(a, m - 1, d - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}
function readNombre(): string {
  if (typeof window === "undefined") return "Administrador";
  return sessionStorage.getItem("nombreUsuario") || "Administrador";
}
function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
function imprimirHtml(titulo: string, cuerpo: string) {
  const ventana = window.open("", "_blank", "width=900,height=700");
  if (!ventana) {
    alert("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.");
    return;
  }
  ventana.document.write(
    `<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}h2{margin:0 0 8px}p{margin:4px 0}</style></head><body>${cuerpo}</body></html>`
  );
  ventana.document.close();
  ventana.focus();
  ventana.print();
}
function aCsv(filas: (string | number)[][]) {
  return filas.map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

// =====================================================================
// 5. MENSAJES
// =====================================================================

const MENSAJES = {
  cajaSinAbrir: "La caja aún no ha sido abierta.",
  cajaSinAbrirAdmin: "La caja aún no ha sido abierta. Regístrate para empezar a usarla.",
  cajaYaAbierta: (fecha: string) => `La caja ya fue abierta el ${fechaCorta(fecha)}.`,
  campoObligatorio: (campo: string) => `El campo ${campo} es obligatorio.`,
  montoMayorCero: "El monto debe ser mayor a 0.",
  montoNegativo: "El monto inicial no puede ser negativo.",
  montoNoNumerico: "Ingresa un monto numérico válido.",
  montoDecimales: "El monto admite como máximo 2 decimales.",
  conceptoLongitud: "El concepto debe tener entre 10 y 255 caracteres.",
  motivoLongitud: "El motivo debe tener entre 10 y 255 caracteres.",
  motivoObligatorio: "El motivo de anulación es obligatorio.",
  salidaExcede: (saldo: number) => `El monto supera el saldo de caja (${bs(saldo)}).`,
  saldoInsuficiente: (disponible: number, monto: number) =>
    `Saldo insuficiente en caja. Disponible: ${bs(disponible)}; la salida es de ${bs(monto)}.`,
  confirmarMovimiento: (tipo: TipoCaja, monto: number) =>
    `¿Registrar ${tipo === "ENTRADA" ? "entrada" : "salida"} de caja por ${bs(monto)}?`,
  saldoDespues: (saldo: number) => `Saldo después del movimiento: ${bs(saldo)}`,
  movimientoRegistrado: (numero: string, saldo: number) => `Movimiento ${numero} registrado. Saldo de caja: ${bs(saldo)}.`,
  confirmarAnulacion: (numero: string, monto: number, saldo: number) =>
    `¿Anular el movimiento ${numero} de ${bs(monto)}? Se creará un movimiento contrario y el saldo de caja será ${bs(saldo)}.`,
  movimientoAnulado: (numero: string) => `Movimiento ${numero} anulado.`,
  anulacionNegativa: (numero: string, saldo: number) =>
    `No se puede anular el movimiento ${numero}: la caja quedaría en ${bs(saldo)}.`,
  yaAnulado: (numero: string, fecha: string) => `El movimiento ${numero} ya fue anulado el ${fecha}.`,
  sinResultados: "No hay movimientos de caja que coincidan con los filtros aplicados.",
  sinDatosExportar: "No hay datos para exportar.",
  cargandoSaldo: "Cargando saldo de caja…",
  errorSaldo: "No se pudo obtener el saldo de caja. Intenta nuevamente.",
  corteFutura: "La fecha de corte no puede ser posterior a hoy.",
  corteAnterior: (apertura: string) =>
    `La fecha de corte no puede ser anterior a la apertura de caja (${fechaCorta(apertura)}).`,
};

// =====================================================================
// 6. VALIDACIONES
// =====================================================================

function validarMonto(texto: string, campo: string, permitirCero = false): { valor: number | null; error: string } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return { valor: null, error: MENSAJES.campoObligatorio(campo) };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { valor: null, error: MENSAJES.montoNoNumerico };
  const n = Number(t);
  if (permitirCero ? n < 0 : n <= 0) {
    return { valor: null, error: permitirCero ? MENSAJES.montoNegativo : MENSAJES.montoMayorCero };
  }
  if ((t.split(".")[1]?.length ?? 0) > 2) return { valor: null, error: MENSAJES.montoDecimales };
  return { valor: n, error: "" };
}
function validarConcepto(valor: string) {
  const largo = valor.trim().length;
  if (largo === 0) return MENSAJES.campoObligatorio("concepto");
  return largo < 10 || largo > 255 ? MENSAJES.conceptoLongitud : "";
}
function validarMotivo(valor: string) {
  const largo = valor.trim().length;
  if (largo === 0) return MENSAJES.motivoObligatorio;
  return largo < 10 || largo > 255 ? MENSAJES.motivoLongitud : "";
}

// =====================================================================
// 7. SIMULACIÓN DEL BACKEND (se reemplaza por los fetch reales)
// =====================================================================

/** Un movimiento anulado y su contrario no forman parte del saldo. */
const esVigente = (m: MovCaja) => !m.anulado && !m.anulaA;

function saldoVigente(montoInicial: number, movs: MovCaja[], hasta?: string) {
  const suma = movs
    .filter((m) => esVigente(m) && (!hasta || m.fecha <= hasta))
    .reduce((s, m) => s + (m.tipo === "ENTRADA" ? m.monto : -m.monto), 0);
  return r2(montoInicial + suma);
}
function siguienteNumero(prefijo: "CAJ" | "BAN", existentes: string[]) {
  const mayor = existentes.reduce((max, n) => Math.max(max, Number(n.split("-")[2]) || 0), 0);
  return `${prefijo}-${new Date().getFullYear()}-${String(mayor + 1).padStart(6, "0")}`;
}
const masRecientes = (a: MovCaja, b: MovCaja) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero);
const masAntiguos = (a: MovCaja, b: MovCaja) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero);

async function abrirCajaApi(monto: number, fecha: string, caja: Caja): Promise<Caja> {
  await esperar(800);
  // BACKEND: POST /caja/apertura  { monto, fecha }
  //   403 → "Acceso denegado. Solo el administrador puede abrir la caja."
  if (caja.abierta) throw new Error(MENSAJES.cajaYaAbierta(caja.fecha));
  return { abierta: true, fecha, monto };
}

async function registrarMovCajaApi(nuevo: NuevoMovCaja, caja: Caja, movs: MovCaja[]): Promise<MovCaja> {
  await esperar(900);
  // BACKEND: POST /caja/movimientos  { fecha, tipo, monto, concepto }
  //   403 → "Acceso denegado."  ·  422 → mensaje del servidor  ·  5xx → "Fallo del servicio. Intenta nuevamente."
  if (!caja.abierta) throw new Error("La caja aún no ha sido abierta. Regístrate primero con el monto inicial.");
  if (nuevo.fecha < caja.fecha) throw new Error("La fecha del movimiento no puede ser anterior a la apertura de caja.");
  if (nuevo.fecha > hoyISO()) throw new Error("La fecha del movimiento no puede ser posterior a la fecha actual.");
  const saldo = saldoVigente(caja.monto, movs);
  if (nuevo.tipo === "SALIDA" && nuevo.monto > saldo) throw new Error(MENSAJES.saldoInsuficiente(saldo, nuevo.monto));
  return {
    numero: siguienteNumero("CAJ", movs.map((m) => m.numero)),
    fecha: nuevo.fecha,
    hora: horaTxt(),
    tipo: nuevo.tipo,
    monto: nuevo.monto,
    concepto: nuevo.concepto,
    origen: nuevo.origen,
    saldoPosterior: r2(saldo + (nuevo.tipo === "ENTRADA" ? nuevo.monto : -nuevo.monto)),
    usuario: readNombre(),
  };
}

async function anularMovCajaApi(numero: string, motivo: string, caja: Caja, movs: MovCaja[]) {
  await esperar(800);
  // BACKEND: POST /caja/movimientos/{numero}/anular  { motivo }
  //   Crea el movimiento contrario y registra la operación en auditoría.
  const mov = movs.find((x) => x.numero === numero);
  if (!mov) throw new Error("El movimiento no existe.");
  if (mov.anulado) throw new Error(MENSAJES.yaAnulado(mov.numero, mov.anulado.fecha.slice(0, 10)));
  if (mov.origen !== "Manual") {
    throw new Error(`El movimiento ${mov.numero} fue generado por ${mov.origen}. Anúlalo desde su registro de origen.`);
  }
  const resultante = r2(saldoVigente(caja.monto, movs) + (mov.tipo === "ENTRADA" ? -mov.monto : mov.monto));
  if (resultante < 0) throw new Error(MENSAJES.anulacionNegativa(mov.numero, resultante));
  const contrario: MovCaja = {
    numero: siguienteNumero("CAJ", movs.map((x) => x.numero)),
    fecha: hoyISO(),
    hora: horaTxt(),
    tipo: mov.tipo === "ENTRADA" ? "SALIDA" : "ENTRADA",
    monto: mov.monto,
    concepto: `Anulación de ${mov.numero}`,
    origen: "Anulación",
    saldoPosterior: resultante,
    usuario: readNombre(),
    anulaA: mov.numero,
  };
  const anulado: Anulacion = { motivo, usuario: readNombre(), fecha: ahoraTxt(), contrario: contrario.numero };
  return { anulado, contrario };
}

async function consultarSaldoApi(corte: string, desde: string, caja: Caja, movs: MovCaja[]): Promise<ResultadoSaldo> {
  await esperar(700);
  // BACKEND: GET /caja/saldo?corte=AAAA-MM-DD&desde=AAAA-MM-DD  (el servidor calcula todos los valores)
  if (FALLA_SIMULADA) throw new Error("Fallo del servicio.");
  const inicio = desde || caja.fecha;
  const inicial = desde ? saldoVigente(caja.monto, movs, diaAnterior(desde)) : caja.monto;
  const delPeriodo = movs.filter((m) => m.fecha >= inicio && m.fecha <= corte);
  const vigentes = delPeriodo.filter(esVigente);
  const entradas = r2(vigentes.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.monto, 0));
  const salidas = r2(vigentes.filter((m) => m.tipo === "SALIDA").reduce((s, m) => s + m.monto, 0));
  return {
    inicial,
    entradas,
    salidas,
    final: r2(inicial + entradas - salidas),
    calculadoEn: ahoraTxt(),
    periodo: [...delPeriodo].sort(masAntiguos),
    ultimos: movs.filter((m) => m.fecha <= corte).sort(masRecientes).slice(0, 10),
  };
}

// =====================================================================
// 8. COMPONENTES DE PRESENTACIÓN
// =====================================================================

function EtiquetaTipo({ tipo }: { tipo: TipoCaja }) {
  return tipo === "ENTRADA" ? (
    <span className="status status-success"><i />Entrada</span>
  ) : (
    <span className="status" style={{ color: "#9F2727", background: "#FFE5E1" }}><i />Salida</span>
  );
}

function ImporteCaja({ mov }: { mov: MovCaja }) {
  const entrada = mov.tipo === "ENTRADA";
  return (
    <span style={{ color: entrada ? "#56704F" : "#9F2727", fontWeight: 600 }}>
      {entrada ? "+" : "−"} {bs(mov.monto)}
    </span>
  );
}

function EnlaceOrigen({ mov, irABancos }: { mov: MovCaja; irABancos: () => void }) {
  if (mov.origen === "Banco") {
    return <button className="btn btn-secondary" style={BTN_SM} onClick={irABancos}>Ver registro</button>;
  }
  return <Link href="/ingresos-egresos" className="btn btn-secondary" style={BTN_SM}>Ver registro</Link>;
}

function Paginacion({ total, pagina, totalPaginas, onCambiar, singular, plural }: {
  total: number; pagina: number; totalPaginas: number; onCambiar: (p: number) => void; singular: string; plural: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 12, color: "#766E69" }}>
      <span>{total} {total === 1 ? singular : plural}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-secondary" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {totalPaginas}</span>
        <button className="btn btn-secondary" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

/** Tarjeta formal para mostrar un saldo: etiqueta, monto destacado, detalle y acciones. */
function TarjetaSaldo({ etiqueta, monto, detalle, nota, insignia, accion }: {
  etiqueta: string;
  monto: string;
  detalle?: string;
  nota?: string;
  insignia?: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <section className="panel" style={{ marginBottom: 20, borderLeft: "4px solid #C13333" }}>
      <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#766E69" }}>
            {etiqueta}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, margin: "4px 0", color: "#2B2523", fontVariantNumeric: "tabular-nums" }}>
            {monto}
          </div>
          {detalle && <div style={{ fontSize: 13, color: "#766E69" }}>{detalle}</div>}
          {nota && <small style={MUTED}>{nota}</small>}
        </div>
        {(insignia || accion) && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {insignia}
            {accion}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// 9. PESTAÑA "SALDO DE CAJA"
// =====================================================================

type RespuestaSaldo = { clave: string; datos: ResultadoSaldo | null };

function PestanaSaldo({ esAdmin, caja, cajaMovs, irAMovimientos }: {
  esAdmin: boolean; caja: Caja; cajaMovs: MovCaja[]; irAMovimientos: () => void;
}) {
  const [corte, setCorte] = useState(hoyISO());
  const [desde, setDesde] = useState("");
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaSaldo | null>(null);

  // La fecha de corte no puede ser futura ni anterior a la apertura de caja
  const errorFecha = !caja.abierta
    ? ""
    : corte === ""
    ? "Selecciona una fecha de corte."
    : corte > hoyISO()
    ? MENSAJES.corteFutura
    : corte < caja.fecha
    ? MENSAJES.corteAnterior(caja.fecha)
    : desde !== "" && desde < caja.fecha
    ? `La fecha inicial no puede ser anterior a la apertura de caja (${fechaCorta(caja.fecha)}).`
    : desde !== "" && desde > corte
    ? "La fecha inicial no puede ser posterior a la fecha de corte."
    : "";

  // La consulta se vuelve a ejecutar cuando cambia cualquiera de estos valores
  const clave = `${corte}|${desde}|${intento}|${cajaMovs.length}|${caja.fecha}|${caja.monto}`;

  useEffect(() => {
    if (!caja.abierta || errorFecha) return;
    let vigente = true;
    consultarSaldoApi(corte, desde, caja, cajaMovs)
      .then((datos) => {
        if (vigente) setRespuesta({ clave, datos });
      })
      .catch(() => {
        if (vigente) setRespuesta({ clave, datos: null });
      });
    return () => {
      vigente = false;
    };
  }, [clave, corte, desde, caja, cajaMovs, errorFecha]);

  const actual = respuesta !== null && respuesta.clave === clave ? respuesta : null;
  const datos = actual?.datos ?? null;
  const cargando = actual === null;

  function exportarExcel(d: ResultadoSaldo) {
    // BACKEND: GET /caja/exportar?formato=xlsx&corte=&desde=  (aquí se simula con un CSV compatible con Excel)
    if (d.periodo.length === 0) {
      alert(MENSAJES.sinDatosExportar);
      return;
    }
    descargar(
      "saldo-de-caja.csv",
      "\uFEFF" +
        aCsv([
          ["Saldo de caja"],
          [`Fecha de corte: ${fechaCorta(corte)}`, desde ? `Desde: ${fechaCorta(desde)}` : "Desde: apertura de caja"],
          [],
          ["Saldo inicial", d.inicial],
          ["Total de entradas", d.entradas],
          ["Total de salidas", d.salidas],
          ["Saldo final", d.final],
          [],
          ["Número", "Fecha", "Tipo", "Origen", "Concepto", "Monto", "Saldo posterior"],
          ...d.periodo.map((m) => [m.numero, fechaCorta(m.fecha), m.tipo, m.origen, m.concepto, m.monto, m.saldoPosterior]),
        ]),
      "text/csv;charset=utf-8"
    );
  }

  function exportarPdf(d: ResultadoSaldo) {
    // BACKEND: GET /caja/exportar?formato=pdf&corte=&desde=  (aquí se simula con la ventana de impresión)
    if (d.periodo.length === 0) {
      alert(MENSAJES.sinDatosExportar);
      return;
    }
    const filas = d.periodo
      .map(
        (m) =>
          `<tr><td>${m.numero}</td><td>${fechaCorta(m.fecha)}</td><td>${m.tipo}</td><td>${m.origen}</td><td>${m.concepto}</td><td>${bs(m.monto)}</td><td>${bs(m.saldoPosterior)}</td></tr>`
      )
      .join("");
    imprimirHtml(
      "Saldo de caja",
      `<h2>Edificio Central · Saldo de caja</h2><p><b>Fecha de corte:</b> ${fechaCorta(corte)}${desde ? ` · <b>Desde:</b> ${fechaCorta(desde)}` : ""}</p><p><b>Emitido por:</b> ${readNombre()} · <b>Fecha y hora de emisión:</b> ${ahoraTxt()}</p><p>Saldo inicial: ${bs(d.inicial)} · Entradas: ${bs(d.entradas)} · Salidas: ${bs(d.salidas)} · <b>Saldo final: ${bs(d.final)}</b></p><table><thead><tr><th>Número</th><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th><th>Monto</th><th>Saldo posterior</th></tr></thead><tbody>${filas}</tbody></table>`
    );
  }

  // Sin apertura no se muestra ningún saldo
  if (!caja.abierta) {
    return (
      <div className="panel">
        <div className="empty-state">
          {MENSAJES.cajaSinAbrir}
          {esAdmin && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={irAMovimientos}>Abrir caja</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Consulta de saldo</h3>
            <p>Selecciona la fecha de corte. Opcionalmente, indica desde qué fecha deseas consultar el período.</p>
          </div>
        </div>
        <div className="modal-form" style={{ paddingTop: 8 }}>
          <div className="form-grid">
            <label className="field">
              <span>Fecha de corte</span>
              <input type="date" min={caja.fecha} max={hoyISO()} value={corte} onChange={(e) => setCorte(e.target.value)} />
            </label>
            <label className="field">
              <span>Desde (opcional)</span>
              <input type="date" min={caja.fecha} max={corte || hoyISO()} value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setCorte(hoyISO()); setIntento((n) => n + 1); }}>Hoy</button>
            {desde !== "" && <button className="btn btn-secondary" onClick={() => setDesde("")}>Quitar fecha inicial</button>}
          </div>
          {errorFecha && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorFecha}</div>}
        </div>
      </section>

      {errorFecha ? null : cargando ? (
        <div className="panel"><div className="empty-state">{MENSAJES.cargandoSaldo}</div></div>
      ) : datos === null ? (
        <div className="panel">
          <div className="empty-state">
            {MENSAJES.errorSaldo}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <TarjetaSaldo
            etiqueta="Saldo de caja"
            monto={bs(datos.final)}
            detalle={`Al ${fechaCorta(corte)}`}
            nota={`Actualizado: ${datos.calculadoEn}`}
            insignia={datos.final === 0 ? <span className="tag">Caja sin fondos</span> : undefined}
          />

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-icon"><BuildingIcon size={20} /></div>
              <span>Saldo inicial</span>
              <strong>{bs(datos.inicial)}</strong>
              <small>{desde ? `Al ${fechaCorta(diaAnterior(desde))}` : `Apertura del ${fechaCorta(caja.fecha)}`}</small>
            </div>
            <div className="metric-card">
              <div className="metric-icon soft"><PlusIcon size={20} /></div>
              <span>Total de entradas</span>
              <strong>{bs(datos.entradas)}</strong>
              <small>Período consultado</small>
            </div>
            <div className="metric-card">
              <div className="metric-icon attention"><WalletIcon size={20} /></div>
              <span>Total de salidas</span>
              <strong>{bs(datos.salidas)}</strong>
              <small>Período consultado</small>
            </div>
            <div className="metric-card">
              <div className="metric-icon soft"><CheckIcon size={20} /></div>
              <span>Saldo final</span>
              <strong>{bs(datos.final)}</strong>
              <small>Al {fechaCorta(corte)}</small>
            </div>
          </div>

          {/* COMPLEMENTO: flujo de caja del período. Se puede eliminar esta sección. */}
          <section className="panel" style={{ margin: "20px 0" }}>
            <div className="panel-toolbar">
              <div>
                <h3>Flujo de caja del período</h3>
                <p>Entradas y salidas vigentes, sin contar movimientos anulados.</p>
              </div>
            </div>
            <div style={{ padding: "6px 24px 22px" }}>
              {([["Entradas", datos.entradas, "#6E9B61"], ["Salidas", datos.salidas, "#C13333"]] as const).map(([nombre, valor, color]) => (
                <div key={nombre} style={{ margin: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>{nombre}</span><strong>{bs(valor)}</strong>
                  </div>
                  <div style={{ background: "#F1ECE8", borderRadius: 6, height: 12 }}>
                    <div style={{ width: `${(valor / Math.max(datos.entradas, datos.salidas, 1)) * 100}%`, background: color, height: 12, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <div>
                <h3>Últimos movimientos</h3>
                <p>Los 10 movimientos más recientes hasta la fecha de corte.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={() => exportarPdf(datos)}><FileIcon size={16} /> Exportar PDF</button>
                <button className="btn btn-secondary" onClick={() => exportarExcel(datos)}><FileIcon size={16} /> Exportar Excel</button>
              </div>
            </div>
            {datos.ultimos.length === 0 ? (
              <div className="empty-state">No hay movimientos de caja hasta la fecha de corte.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th><th>Monto</th></tr>
                  </thead>
                  <tbody>
                    {datos.ultimos.map((m) => (
                      <tr key={m.numero} style={m.anulado ? { opacity: 0.55 } : undefined}>
                        <td>{fechaCorta(m.fecha)}</td>
                        <td><EtiquetaTipo tipo={m.tipo} /></td>
                        <td><span className="tag">{m.origen}</span></td>
                        <td>{m.concepto}</td>
                        <td><ImporteCaja mov={m} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: "12px 20px" }}>
              <button className="btn btn-secondary" onClick={irAMovimientos}>Ver todos los movimientos</button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

// =====================================================================
// 10. PESTAÑA "MOVIMIENTOS DE CAJA"
// =====================================================================

const formVacio = (): FormMovimiento => ({ fecha: hoyISO(), tipo: "", monto: "", concepto: "" });

function PestanaMovCaja({ esAdmin, caja, setCaja, cajaMovs, setCajaMovs, irABancos }: {
  esAdmin: boolean;
  caja: Caja;
  setCaja: React.Dispatch<React.SetStateAction<Caja>>;
  cajaMovs: MovCaja[];
  setCajaMovs: React.Dispatch<React.SetStateAction<MovCaja[]>>;
  irABancos: () => void;
}) {
  const saldoActual = saldoVigente(caja.monto, cajaMovs);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoF, setTipoF] = useState("");
  const [origenF, setOrigenF] = useState("");
  const [pagina, setPagina] = useState(1);

  // Apertura de caja
  const [aMonto, setAMonto] = useState("");
  const [aFecha, setAFecha] = useState(hoyISO());
  const [aIntentado, setAIntentado] = useState(false);
  const [aGuardando, setAGuardando] = useState(false);
  const [aServidor, setAServidor] = useState("");

  // Registro de movimiento
  const [movAbierto, setMovAbierto] = useState(false);
  const [paso, setPaso] = useState<"formulario" | "confirmar">("formulario");
  const [form, setForm] = useState<FormMovimiento>(formVacio());
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  // Anulación
  const [objetivo, setObjetivo] = useState<MovCaja | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulIntentado, setAnulIntentado] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [errorAnulacion, setErrorAnulacion] = useState("");

  // ---------- Apertura ----------
  const montoApertura = validarMonto(aMonto, "monto inicial", true);
  const errorFechaApertura =
    aFecha === "" ? MENSAJES.campoObligatorio("fecha") : aFecha > hoyISO() ? "La fecha de apertura no puede ser futura." : "";

  async function abrirCaja() {
    if (aGuardando) return;
    setAIntentado(true);
    if (montoApertura.valor === null || errorFechaApertura) return;
    setAGuardando(true);
    setAServidor("");
    try {
      const nueva = await abrirCajaApi(montoApertura.valor, aFecha, caja);
      setCaja(nueva);
      setAviso({ tipo: "ok", texto: `Caja abierta el ${fechaCorta(nueva.fecha)} con un saldo inicial de ${bs(nueva.monto)}.` });
    } catch (e) {
      setAServidor(e instanceof Error ? e.message : "No se pudo abrir la caja. Intenta nuevamente.");
    } finally {
      setAGuardando(false);
    }
  }

  // ---------- Registro de movimiento ----------
  const monto = validarMonto(form.monto, "monto");
  const errores = {
    fecha:
      form.fecha === ""
        ? MENSAJES.campoObligatorio("fecha")
        : form.fecha > hoyISO()
        ? "La fecha no puede ser futura."
        : form.fecha < caja.fecha
        ? `La fecha no puede ser anterior a la apertura de caja (${fechaCorta(caja.fecha)}).`
        : "",
    tipo: form.tipo === "" ? MENSAJES.campoObligatorio("tipo") : "",
    monto: monto.error,
    concepto: validarConcepto(form.concepto),
  };
  const hayErrores = Object.values(errores).some(Boolean);
  const excedeSaldo = form.tipo === "SALIDA" && monto.valor !== null && monto.valor > saldoActual;
  const saldoNuevo =
    monto.valor !== null && form.tipo !== "" ? r2(saldoActual + (form.tipo === "ENTRADA" ? monto.valor : -monto.valor)) : saldoActual;
  const mostrarError = (campo: keyof FormMovimiento) => intentado || form[campo] !== "";

  function abrirFormulario() {
    setForm(formVacio());
    setPaso("formulario");
    setIntentado(false);
    setErrorServidor("");
    setAviso(null);
    setMovAbierto(true);
  }
  function cerrarFormulario() {
    if (guardando) return;
    setMovAbierto(false);
  }
  function continuar() {
    setIntentado(true);
    if (hayErrores || excedeSaldo) return;
    setPaso("confirmar");
  }
  async function confirmarMovimiento() {
    if (guardando || form.tipo === "" || monto.valor === null) return;
    setGuardando(true);
    setErrorServidor("");
    try {
      const nuevo = await registrarMovCajaApi(
        { fecha: form.fecha, tipo: form.tipo, monto: monto.valor, concepto: form.concepto.trim(), origen: "Manual" },
        caja,
        cajaMovs
      );
      setCajaMovs((prev) => [...prev, nuevo]);
      setMovAbierto(false);
      setPagina(1);
      setAviso({ tipo: "ok", texto: MENSAJES.movimientoRegistrado(nuevo.numero, nuevo.saldoPosterior) });
    } catch (e) {
      // Se muestra el mensaje recibido y se conservan los datos ingresados
      setErrorServidor(e instanceof Error ? e.message : "No se pudo registrar el movimiento. Intenta nuevamente.");
      setPaso("formulario");
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Anulación ----------
  const saldoTrasAnular = objetivo ? r2(saldoActual + (objetivo.tipo === "ENTRADA" ? -objetivo.monto : objetivo.monto)) : 0;
  const anulacionNegativa = objetivo !== null && saldoTrasAnular < 0;
  const errorMotivo = validarMotivo(motivo);

  function abrirAnulacion(mov: MovCaja) {
    setObjetivo(mov);
    setMotivo("");
    setAnulIntentado(false);
    setErrorAnulacion("");
    setAviso(null);
  }
  async function confirmarAnulacion() {
    if (anulando || !objetivo) return;
    setAnulIntentado(true);
    if (errorMotivo || anulacionNegativa) return;
    const numero = objetivo.numero;
    setAnulando(true);
    setErrorAnulacion("");
    try {
      const res = await anularMovCajaApi(numero, motivo.trim(), caja, cajaMovs);
      setCajaMovs((prev) => [...prev.map((x) => (x.numero === numero ? { ...x, anulado: res.anulado } : x)), res.contrario]);
      setObjetivo(null);
      setAviso({ tipo: "ok", texto: MENSAJES.movimientoAnulado(numero) });
    } catch (e) {
      setErrorAnulacion(e instanceof Error ? e.message : "No se pudo anular el movimiento. Intenta nuevamente.");
    } finally {
      setAnulando(false);
    }
  }

  // ---------- Filtros y paginación ----------
  const filtrados = cajaMovs
    .filter(
      (x) =>
        (desde === "" || x.fecha >= desde) &&
        (hasta === "" || x.fecha <= hasta) &&
        (tipoF === "" || x.tipo === tipoF) &&
        (origenF === "" || x.origen === origenF)
    )
    .sort(masRecientes);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const rangoInvalido = desde !== "" && hasta !== "" && desde > hasta;

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setTipoF("");
    setOrigenF("");
    setPagina(1);
  }

  const bannerAviso = aviso && (
    <div className={aviso.tipo === "ok" ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 16 }}>
      {aviso.texto}
    </div>
  );

  // ---------- Caja sin abrir ----------
  if (!caja.abierta) {
    return (
      <>
        {bannerAviso}
        {esAdmin ? (
          <section className="panel">
            <div className="panel-toolbar">
              <div>
                <h3>Apertura de caja</h3>
                <p>{MENSAJES.cajaSinAbrirAdmin}</p>
              </div>
            </div>
            <div className="modal-form" style={{ paddingTop: 8 }}>
              <div className="form-grid">
                <label className="field">
                  <span>Monto inicial (Bs.) <b>*</b></span>
                  <input value={aMonto} inputMode="decimal" onChange={(e) => setAMonto(e.target.value)} placeholder="Ej. 2000,00 (puede ser 0)" />
                  {(aIntentado || aMonto !== "") && montoApertura.error && <small style={ERR}>{montoApertura.error}</small>}
                </label>
                <label className="field">
                  <span>Fecha de apertura <b>*</b></span>
                  <input type="date" max={hoyISO()} value={aFecha} onChange={(e) => setAFecha(e.target.value)} />
                  {errorFechaApertura && <small style={ERR}>{errorFechaApertura}</small>}
                </label>
              </div>
              {aServidor && <div className="alert alert-error" style={{ marginTop: 12 }}>{aServidor}</div>}
              <div className="modal-actions">
                <button className="btn btn-primary" disabled={aGuardando} onClick={abrirCaja}>
                  {aGuardando ? "Guardando…" : "Abrir caja"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="panel"><div className="empty-state">{MENSAJES.cajaSinAbrir}</div></div>
        )}
      </>
    );
  }

  return (
    <>
      {bannerAviso}

      {/* Saldo destacado. El botón solo se muestra al administrador. */}
      <TarjetaSaldo
        etiqueta="Saldo de caja"
        monto={bs(saldoActual)}
        detalle={`Caja abierta el ${fechaCorta(caja.fecha)}`}
        accion={
          esAdmin ? (
            <button className="btn btn-primary" onClick={abrirFormulario}>
              <PlusIcon size={16} /> Registrar movimiento
            </button>
          ) : undefined
        }
      />

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>Combina rango de fechas, tipo y origen.</p>
          </div>
          <button className="btn btn-secondary" onClick={limpiarFiltros}>Limpiar filtros</button>
        </div>
        <div className="modal-form" style={{ paddingTop: 8 }}>
          <div className="form-grid">
            <label className="field">
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={tipoF} onChange={(e) => { setTipoF(e.target.value); setPagina(1); }}>
                <option value="">Todos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
              </select>
            </label>
            <label className="field">
              <span>Origen</span>
              <select value={origenF} onChange={(e) => { setOrigenF(e.target.value); setPagina(1); }}>
                <option value="">Todos</option>
                {ORIGENES_CAJA.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          {rangoInvalido && <div className="alert alert-error" style={{ marginTop: 12 }}>La fecha inicial no puede ser posterior a la fecha final.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Movimientos de caja</h3>
            <p>Los movimientos no se eliminan: se anulan y permanecen en el historial.</p>
          </div>
        </div>
        {filtrados.length === 0 ? (
          <div className="empty-state">{MENSAJES.sinResultados}</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Número</th><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th><th>Monto</th><th>Saldo posterior</th><th>Estado</th>
                    {esAdmin && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((x) => (
                    <tr key={x.numero} style={x.anulado ? { opacity: 0.55 } : undefined}>
                      <td>{x.numero}</td>
                      <td>{fechaCorta(x.fecha)}</td>
                      <td><EtiquetaTipo tipo={x.tipo} /></td>
                      <td><span className="tag">{x.origen}</span></td>
                      <td>{x.concepto}</td>
                      <td><ImporteCaja mov={x} /></td>
                      <td>{bs(x.saldoPosterior)}</td>
                      <td>{x.anulado ? <span className="tag">Anulado</span> : "Vigente"}</td>
                      {esAdmin && (
                        <td>
                          {x.anulado ? (
                            <span style={MUTED}>Anulado por {x.anulado.usuario}</span>
                          ) : x.anulaA ? (
                            <span style={MUTED}>Anula a {x.anulaA}</span>
                          ) : x.origen === "Manual" ? (
                            <button className="btn btn-secondary" style={BTN_SM} onClick={() => abrirAnulacion(x)}>Anular</button>
                          ) : (
                            // Los movimientos automáticos no se anulan desde caja
                            <div>
                              <div style={MUTED}>Se anula desde {x.origen}</div>
                              <EnlaceOrigen mov={x} irABancos={irABancos} />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion
              total={filtrados.length}
              pagina={paginaActual}
              totalPaginas={totalPaginas}
              onCambiar={setPagina}
              singular="movimiento"
              plural="movimientos"
            />
          </>
        )}
      </section>

      {/* ---------- Registro de movimiento ---------- */}
      {esAdmin && (
        <Modal open={movAbierto} title="Registrar movimiento de caja" onClose={cerrarFormulario}>
          {paso === "formulario" ? (
            <div className="modal-form">
              <p style={{ ...MUTED, margin: "0 0 12px" }}>Saldo actual de caja: <strong>{bs(saldoActual)}</strong></p>
              <div className="form-grid">
                <label className="field">
                  <span>Fecha <b>*</b></span>
                  <input type="date" min={caja.fecha} max={hoyISO()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  {mostrarError("fecha") && errores.fecha && <small style={ERR}>{errores.fecha}</small>}
                </label>
                <label className="field">
                  <span>Tipo <b>*</b></span>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as "" | TipoCaja })}>
                    <option value="">Selecciona el tipo</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </select>
                  {mostrarError("tipo") && errores.tipo && <small style={ERR}>{errores.tipo}</small>}
                </label>
                <label className="field">
                  <span>Monto (Bs.) <b>*</b></span>
                  <input value={form.monto} inputMode="decimal" onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="Ej. 150,00" />
                  {mostrarError("monto") && errores.monto && <small style={ERR}>{errores.monto}</small>}
                </label>
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>Concepto <b>*</b></span>
                <input value={form.concepto} maxLength={300} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Describe el movimiento (10 a 255 caracteres)" />
                <small style={MUTED}>{form.concepto.trim().length}/255 caracteres</small>
                {mostrarError("concepto") && errores.concepto && <small style={ERR}>{errores.concepto}</small>}
              </label>

              {excedeSaldo && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 12 }}>{MENSAJES.salidaExcede(saldoActual)}</p>
              )}
              {errorServidor && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorServidor}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cerrarFormulario}>Cancelar</button>
                <button className="btn btn-primary" disabled={excedeSaldo} onClick={continuar}>Guardar</button>
              </div>
            </div>
          ) : (
            <div className="modal-form">
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                {form.tipo !== "" && monto.valor !== null ? MENSAJES.confirmarMovimiento(form.tipo, monto.valor) : ""}
              </p>
              <p style={{ fontSize: 13, color: "#766E69", margin: 0 }}>{MENSAJES.saldoDespues(saldoNuevo)}</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" disabled={guardando} onClick={() => setPaso("formulario")}>Cancelar</button>
                <button className="btn btn-primary" disabled={guardando} onClick={confirmarMovimiento}>
                  {guardando ? "Guardando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ---------- Anulación ---------- */}
      {esAdmin && (
        <Modal open={objetivo !== null} title="Anular movimiento de caja" onClose={() => { if (!anulando) setObjetivo(null); }}>
          {objetivo && (
            <div className="modal-form">
              <div style={FILA}><span>Movimiento</span><strong>{objetivo.numero}</strong></div>
              <div style={FILA}><span>Concepto</span><strong>{objetivo.concepto}</strong></div>
              <div style={FILA}><span>Monto</span><strong>{bs(objetivo.monto)}</strong></div>

              <label className="field" style={{ marginTop: 14 }}>
                <span>Motivo de anulación <b>*</b></span>
                <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Explica por qué se anula (10 a 255 caracteres)" />
                <small style={MUTED}>{motivo.trim().length}/255 caracteres</small>
                {(anulIntentado || motivo !== "") && errorMotivo && <small style={ERR}>{errorMotivo}</small>}
              </label>

              <div className="alert" style={{ ...AVISO, marginTop: 12 }}>
                {MENSAJES.confirmarAnulacion(objetivo.numero, objetivo.monto, saldoTrasAnular)}
              </div>
              {anulacionNegativa && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 10 }}>
                  {MENSAJES.anulacionNegativa(objetivo.numero, saldoTrasAnular)}
                </p>
              )}
              {errorAnulacion && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorAnulacion}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" disabled={anulando} onClick={() => setObjetivo(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={anulando || anulacionNegativa} onClick={confirmarAnulacion}>
                  {anulando ? "Anulando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// =====================================================================
// 11. PESTAÑAS DE BANCOS
// =====================================================================

const MENSAJES_BANCO = {
  cuentaInactiva: "La cuenta está inactiva y no admite movimientos.",
  cuentaDuplicada: (numero: string, banco: string) => `Ya existe una cuenta con el número ${numero} en el banco ${banco}.`,
  referenciaDuplicada: (referencia: string, cuenta: string) => `La referencia ${referencia} ya está registrada en la cuenta ${cuenta}.`,
  confirmarDesactivar: (cuenta: string) => `¿Desactivar la cuenta ${cuenta}? No admitirá nuevos movimientos.`,
  cuentaCreada: (cuenta: string) => `Cuenta ${cuenta} creada.`,
  cuentaActualizada: (cuenta: string) => `Cuenta ${cuenta} actualizada.`,
  cuentaDesactivada: (cuenta: string) => `Cuenta ${cuenta} desactivada.`,
  saldoDeCuenta: (cuenta: string, saldo: number) => `Saldo de ${cuenta}: ${bs(saldo)}`,
  montoExcede: (saldo: number) => `El monto supera el saldo de la cuenta (${bs(saldo)}).`,
  saldoInsuficiente: (cuenta: string, disponible: number, monto: number) =>
    `Saldo insuficiente en la cuenta ${cuenta}. Disponible: ${bs(disponible)}; el movimiento es de ${bs(monto)}.`,
  cajaInsuficiente: (disponible: number) => `Saldo insuficiente en caja para registrar el depósito. Disponible: ${bs(disponible)}.`,
  confirmarMovimiento: (tipo: string, monto: number, cuenta: string) => `¿Registrar ${tipo} de ${bs(monto)} en la cuenta ${cuenta}?`,
  movimientoRegistrado: (numero: string, cuenta: string, saldo: number) =>
    `Movimiento ${numero} registrado en la cuenta ${cuenta}. Saldo: ${bs(saldo)}.`,
  confirmarAnulacion: (numero: string, monto: number, saldo: number) =>
    `¿Anular el movimiento ${numero} de ${bs(monto)}? Se creará un movimiento contrario y el saldo de la cuenta será ${bs(saldo)}.`,
  movimientoAnulado: (numero: string) => `Movimiento ${numero} anulado.`,
  anulacionNegativa: (numero: string, cuenta: string, saldo: number) =>
    `No se puede anular el movimiento ${numero}: la cuenta ${cuenta} quedaría en ${bs(saldo)}.`,
  generadoPor: (numero: string, origen: string) => `El movimiento ${numero} fue generado por ${origen}. Anúlalo desde su registro de origen.`,
  sinResultados: "No hay movimientos bancarios que coincidan con los filtros aplicados.",
  sinCuentas: "Todavía no hay cuentas bancarias registradas.",
  adjuntoFormato: "Formato no permitido. Usa PDF, JPG o PNG.",
  adjuntoTamano: "El adjunto no debe superar los 5 MB.",
};

// ---------- Tipos y utilidades de bancos ----------

type FormCuenta = { banco: string; numero: string; titular: string; apertura: string };
type FormBanco = {
  cuentaId: string;
  fecha: string;
  opcion: string;
  monto: string;
  referencia: string;
  concepto: string;
  enCaja: boolean;
  adjunto: File | null;
};
type DatosCuenta = { banco: string; numero: string; titular: string; apertura: number };
type NuevoMovBanco = {
  cuentaId: number;
  fecha: string;
  tipo: TipoBanco;
  signo: 1 | -1;
  monto: number;
  referencia: string;
  concepto: string;
  enCaja: boolean;
  adjunto: string | null;
};

const TIPOS_BANCO: TipoBanco[] = ["Depósito", "Retiro", "Transferencia recibida", "Transferencia enviada", "Comisión", "Ajuste"];

/** Depósitos, transferencias recibidas y ajustes a favor suman; el resto resta. */
const OPCIONES_TIPO: { valor: string; tipo: TipoBanco; signo: 1 | -1; texto: string }[] = [
  { valor: "deposito", tipo: "Depósito", signo: 1, texto: "Depósito" },
  { valor: "retiro", tipo: "Retiro", signo: -1, texto: "Retiro" },
  { valor: "trf-recibida", tipo: "Transferencia recibida", signo: 1, texto: "Transferencia recibida" },
  { valor: "trf-enviada", tipo: "Transferencia enviada", signo: -1, texto: "Transferencia enviada" },
  { valor: "comision", tipo: "Comisión", signo: -1, texto: "Comisión" },
  { valor: "ajuste-mas", tipo: "Ajuste", signo: 1, texto: "Ajuste (aumenta el saldo)" },
  { valor: "ajuste-menos", tipo: "Ajuste", signo: -1, texto: "Ajuste (disminuye el saldo)" },
];

const TIPO_CONTRARIO: Record<TipoBanco, TipoBanco> = {
  "Depósito": "Retiro",
  "Retiro": "Depósito",
  "Transferencia recibida": "Transferencia enviada",
  "Transferencia enviada": "Transferencia recibida",
  "Comisión": "Ajuste",
  "Ajuste": "Ajuste",
};

const formCuentaVacio = (): FormCuenta => ({ banco: "", numero: "", titular: "", apertura: "" });
const formBancoVacio = (cuentaId: string): FormBanco => ({
  cuentaId, fecha: hoyISO(), opcion: "", monto: "", referencia: "", concepto: "", enCaja: false, adjunto: null,
});

const etiquetaCuenta = (c: Cuenta) => `${c.banco} · ${c.numero}`;

/** Un movimiento anulado y su contrario no forman parte del saldo. */
const esVigenteBanco = (m: MovBanco) => !m.anulado && !m.anulaA;

function saldoCuenta(cuenta: Cuenta, movs: MovBanco[]) {
  const suma = movs
    .filter((m) => m.cuentaId === cuenta.id && esVigenteBanco(m))
    .reduce((s, m) => s + m.signo * m.monto, 0);
  return r2(cuenta.apertura + suma);
}

const masRecientesBanco = (a: MovBanco, b: MovBanco) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero);

function estadoDe(m: MovBanco): "Anulado" | "Conciliado" | "Pendiente" {
  if (m.anulado) return "Anulado";
  return m.conciliado ? "Conciliado" : "Pendiente";
}

// ---------- Simulación del backend (bancos) ----------

async function guardarCuentaApi(datos: DatosCuenta, editId: number | null, cuentas: Cuenta[]): Promise<Cuenta> {
  await esperar(700);
  // BACKEND: POST /cuentas-bancarias  ·  PUT /cuentas-bancarias/{id}
  //   403 → "Acceso denegado. Solo el administrador puede gestionar cuentas bancarias."
  const duplicada = cuentas.some(
    (c) =>
      c.id !== editId &&
      c.banco.trim().toLowerCase() === datos.banco.trim().toLowerCase() &&
      c.numero.trim().toLowerCase() === datos.numero.trim().toLowerCase()
  );
  if (duplicada) throw new Error(MENSAJES_BANCO.cuentaDuplicada(datos.numero, datos.banco));
  if (editId !== null) {
    const actual = cuentas.find((c) => c.id === editId);
    if (!actual) throw new Error("La cuenta no existe.");
    return { ...actual, banco: datos.banco, numero: datos.numero, titular: datos.titular };
  }
  return { id: Date.now(), ...datos, activa: true };
}

async function registrarMovBancoApi(n: NuevoMovBanco, cuentas: Cuenta[], movs: MovBanco[], caja: Caja, cajaMovs: MovCaja[]) {
  await esperar(900);
  // BACKEND: POST /bancos/movimientos  { cuentaId, fecha, tipo, monto, referencia, concepto, registrarEnCaja, adjunto }
  //   El traspaso con caja se guarda en una sola transacción: si algo falla, no se guarda nada.
  //   403 → "Acceso denegado. Solo el administrador puede registrar movimientos bancarios."
  //   422 → mensaje del servidor  ·  5xx → "Fallo del servicio. Intenta nuevamente."
  const cuenta = cuentas.find((c) => c.id === n.cuentaId);
  if (!cuenta) throw new Error("La cuenta seleccionada no existe.");
  if (!cuenta.activa) throw new Error(MENSAJES_BANCO.cuentaInactiva);
  if (n.fecha > hoyISO()) throw new Error("La fecha del movimiento no puede ser posterior a la fecha actual.");

  const referencia = n.referencia.trim();
  if (movs.some((m) => m.cuentaId === n.cuentaId && m.referencia.trim().toLowerCase() === referencia.toLowerCase())) {
    throw new Error(MENSAJES_BANCO.referenciaDuplicada(referencia, etiquetaCuenta(cuenta)));
  }

  const saldo = saldoCuenta(cuenta, movs);
  if (n.signo === -1 && n.monto > saldo) {
    throw new Error(MENSAJES_BANCO.saldoInsuficiente(etiquetaCuenta(cuenta), saldo, n.monto));
  }

  const numeroBan = siguienteNumero("BAN", movs.map((m) => m.numero));
  let cajaMov: MovCaja | null = null;

  if (n.enCaja && (n.tipo === "Retiro" || n.tipo === "Depósito")) {
    if (!caja.abierta) throw new Error("La caja aún no ha sido abierta. Regístrate primero con el monto inicial.");
    if (n.fecha < caja.fecha) throw new Error("La fecha del movimiento no puede ser anterior a la apertura de caja.");
    const saldoCajaActual = saldoVigente(caja.monto, cajaMovs);
    const tipoCaja: TipoCaja = n.tipo === "Retiro" ? "ENTRADA" : "SALIDA";
    if (tipoCaja === "SALIDA" && n.monto > saldoCajaActual) throw new Error(MENSAJES_BANCO.cajaInsuficiente(saldoCajaActual));
    cajaMov = {
      numero: siguienteNumero("CAJ", cajaMovs.map((m) => m.numero)),
      fecha: n.fecha,
      hora: horaTxt(),
      tipo: tipoCaja,
      monto: n.monto,
      concepto:
        n.tipo === "Retiro"
          ? `Retiro desde la cuenta ${etiquetaCuenta(cuenta)} (${numeroBan})`
          : `Depósito hacia la cuenta ${etiquetaCuenta(cuenta)} (${numeroBan})`,
      origen: "Banco",
      saldoPosterior: r2(saldoCajaActual + (tipoCaja === "ENTRADA" ? n.monto : -n.monto)),
      usuario: readNombre(),
    };
  }

  const mov: MovBanco = {
    numero: numeroBan,
    cuentaId: n.cuentaId,
    fecha: n.fecha,
    hora: horaTxt(),
    tipo: n.tipo,
    monto: n.monto,
    signo: n.signo,
    referencia,
    concepto: n.concepto.trim(),
    origen: "Manual",
    saldoPosterior: r2(saldo + n.signo * n.monto),
    usuario: readNombre(),
    conciliado: false,
    vinculoCaja: cajaMov?.numero,
    adjunto: n.adjunto,
  };
  return { mov, cajaMov };
}

async function anularMovBancoApi(numero: string, motivo: string, cuentas: Cuenta[], movs: MovBanco[], caja: Caja, cajaMovs: MovCaja[]) {
  await esperar(800);
  // BACKEND: POST /bancos/movimientos/{numero}/anular  { motivo }
  //   Crea el movimiento contrario y registra la operación en auditoría.
  //   Si el movimiento tiene un movimiento de caja vinculado, ambos se anulan en la misma transacción.
  const mov = movs.find((x) => x.numero === numero);
  if (!mov) throw new Error("El movimiento no existe.");
  if (mov.anulado) throw new Error(MENSAJES.yaAnulado(mov.numero, mov.anulado.fecha.slice(0, 10)));
  if (mov.origen !== "Manual") throw new Error(MENSAJES_BANCO.generadoPor(mov.numero, mov.origen));
  const cuenta = cuentas.find((c) => c.id === mov.cuentaId);
  if (!cuenta) throw new Error("La cuenta no existe.");
  if (!cuenta.activa) throw new Error(MENSAJES_BANCO.cuentaInactiva);

  const resultante = r2(saldoCuenta(cuenta, movs) - mov.signo * mov.monto);
  if (resultante < 0) throw new Error(MENSAJES_BANCO.anulacionNegativa(mov.numero, etiquetaCuenta(cuenta), resultante));

  const fechaAnulacion = ahoraTxt();
  const numeroContrario = siguienteNumero("BAN", movs.map((x) => x.numero));
  const contrario: MovBanco = {
    numero: numeroContrario,
    cuentaId: mov.cuentaId,
    fecha: hoyISO(),
    hora: horaTxt(),
    tipo: TIPO_CONTRARIO[mov.tipo],
    monto: mov.monto,
    signo: mov.signo === 1 ? -1 : 1,
    referencia: `ANU-${mov.numero}`,
    concepto: `Anulación de ${mov.numero}`,
    origen: "Manual",
    saldoPosterior: resultante,
    usuario: readNombre(),
    conciliado: true,
    anulaA: mov.numero,
  };
  const anulado: Anulacion = { motivo, usuario: readNombre(), fecha: fechaAnulacion, contrario: numeroContrario };

  let cajaAnulado: { numero: string; anulado: Anulacion } | null = null;
  let cajaContrario: MovCaja | null = null;
  const vinculado = mov.vinculoCaja ? cajaMovs.find((x) => x.numero === mov.vinculoCaja) : undefined;
  if (vinculado && !vinculado.anulado) {
    const saldoCajaActual = saldoVigente(caja.monto, cajaMovs);
    const cajaResultante = r2(saldoCajaActual + (vinculado.tipo === "ENTRADA" ? -vinculado.monto : vinculado.monto));
    if (cajaResultante < 0) throw new Error(MENSAJES.anulacionNegativa(vinculado.numero, cajaResultante));
    const numeroCaja = siguienteNumero("CAJ", cajaMovs.map((x) => x.numero));
    cajaContrario = {
      numero: numeroCaja,
      fecha: hoyISO(),
      hora: horaTxt(),
      tipo: vinculado.tipo === "ENTRADA" ? "SALIDA" : "ENTRADA",
      monto: vinculado.monto,
      concepto: `Anulación de ${vinculado.numero}`,
      origen: "Anulación",
      saldoPosterior: cajaResultante,
      usuario: readNombre(),
      anulaA: vinculado.numero,
    };
    cajaAnulado = { numero: vinculado.numero, anulado: { motivo, usuario: readNombre(), fecha: fechaAnulacion, contrario: numeroCaja } };
  }
  return { anulado, contrario, cajaAnulado, cajaContrario };
}

// ---------- Presentación ----------

function ImporteBanco({ mov }: { mov: MovBanco }) {
  return (
    <span style={{ color: mov.signo === 1 ? "#56704F" : "#9F2727", fontWeight: 600 }}>
      {mov.signo === 1 ? "+" : "−"} {bs(mov.monto)}
    </span>
  );
}

function EstadoConciliacion({ estado }: { estado: "Anulado" | "Conciliado" | "Pendiente" }) {
  if (estado === "Anulado") return <span className="tag">Anulado</span>;
  return estado === "Conciliado" ? (
    <span className="status status-success"><i />Conciliado</span>
  ) : (
    <span className="status status-warning"><i />Pendiente</span>
  );
}

function EnlaceOrigenBanco({ mov, irACaja }: { mov: MovBanco; irACaja: () => void }) {
  if (mov.origen === "Caja") {
    return <button className="btn btn-secondary" style={BTN_SM} onClick={irACaja}>Ver registro</button>;
  }
  const destino = mov.origen === "QR de expensas" ? "/pagos" : "/ingresos-egresos";
  return <Link href={destino} className="btn btn-secondary" style={BTN_SM}>Ver registro</Link>;
}

// =====================================================================
// PESTAÑA "CUENTAS BANCARIAS"
// =====================================================================

function PestanaCuentas({ esAdmin, cuentas, setCuentas, movBanco }: BancosProps) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Cuenta | null>(null);
  const [form, setForm] = useState<FormCuenta>(formCuentaVacio());
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  const activas = cuentas.filter((c) => c.activa);
  const totalActivas = r2(activas.reduce((s, c) => s + saldoCuenta(c, movBanco), 0));

  // Campos obligatorios validados antes de enviar
  const apertura = validarMonto(form.apertura, "saldo de apertura", true);
  const errores = {
    banco: form.banco.trim() === "" ? MENSAJES.campoObligatorio("banco") : "",
    numero: form.numero.trim() === "" ? MENSAJES.campoObligatorio("número de cuenta") : "",
    titular: form.titular.trim() === "" ? MENSAJES.campoObligatorio("titular") : "",
    apertura: editando ? "" : apertura.error,
  };
  const mostrar = (valor: string) => intentado || valor !== "";

  function abrirFormulario(cuenta?: Cuenta) {
    setEditando(cuenta ?? null);
    setForm(cuenta ? { banco: cuenta.banco, numero: cuenta.numero, titular: cuenta.titular, apertura: String(cuenta.apertura) } : formCuentaVacio());
    setIntentado(false);
    setErrorServidor("");
    setAviso(null);
    setAbierto(true);
  }
  function cerrarFormulario() {
    if (guardando) return;
    setAbierto(false);
  }

  async function guardar() {
    if (guardando) return;
    setIntentado(true);
    if (Object.values(errores).some(Boolean)) return;
    setGuardando(true);
    setErrorServidor("");
    try {
      const datos: DatosCuenta = {
        banco: form.banco.trim(),
        numero: form.numero.trim(),
        titular: form.titular.trim(),
        apertura: editando ? editando.apertura : apertura.valor ?? 0,
      };
      const cuenta = await guardarCuentaApi(datos, editando?.id ?? null, cuentas);
      setCuentas((prev) => (editando ? prev.map((c) => (c.id === cuenta.id ? cuenta : c)) : [...prev, cuenta]));
      setAbierto(false);
      setAviso({
        tipo: "ok",
        texto: editando ? MENSAJES_BANCO.cuentaActualizada(etiquetaCuenta(cuenta)) : MENSAJES_BANCO.cuentaCreada(etiquetaCuenta(cuenta)),
      });
    } catch (e) {
      // Se muestra el mensaje del backend y se conservan los datos ingresados
      setErrorServidor(e instanceof Error ? e.message : "No se pudo guardar la cuenta. Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  }

  function desactivar(cuenta: Cuenta) {
    // Confirmación antes de desactivar
    if (!window.confirm(MENSAJES_BANCO.confirmarDesactivar(etiquetaCuenta(cuenta)))) return;
    // BACKEND: PATCH /cuentas-bancarias/{id}/desactivar  (una cuenta con movimientos no se elimina, solo se desactiva)
    setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...c, activa: false } : c)));
    setAviso({ tipo: "ok", texto: MENSAJES_BANCO.cuentaDesactivada(etiquetaCuenta(cuenta)) });
  }

  return (
    <>
      {aviso && (
        <div className={aviso.tipo === "ok" ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 16 }}>{aviso.texto}</div>
      )}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><BuildingIcon size={20} /></div>
          <div><span>Cuentas activas</span><strong>{activas.length}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><WalletIcon size={20} /></div>
          <div><span>Saldo total en cuentas activas</span><strong>{bs(totalActivas)}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Cuentas bancarias del edificio</h3>
            <p>Una cuenta con movimientos no se elimina: solo se desactiva y deja de aceptar movimientos.</p>
          </div>
          {esAdmin && (
            <button className="btn btn-primary" onClick={() => abrirFormulario()}><PlusIcon size={16} /> Nueva cuenta</button>
          )}
        </div>
        {cuentas.length === 0 ? (
          <div className="empty-state">{MENSAJES_BANCO.sinCuentas}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Banco</th><th>Número de cuenta</th><th>Titular</th><th>Saldo actual</th><th>Estado</th>
                  {esAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id} style={!c.activa ? { opacity: 0.6 } : undefined}>
                    <td><strong>{c.banco}</strong></td>
                    <td>{c.numero}</td>
                    <td>{c.titular}</td>
                    <td><strong>{bs(saldoCuenta(c, movBanco))}</strong></td>
                    <td>
                      <span className={`status ${c.activa ? "status-success" : "status-warning"}`}><i />{c.activa ? "Activa" : "Inactiva"}</span>
                    </td>
                    {esAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-secondary" style={BTN_SM} onClick={() => abrirFormulario(c)}>Editar</button>
                          {c.activa && <button className="btn btn-secondary" style={BTN_SM} onClick={() => desactivar(c)}>Desactivar</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {esAdmin && (
        <Modal open={abierto} title={editando ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"} onClose={cerrarFormulario}>
          <div className="modal-form">
            <div className="form-grid">
              <label className="field">
                <span>Banco <b>*</b></span>
                <input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ej. Banco Nacional de Bolivia" />
                {mostrar(form.banco) && errores.banco && <small style={ERR}>{errores.banco}</small>}
              </label>
              <label className="field">
                <span>Número de cuenta <b>*</b></span>
                <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Ej. 1000-123456" />
                {mostrar(form.numero) && errores.numero && <small style={ERR}>{errores.numero}</small>}
              </label>
              <label className="field">
                <span>Titular <b>*</b></span>
                <input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} placeholder="Ej. Edificio Central" />
                {mostrar(form.titular) && errores.titular && <small style={ERR}>{errores.titular}</small>}
              </label>
              <label className="field">
                <span>Saldo de apertura (Bs.) <b>*</b></span>
                <input
                  value={form.apertura}
                  inputMode="decimal"
                  disabled={editando !== null}
                  onChange={(e) => setForm({ ...form, apertura: e.target.value })}
                  placeholder="Ej. 5000,00 (puede ser 0)"
                />
                {editando ? (
                  <small style={MUTED}>El saldo de apertura no se modifica una vez registrada la cuenta.</small>
                ) : (
                  mostrar(form.apertura) && errores.apertura && <small style={ERR}>{errores.apertura}</small>
                )}
              </label>
            </div>
            {errorServidor && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorServidor}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" disabled={guardando} onClick={cerrarFormulario}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando} onClick={guardar}>
                {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear cuenta"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// =====================================================================
// PESTAÑA "MOVIMIENTOS BANCARIOS"
// =====================================================================

function PestanaMovBanco({ esAdmin, caja, cajaMovs, setCajaMovs, cuentas, movBanco, setMovBanco, irACaja }: BancosProps) {
  const cuentasActivas = cuentas.filter((c) => c.activa);
  const [cuentaSel, setCuentaSel] = useState(() => String((cuentas.find((c) => c.activa) ?? cuentas[0])?.id ?? ""));
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoF, setTipoF] = useState("");
  const [estadoF, setEstadoF] = useState("");
  const [pagina, setPagina] = useState(1);

  // Registro
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"formulario" | "confirmar">("formulario");
  const [form, setForm] = useState<FormBanco>(formBancoVacio(""));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");
  const [errorAdjunto, setErrorAdjunto] = useState("");

  // Anulación
  const [objetivo, setObjetivo] = useState<MovBanco | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulIntentado, setAnulIntentado] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [errorAnulacion, setErrorAnulacion] = useState("");

  const cuenta = cuentas.find((c) => String(c.id) === cuentaSel) ?? null;
  const saldo = cuenta ? saldoCuenta(cuenta, movBanco) : 0;
  const saldoCajaActual = saldoVigente(caja.monto, cajaMovs);

  const delaCuenta = cuenta ? movBanco.filter((m) => m.cuentaId === cuenta.id) : [];
  const vigentes = delaCuenta.filter(esVigenteBanco);
  const pendientes = vigentes.filter((m) => !m.conciliado).length;
  const conciliados = vigentes.filter((m) => m.conciliado).length;

  // ---------- Registro ----------
  const opcion = OPCIONES_TIPO.find((o) => o.valor === form.opcion) ?? null;
  const cuentaForm = cuentas.find((c) => String(c.id) === form.cuentaId) ?? null;
  const saldoForm = cuentaForm ? saldoCuenta(cuentaForm, movBanco) : 0;
  const monto = validarMonto(form.monto, "monto");
  const errores = {
    cuenta: form.cuentaId === "" ? MENSAJES.campoObligatorio("cuenta") : "",
    fecha:
      form.fecha === ""
        ? MENSAJES.campoObligatorio("fecha")
        : form.fecha > hoyISO()
        ? "La fecha no puede ser futura."
        : "",
    tipo: opcion === null ? MENSAJES.campoObligatorio("tipo") : "",
    monto: monto.error,
    referencia: form.referencia.trim() === "" ? MENSAJES.campoObligatorio("referencia") : "",
    concepto: validarConcepto(form.concepto),
  };
  const hayErrores = Object.values(errores).some(Boolean);

  // Un movimiento que resta no puede superar el saldo de la cuenta
  const excedeCuenta = opcion?.signo === -1 && monto.valor !== null && cuentaForm !== null && monto.valor > saldoForm;
  // Retiro y Depósito pueden registrarse también en caja
  const permiteCaja = opcion?.tipo === "Retiro" || opcion?.tipo === "Depósito";
  const enCaja = permiteCaja && form.enCaja && caja.abierta;
  const excedeCaja = enCaja && opcion?.tipo === "Depósito" && monto.valor !== null && monto.valor > saldoCajaActual;
  const saldoNuevo = monto.valor !== null && opcion !== null ? r2(saldoForm + opcion.signo * monto.valor) : saldoForm;
  const textoMontoCaja = monto.valor !== null ? bs(monto.valor) : "el monto indicado";

  function abrirFormulario() {
    const inicial = cuenta?.activa ? cuentaSel : String(cuentasActivas[0]?.id ?? "");
    setForm(formBancoVacio(inicial));
    setPaso("formulario");
    setIntentado(false);
    setErrorServidor("");
    setErrorAdjunto("");
    setAviso(null);
    setAbierto(true);
  }
  function cerrarFormulario() {
    if (guardando) return;
    setAbierto(false);
  }
  function cambiarAdjunto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null;
    if (!archivo) {
      setForm((f) => ({ ...f, adjunto: null }));
      setErrorAdjunto("");
      return;
    }
    const extension = (archivo.name.split(".").pop() || "").toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension)) {
      setErrorAdjunto(MENSAJES_BANCO.adjuntoFormato);
      setForm((f) => ({ ...f, adjunto: null }));
      e.target.value = "";
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setErrorAdjunto(MENSAJES_BANCO.adjuntoTamano);
      setForm((f) => ({ ...f, adjunto: null }));
      e.target.value = "";
      return;
    }
    setErrorAdjunto("");
    setForm((f) => ({ ...f, adjunto: archivo }));
  }
  function continuar() {
    setIntentado(true);
    if (hayErrores || excedeCuenta || excedeCaja) return;
    setPaso("confirmar");
  }
  async function confirmarMovimiento() {
    if (guardando || opcion === null || monto.valor === null) return;
    setGuardando(true);
    setErrorServidor("");
    try {
      const res = await registrarMovBancoApi(
        {
          cuentaId: Number(form.cuentaId),
          fecha: form.fecha,
          tipo: opcion.tipo,
          signo: opcion.signo,
          monto: monto.valor,
          referencia: form.referencia,
          concepto: form.concepto,
          enCaja,
          adjunto: form.adjunto ? form.adjunto.name : null,
        },
        cuentas,
        movBanco,
        caja,
        cajaMovs
      );
      setMovBanco((prev) => [...prev, res.mov]);
      if (res.cajaMov) {
        const nuevoCaja = res.cajaMov;
        setCajaMovs((prev) => [...prev, nuevoCaja]);
      }
      setCuentaSel(form.cuentaId);
      setPagina(1);
      setAbierto(false);
      const cuentaUsada = cuentas.find((c) => c.id === res.mov.cuentaId);
      setAviso({
        tipo: "ok",
        texto: MENSAJES_BANCO.movimientoRegistrado(res.mov.numero, cuentaUsada ? etiquetaCuenta(cuentaUsada) : "", res.mov.saldoPosterior),
      });
    } catch (e) {
      // Se muestra el mensaje recibido y se conservan los datos del formulario
      setErrorServidor(e instanceof Error ? e.message : "No se pudo registrar el movimiento. Intenta nuevamente.");
      setPaso("formulario");
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Conciliación ----------
  function conciliar(numero: string) {
    // BACKEND: PATCH /bancos/movimientos/{numero}/conciliar
    setMovBanco((prev) => prev.map((x) => (x.numero === numero ? { ...x, conciliado: true } : x)));
    setAviso({ tipo: "ok", texto: `Movimiento ${numero} conciliado.` });
  }

  // ---------- Anulación ----------
  const cuentaObjetivo = objetivo ? cuentas.find((c) => c.id === objetivo.cuentaId) ?? null : null;
  const saldoObjetivo = cuentaObjetivo ? saldoCuenta(cuentaObjetivo, movBanco) : 0;
  const saldoTrasAnular = objetivo ? r2(saldoObjetivo - objetivo.signo * objetivo.monto) : 0;
  const anulacionNegativa = objetivo !== null && saldoTrasAnular < 0;
  const vinculadoCaja = objetivo?.vinculoCaja ? cajaMovs.find((x) => x.numero === objetivo.vinculoCaja) : undefined;
  const cajaTrasAnular =
    vinculadoCaja && !vinculadoCaja.anulado
      ? r2(saldoCajaActual + (vinculadoCaja.tipo === "ENTRADA" ? -vinculadoCaja.monto : vinculadoCaja.monto))
      : null;
  const cajaNegativa = cajaTrasAnular !== null && cajaTrasAnular < 0;
  const errorMotivo = validarMotivo(motivo);

  function abrirAnulacion(mov: MovBanco) {
    setObjetivo(mov);
    setMotivo("");
    setAnulIntentado(false);
    setErrorAnulacion("");
    setAviso(null);
  }
  async function confirmarAnulacion() {
    if (anulando || !objetivo) return;
    setAnulIntentado(true);
    if (errorMotivo || anulacionNegativa || cajaNegativa) return;
    const numero = objetivo.numero;
    setAnulando(true);
    setErrorAnulacion("");
    try {
      const res = await anularMovBancoApi(numero, motivo.trim(), cuentas, movBanco, caja, cajaMovs);
      setMovBanco((prev) => [...prev.map((x) => (x.numero === numero ? { ...x, anulado: res.anulado } : x)), res.contrario]);
      const { cajaAnulado, cajaContrario } = res;
      if (cajaAnulado && cajaContrario) {
        setCajaMovs((prev) => [
          ...prev.map((x) => (x.numero === cajaAnulado.numero ? { ...x, anulado: cajaAnulado.anulado } : x)),
          cajaContrario,
        ]);
      }
      setObjetivo(null);
      setAviso({ tipo: "ok", texto: MENSAJES_BANCO.movimientoAnulado(numero) });
    } catch (e) {
      setErrorAnulacion(e instanceof Error ? e.message : "No se pudo anular el movimiento. Intenta nuevamente.");
    } finally {
      setAnulando(false);
    }
  }

  // ---------- Filtros y paginación ----------
  const filtrados = delaCuenta
    .filter(
      (x) =>
        (desde === "" || x.fecha >= desde) &&
        (hasta === "" || x.fecha <= hasta) &&
        (tipoF === "" || x.tipo === tipoF) &&
        (estadoF === "" || estadoDe(x) === estadoF)
    )
    .sort(masRecientesBanco);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const rangoInvalido = desde !== "" && hasta !== "" && desde > hasta;

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setTipoF("");
    setEstadoF("");
    setPagina(1);
  }

  if (cuentas.length === 0) {
    return <div className="panel"><div className="empty-state">{MENSAJES_BANCO.sinCuentas}</div></div>;
  }

  return (
    <>
      {aviso && (
        <div className={aviso.tipo === "ok" ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: 16 }}>{aviso.texto}</div>
      )}

      {/* Saldo destacado de la cuenta seleccionada */}
      {cuenta && (
        <TarjetaSaldo
          etiqueta={`Saldo · ${etiquetaCuenta(cuenta)}`}
          monto={bs(saldo)}
          detalle={`Titular: ${cuenta.titular}`}
          insignia={
            <span className={`status ${cuenta.activa ? "status-success" : "status-warning"}`}>
              <i />{cuenta.activa ? "Activa" : "Inactiva"}
            </span>
          }
        />
      )}

      {/* Selector de cuenta */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <label className="field" style={{ minWidth: 280 }}>
            <span>Cuenta bancaria</span>
            <select value={cuentaSel} onChange={(e) => { setCuentaSel(e.target.value); setPagina(1); }}>
              {cuentas.map((c) => (
                <option key={c.id} value={String(c.id)}>{etiquetaCuenta(c)}{c.activa ? "" : " (inactiva)"}</option>
              ))}
            </select>
          </label>
          {esAdmin && (
            <button className="btn btn-primary" disabled={cuentasActivas.length === 0} onClick={abrirFormulario}>
              <PlusIcon size={16} /> Registrar movimiento
            </button>
          )}
        </div>
        {cuenta && !cuenta.activa && (
          <div className="alert" style={{ ...AVISO, margin: "0 24px 16px" }}>{MENSAJES_BANCO.cuentaInactiva}</div>
        )}
      </section>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon attention"><WalletIcon size={20} /></div>
          <div><span>Pendientes de conciliar</span><strong>{pendientes}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Conciliados</span><strong>{conciliados}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><FileIcon size={20} /></div>
          <div><span>Movimientos vigentes</span><strong>{vigentes.length}</strong></div>
        </div>
      </div>

      {/* Filtros */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>Combina rango de fechas, tipo y estado de conciliación.</p>
          </div>
          <button className="btn btn-secondary" onClick={limpiarFiltros}>Limpiar filtros</button>
        </div>
        <div className="modal-form" style={{ paddingTop: 8 }}>
          <div className="form-grid">
            <label className="field">
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }} />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={tipoF} onChange={(e) => { setTipoF(e.target.value); setPagina(1); }}>
                <option value="">Todos</option>
                {TIPOS_BANCO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Estado de conciliación</span>
              <select value={estadoF} onChange={(e) => { setEstadoF(e.target.value); setPagina(1); }}>
                <option value="">Todos</option>
                <option value="Conciliado">Conciliado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Anulado">Anulado</option>
              </select>
            </label>
          </div>
          {rangoInvalido && <div className="alert alert-error" style={{ marginTop: 12 }}>La fecha inicial no puede ser posterior a la fecha final.</div>}
        </div>
      </section>

      {/* Tabla de movimientos */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Movimientos bancarios</h3>
            <p>Los movimientos no se eliminan ni se modifican: se anulan y permanecen en el historial.</p>
          </div>
        </div>
        {filtrados.length === 0 ? (
          <div className="empty-state">{MENSAJES_BANCO.sinResultados}</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Número</th><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Concepto</th><th>Monto</th>
                    <th>Saldo posterior</th><th>Origen</th><th>Estado de conciliación</th>
                    {esAdmin && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((x) => (
                    <tr key={x.numero} style={x.anulado ? { opacity: 0.55 } : undefined}>
                      <td>{x.numero}</td>
                      <td>{fechaCorta(x.fecha)}</td>
                      <td>{x.tipo}</td>
                      <td>{x.referencia}</td>
                      <td>
                        {x.concepto}
                        {x.vinculoCaja && <div style={MUTED}>Vinculado a {x.vinculoCaja}</div>}
                        {x.adjunto && <div style={MUTED}>Adjunto: {x.adjunto}</div>}
                      </td>
                      <td><ImporteBanco mov={x} /></td>
                      <td>{bs(x.saldoPosterior)}</td>
                      <td><span className="tag">{x.origen}</span></td>
                      <td><EstadoConciliacion estado={estadoDe(x)} /></td>
                      {esAdmin && (
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            {x.anulado ? (
                              <span style={MUTED}>Anulado por {x.anulado.usuario}</span>
                            ) : x.anulaA ? (
                              <span style={MUTED}>Anula a {x.anulaA}</span>
                            ) : (
                              <>
                                {!x.conciliado && (
                                  <button className="btn btn-secondary" style={BTN_SM} onClick={() => conciliar(x.numero)}>Conciliar</button>
                                )}
                                {x.origen === "Manual" ? (
                                  <button className="btn btn-secondary" style={BTN_SM} onClick={() => abrirAnulacion(x)}>Anular</button>
                                ) : (
                                  // Los movimientos automáticos no se anulan desde bancos
                                  <>
                                    <span style={MUTED}>Se anula desde {x.origen}</span>
                                    <EnlaceOrigenBanco mov={x} irACaja={irACaja} />
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion
              total={filtrados.length}
              pagina={paginaActual}
              totalPaginas={totalPaginas}
              onCambiar={setPagina}
              singular="movimiento"
              plural="movimientos"
            />
          </>
        )}
      </section>

      {/* ---------- Registro de movimiento ---------- */}
      {esAdmin && (
        <Modal open={abierto} title="Registrar movimiento bancario" onClose={cerrarFormulario}>
          {paso === "formulario" ? (
            <div className="modal-form">
              <div className="form-grid">
                <label className="field">
                  <span>Cuenta bancaria <b>*</b></span>
                  <select value={form.cuentaId} onChange={(e) => setForm({ ...form, cuentaId: e.target.value })}>
                    <option value="">Selecciona una cuenta</option>
                    {cuentasActivas.map((c) => <option key={c.id} value={String(c.id)}>{etiquetaCuenta(c)}</option>)}
                  </select>
                  {intentado && errores.cuenta && <small style={ERR}>{errores.cuenta}</small>}
                  {cuentaForm && <small style={MUTED}>{MENSAJES_BANCO.saldoDeCuenta(etiquetaCuenta(cuentaForm), saldoForm)}</small>}
                </label>
                <label className="field">
                  <span>Fecha <b>*</b></span>
                  <input type="date" max={hoyISO()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  {errores.fecha && <small style={ERR}>{errores.fecha}</small>}
                </label>
                <label className="field">
                  <span>Tipo <b>*</b></span>
                  <select value={form.opcion} onChange={(e) => setForm({ ...form, opcion: e.target.value, enCaja: false })}>
                    <option value="">Selecciona el tipo</option>
                    {OPCIONES_TIPO.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                  </select>
                  {intentado && errores.tipo && <small style={ERR}>{errores.tipo}</small>}
                </label>
                <label className="field">
                  <span>Monto (Bs.) <b>*</b></span>
                  <input value={form.monto} inputMode="decimal" onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="Ej. 500,00" />
                  {(intentado || form.monto !== "") && errores.monto && <small style={ERR}>{errores.monto}</small>}
                </label>
                <label className="field">
                  <span>Referencia <b>*</b></span>
                  <input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="N° de operación o referencia" />
                  {(intentado || form.referencia !== "") && errores.referencia && <small style={ERR}>{errores.referencia}</small>}
                </label>
              </div>

              <label className="field" style={{ marginTop: 12 }}>
                <span>Concepto <b>*</b></span>
                <input value={form.concepto} maxLength={300} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Describe el movimiento (10 a 255 caracteres)" />
                <small style={MUTED}>{form.concepto.trim().length}/255 caracteres</small>
                {(intentado || form.concepto !== "") && errores.concepto && <small style={ERR}>{errores.concepto}</small>}
              </label>

              {/* Casilla "Registrar también en caja" para Retiro y Depósito */}
              {permiteCaja && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.enCaja}
                      disabled={!caja.abierta}
                      onChange={(e) => setForm({ ...form, enCaja: e.target.checked })}
                      style={{ width: "auto", minHeight: "auto" }}
                    />
                    Registrar también en caja
                  </label>
                  {!caja.abierta ? (
                    <small style={MUTED}>{MENSAJES.cajaSinAbrir}</small>
                  ) : form.enCaja ? (
                    <small style={MUTED}>
                      Se registrará {opcion?.tipo === "Retiro" ? "una entrada" : "una salida"} de caja por {textoMontoCaja}.
                    </small>
                  ) : null}
                </div>
              )}

              <label className="field" style={{ marginTop: 12 }}>
                <span>Adjunto (opcional)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={cambiarAdjunto} />
                {errorAdjunto && <small style={ERR}>{errorAdjunto}</small>}
                {form.adjunto && <small style={MUTED}>{form.adjunto.name}</small>}
              </label>

              {/* Monto mayor al saldo → mensaje en rojo y Guardar deshabilitado */}
              {excedeCuenta && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 12 }}>{MENSAJES_BANCO.montoExcede(saldoForm)}</p>
              )}
              {excedeCaja && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 12 }}>{MENSAJES_BANCO.cajaInsuficiente(saldoCajaActual)}</p>
              )}
              {errorServidor && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorServidor}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cerrarFormulario}>Cancelar</button>
                <button className="btn btn-primary" disabled={excedeCuenta || excedeCaja} onClick={continuar}>Guardar</button>
              </div>
            </div>
          ) : (
            <div className="modal-form">
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                {opcion !== null && monto.valor !== null && cuentaForm !== null
                  ? MENSAJES_BANCO.confirmarMovimiento(opcion.tipo.toLowerCase(), monto.valor, etiquetaCuenta(cuentaForm))
                  : ""}
              </p>
              <p style={{ fontSize: 13, color: "#766E69", margin: 0 }}>{MENSAJES.saldoDespues(saldoNuevo)}</p>
              {enCaja && opcion !== null && (
                <p style={{ fontSize: 13, color: "#766E69", margin: "8px 0 0" }}>
                  También se registrará {opcion.tipo === "Retiro" ? "una entrada" : "una salida"} de caja por {textoMontoCaja}.
                </p>
              )}
              <div className="modal-actions">
                <button className="btn btn-secondary" disabled={guardando} onClick={() => setPaso("formulario")}>Cancelar</button>
                <button className="btn btn-primary" disabled={guardando} onClick={confirmarMovimiento}>
                  {guardando ? "Guardando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ---------- Anulación ---------- */}
      {esAdmin && (
        <Modal open={objetivo !== null} title="Anular movimiento bancario" onClose={() => { if (!anulando) setObjetivo(null); }}>
          {objetivo && (
            <div className="modal-form">
              <div style={FILA}><span>Movimiento</span><strong>{objetivo.numero}</strong></div>
              <div style={FILA}><span>Concepto</span><strong>{objetivo.concepto}</strong></div>
              <div style={FILA}><span>Monto</span><strong>{bs(objetivo.monto)}</strong></div>

              <label className="field" style={{ marginTop: 14 }}>
                <span>Motivo de anulación <b>*</b></span>
                <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Explica por qué se anula (10 a 255 caracteres)" />
                <small style={MUTED}>{motivo.trim().length}/255 caracteres</small>
                {(anulIntentado || motivo !== "") && errorMotivo && <small style={ERR}>{errorMotivo}</small>}
              </label>

              <div className="alert" style={{ ...AVISO, marginTop: 12 }}>
                {MENSAJES_BANCO.confirmarAnulacion(objetivo.numero, objetivo.monto, saldoTrasAnular)}
                {vinculadoCaja && !vinculadoCaja.anulado && (
                  <div style={{ marginTop: 6 }}>También se anulará el movimiento de caja vinculado {vinculadoCaja.numero}.</div>
                )}
              </div>
              {anulacionNegativa && cuentaObjetivo && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 10 }}>
                  {MENSAJES_BANCO.anulacionNegativa(objetivo.numero, etiquetaCuenta(cuentaObjetivo), saldoTrasAnular)}
                </p>
              )}
              {cajaNegativa && vinculadoCaja && cajaTrasAnular !== null && (
                <p style={{ color: "#9F2727", fontSize: 12, fontWeight: 600, marginTop: 10 }}>
                  {MENSAJES.anulacionNegativa(vinculadoCaja.numero, cajaTrasAnular)}
                </p>
              )}
              {errorAnulacion && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorAnulacion}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" disabled={anulando} onClick={() => setObjetivo(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={anulando || anulacionNegativa || cajaNegativa} onClick={confirmarAnulacion}>
                  {anulando ? "Anulando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// =====================================================================
// 12. PÁGINA
// =====================================================================

const PESTANAS: [Vista, string][] = [
  ["saldo", "Saldo de caja"],
  ["caja", "Movimientos de caja"],
  ["cuentas", "Cuentas bancarias"],
  ["bancos", "Movimientos bancarios"],
];

export default function CajaBancosPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");
  const puedeConsultar = esAdmin || rol.startsWith("DIRECTORIO") || rol.startsWith("CONSULTA");

  const [vista, setVista] = useState<Vista>("saldo");
  const [caja, setCaja] = useState<Caja>(CAJA_INICIAL);
  const [cajaMovs, setCajaMovs] = useState<MovCaja[]>(CAJA_MOVS_INICIALES);
  const [cuentas, setCuentas] = useState<Cuenta[]>(CUENTAS_INICIALES);
  const [movBanco, setMovBanco] = useState<MovBanco[]>(MOV_BANCO_INICIALES);

  if (!puedeConsultar) {
    return (
      <DashboardLayout active="caja-bancos">
        <div className="panel">
          <div className="empty-state">Acceso denegado. No tienes permiso para consultar caja y bancos.</div>
        </div>
      </DashboardLayout>
    );
  }

  const propsBancos: BancosProps = {
    esAdmin, caja, cajaMovs, setCajaMovs, cuentas, setCuentas, movBanco, setMovBanco,
    irACaja: () => setVista("caja"),
  };

  return (
    <DashboardLayout active="caja-bancos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-04 · CAJA Y BANCOS</p>
          <h1>Caja y bancos</h1>
          <p>
            Control del efectivo de caja y de las cuentas bancarias del edificio.
            {!esAdmin && " Modo de consulta: puedes revisar saldos y movimientos."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {PESTANAS.map(([id, texto]) => (
          <button key={id} className={vista === id ? "filter-chip active" : "filter-chip"} aria-pressed={vista === id} onClick={() => setVista(id)}>
            {texto}
          </button>
        ))}
      </div>

      {vista === "saldo" && (
        <PestanaSaldo esAdmin={esAdmin} caja={caja} cajaMovs={cajaMovs} irAMovimientos={() => setVista("caja")} />
      )}
      {vista === "caja" && (
        <PestanaMovCaja
          esAdmin={esAdmin}
          caja={caja}
          setCaja={setCaja}
          cajaMovs={cajaMovs}
          setCajaMovs={setCajaMovs}
          irABancos={() => setVista("bancos")}
        />
      )}
      {vista === "cuentas" && <PestanaCuentas {...propsBancos} />}
      {vista === "bancos" && <PestanaMovBanco {...propsBancos} />}
    </DashboardLayout>
  );
}