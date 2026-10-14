"use client";

/**
 * Caja y bancos (EP-04)
 * ----------------------------------------------------------------------------
 * HU-22  Consultar saldo de caja        → pestaña "Saldo de caja"
 * HU-20  Registrar movimiento de caja   → pestaña "Movimientos de caja"
 * HU-21  Registrar movimiento bancario  → pestañas "Cuentas bancarias" y
 *                                         "Movimientos bancarios" (pendientes)
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

/** true → fuerza el estado de error de la HU-22 para probar el botón "Reintentar". */
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
// 5. MENSAJES (texto de los criterios de aceptación)
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

/** Un movimiento anulado y su contrario no forman parte del saldo (HU-22, criterio backend 3). */
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

// =====================================================================
// 9. PESTAÑA "SALDO DE CAJA" (HU-22)
// =====================================================================

type RespuestaSaldo = { clave: string; datos: ResultadoSaldo | null };

function PestanaSaldo({ esAdmin, caja, cajaMovs, irAMovimientos }: {
  esAdmin: boolean; caja: Caja; cajaMovs: MovCaja[]; irAMovimientos: () => void;
}) {
  const [corte, setCorte] = useState(hoyISO());
  const [desde, setDesde] = useState("");
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaSaldo | null>(null);

  // Criterio 2: la fecha de corte no puede ser futura ni anterior a la apertura de caja
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

  // Criterio 7: sin apertura no se muestra ningún saldo
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
          <section className="panel" style={{ marginBottom: 20 }}>
            <div style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 18 }}>
                  Saldo de caja al {fechaCorta(corte)}: <strong style={{ fontSize: 30 }}>{bs(datos.final)}</strong>
                </div>
                {datos.final === 0 && <span className="tag">Caja sin fondos</span>}
              </div>
              <small style={MUTED}>Actualizado: {datos.calculadoEn}</small>
            </div>
          </section>

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

          {/* COMPLEMENTO (no exigido por los criterios): flujo de caja del período. Se puede eliminar esta sección. */}
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
// 10. PESTAÑA "MOVIMIENTOS DE CAJA" (HU-20)
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

  // Filtros (criterio 14)
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoF, setTipoF] = useState("");
  const [origenF, setOrigenF] = useState("");
  const [pagina, setPagina] = useState(1);

  // Apertura de caja (criterio 2)
  const [aMonto, setAMonto] = useState("");
  const [aFecha, setAFecha] = useState(hoyISO());
  const [aIntentado, setAIntentado] = useState(false);
  const [aGuardando, setAGuardando] = useState(false);
  const [aServidor, setAServidor] = useState("");

  // Registro de movimiento (criterios 4 a 12)
  const [movAbierto, setMovAbierto] = useState(false);
  const [paso, setPaso] = useState<"formulario" | "confirmar">("formulario");
  const [form, setForm] = useState<FormMovimiento>(formVacio());
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");

  // Anulación (criterios 16 y 17)
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
  const excedeSaldo = form.tipo === "SALIDA" && monto.valor !== null && monto.valor > saldoActual; // criterio 8
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
    setPaso("confirmar"); // criterio 9
  }
  async function confirmarMovimiento() {
    if (guardando || form.tipo === "" || monto.valor === null) return; // criterio 10
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
      setAviso({ tipo: "ok", texto: MENSAJES.movimientoRegistrado(nuevo.numero, nuevo.saldoPosterior) }); // criterio 11
    } catch (e) {
      // criterio 12: se muestra el mensaje recibido y se conservan los datos ingresados
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
      setAviso({ tipo: "ok", texto: MENSAJES.movimientoAnulado(numero) }); // criterio 17
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

  // ---------- Caja sin abrir (criterio 2) ----------
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

      {/* Criterio 3: saldo destacado. Criterio 1: el botón solo se muestra al administrador. */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18 }}>
            Saldo de caja: <strong style={{ fontSize: 30 }}>{bs(saldoActual)}</strong>
          </div>
          {esAdmin && (
            <button className="btn btn-primary" onClick={abrirFormulario}><PlusIcon size={16} /> Registrar movimiento</button>
          )}
        </div>
      </section>

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
                            // Criterio 15: los movimientos automáticos no se anulan desde caja
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
// 11. PESTAÑAS DE BANCOS (HU-21) — PENDIENTES DE IMPLEMENTAR
// =====================================================================

// PENDIENTE: HU-21. Estas dos pestañas se reemplazan en la siguiente entrega.
function PestanaCuentas(props: BancosProps) {
  void props;
  return (
    <div className="panel">
      <div className="empty-state">Cuentas bancarias: pendiente de implementación (HU-21).</div>
    </div>
  );
}
function PestanaMovBanco(props: BancosProps) {
  void props;
  return (
    <div className="panel">
      <div className="empty-state">Movimientos bancarios: pendiente de implementación (HU-21).</div>
    </div>
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