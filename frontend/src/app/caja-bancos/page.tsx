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
 * Datos: vienen del backend. Las llamadas y la conversión de los datos
 * están en lib/caja-bancos.ts.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { BuildingIcon, CheckIcon, FileIcon, PlusIcon, WalletIcon } from "../../../components/Icons";
import {
  cargarTodo,
  abrirCaja as abrirCajaEnServidor,
  anularMovCaja,
  listarMovCaja,
  listarMovBanco,
  crearCuenta,
  actualizarCuenta,
  desactivarCuenta,
  crearMovBanco,
  anularMovBanco,
  conciliarMovBanco,
  consultarSaldoCaja,
  exportarSaldoCaja,
} from "@/lib/caja-bancos";
import type {
  Caja,
  Cuenta,
  MovBanco,
  MovCaja,
  OrigenCaja,
  TipoBanco,
  TipoCaja,
} from "@/lib/caja-bancos";

// =====================================================================
// 1. TIPOS
// =====================================================================

type Vista = "saldo" | "caja" | "cuentas" | "bancos";
type Aviso = { tipo: "ok" | "error"; texto: string };

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

type PuntoSaldo = { fecha: string; saldo: number };

type ResultadoSaldo = {
  inicial: number;
  entradas: number;
  salidas: number;
  final: number;
  calculadoEn: string;
  periodo: MovCaja[];
  ultimos: MovCaja[];
  serie: PuntoSaldo[]; // evolución del saldo en el período
};

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
// 4. UTILIDADES
// =====================================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
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
  saldoDespues: (saldo: number) => `Saldo después del movimiento: ${bs(saldo)}`,
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
// 7. LLAMADAS AL BACKEND (las funciones reales están en lib/caja-bancos.ts)
// =====================================================================

/** Un movimiento anulado y su contrario no forman parte del saldo. */
const esVigente = (m: MovCaja) => !m.anulado && !m.anulaA;

function saldoVigente(montoInicial: number, movs: MovCaja[], hasta?: string) {
  const suma = movs
    .filter((m) => esVigente(m) && (!hasta || m.fecha <= hasta))
    .reduce((s, m) => s + (m.tipo === "ENTRADA" ? m.monto : -m.monto), 0);
  return r2(montoInicial + suma);
}
const masRecientes = (a: MovCaja, b: MovCaja) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero);
const masAntiguos = (a: MovCaja, b: MovCaja) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero);

async function abrirCajaApi(monto: number, fecha: string, caja: Caja): Promise<Caja> {
  if (caja.abierta) throw new Error(MENSAJES.cajaYaAbierta(caja.fecha));
  return abrirCajaEnServidor(monto, fecha);
}

async function anularMovCajaApi(numero: string, motivo: string, caja: Caja, movs: MovCaja[]) {
  const mov = movs.find((x) => x.numero === numero);
  if (!mov) throw new Error("El movimiento no existe.");
  if (mov.anulado) throw new Error(MENSAJES.yaAnulado(mov.numero, mov.anulado.fecha.slice(0, 10)));
  if (mov.origen !== "Manual") {
    throw new Error(`El movimiento ${mov.numero} fue generado por ${mov.origen}. Anúlalo desde su registro de origen.`);
  }
  const resultante = r2(saldoVigente(caja.monto, movs) + (mov.tipo === "ENTRADA" ? -mov.monto : mov.monto));
  if (resultante < 0) throw new Error(MENSAJES.anulacionNegativa(mov.numero, resultante));

  await anularMovCaja(numero, motivo);

  // Se recarga la lista para obtener el original anulado y su contrario ya adaptados.
  const lista = await listarMovCaja();
  const anulado = lista.find((x) => x.numero === numero)?.anulado;
  const contrario = lista.find((x) => x.anulaA === numero);
  if (!anulado || !contrario) {
    throw new Error("La anulación se registró, pero no se pudo actualizar la lista. Recarga la página.");
  }
  return { anulado, contrario };
}

/** "2026-10-26T04:05:00.000Z" → "26/10/2026 00:05" (hora local del navegador) */
function fechaHoraDe(iso: string) {
  const d = new Date(iso);
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${fechaCorta(dia)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function consultarSaldoApi(corte: string, desde: string, caja: Caja, movs: MovCaja[]): Promise<ResultadoSaldo> {
  if (FALLA_SIMULADA) throw new Error("Fallo del servicio.");
  // Saldo, totales y últimos movimientos los calcula el backend (GET /caja/saldo)
  const r = await consultarSaldoCaja(corte, desde || undefined);
  const { inicial, entradas, salidas } = r;
  const inicio = r.desde;
  const delPeriodo = movs.filter((m) => m.fecha >= inicio && m.fecha <= corte);
  const vigentes = delPeriodo.filter(esVigente);

  // Los últimos movimientos se toman de la lista ya cargada (mismo formato que la tabla)
  const porNumero = new Map(movs.map((m) => [m.numero, m]));
  const ultimos = r.ultimos.flatMap((numero) => porNumero.get(numero) ?? []);

  // Serie de saldos para el gráfico: un punto por fecha con movimientos vigentes
  const porFecha = new Map<string, number>();
  for (const m of vigentes) {
    porFecha.set(m.fecha, (porFecha.get(m.fecha) ?? 0) + (m.tipo === "ENTRADA" ? m.monto : -m.monto));
  }
  const serie: PuntoSaldo[] = [{ fecha: inicio, saldo: inicial }];
  let acumulado = inicial;
  for (const fecha of Array.from(porFecha.keys()).sort()) {
    acumulado = r2(acumulado + (porFecha.get(fecha) ?? 0));
    serie.push({ fecha, saldo: acumulado });
  }
  if (serie[serie.length - 1].fecha !== corte) serie.push({ fecha: corte, saldo: acumulado });

  return {
    inicial,
    entradas,
    salidas,
    final: r.final,
    calculadoEn: fechaHoraDe(r.calculadoEn),
    periodo: [...delPeriodo].sort(masAntiguos),
    ultimos,
    serie,
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
/** Gráfico de líneas en escalera: cómo cambia el saldo de caja a lo largo del período consultado. */
function GraficoEvolucionSaldo({ serie }: { serie: PuntoSaldo[] }) {
  if (serie.length < 2 || serie[0].fecha === serie[serie.length - 1].fecha) {
    return <div className="empty-state">Elige un período de más de un día para ver la evolución del saldo.</div>;
  }

  const ancho = 640;
  const alto = 230;
  const izq = 62;
  const der = 18;
  const arriba = 16;
  const abajo = 30;

  const dia = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Math.round(Date.UTC(a, m - 1, d) / 86400000);
  };
  const isoDeDia = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);

  const d0 = dia(serie[0].fecha);
  const span = Math.max(dia(serie[serie.length - 1].fecha) - d0, 1);
  const saldos = serie.map((p) => p.saldo);
  const minS = Math.min(...saldos);
  const maxS = Math.max(...saldos);
  const relleno = Math.max((maxS - minS) * 0.15, 50);
  const yMin = Math.max(minS - relleno, 0);
  const yMax = maxS + relleno;

  const x = (iso: string) => izq + ((dia(iso) - d0) / span) * (ancho - izq - der);
  const y = (v: number) => arriba + (1 - (v - yMin) / (yMax - yMin)) * (alto - arriba - abajo);
  const base = alto - abajo;

  let trazo = `M ${x(serie[0].fecha)} ${y(serie[0].saldo)}`;
  for (let i = 1; i < serie.length; i++) {
    trazo += ` L ${x(serie[i].fecha)} ${y(serie[i - 1].saldo)} L ${x(serie[i].fecha)} ${y(serie[i].saldo)}`;
  }
  const area = `${trazo} L ${x(serie[serie.length - 1].fecha)} ${base} L ${x(serie[0].fecha)} ${base} Z`;

  const puntoMin = serie.reduce((a, b) => (b.saldo < a.saldo ? b : a));
  const puntoMax = serie.reduce((a, b) => (b.saldo > a.saldo ? b : a));

  return (
    <>
      <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" role="img" aria-label="Evolución del saldo de caja">
        {[0, 1, 2, 3].map((i) => {
          const v = yMin + ((yMax - yMin) * i) / 3;
          return (
            <g key={`y-${i}`}>
              <line x1={izq} x2={ancho - der} y1={y(v)} y2={y(v)} stroke="#F0EAE5" />
              <text x={izq - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9A918B">
                {v.toLocaleString("es-BO", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}

        <path d={area} fill="rgba(193,51,51,0.08)" />
        <path d={trazo} fill="none" stroke="#C13333" strokeWidth="2" strokeLinejoin="round" />

        {serie.map((p, i) => (
          <circle key={`p-${i}`} cx={x(p.fecha)} cy={y(p.saldo)} r="3.5" fill="#fff" stroke="#C13333" strokeWidth="2">
            <title>{`${fechaCorta(p.fecha)}: ${bs(p.saldo)}`}</title>
          </circle>
        ))}

        {[0, 1, 2, 3].map((i) => {
          const iso = isoDeDia(Math.round(d0 + (span * i) / 3));
          return (
            <text
              key={`x-${i}`}
              x={x(iso)}
              y={alto - 8}
              textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
              fontSize="11"
              fill="#9A918B"
            >
              {fechaCorta(iso).slice(0, 5)}
            </text>
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12, color: "#766E69", marginTop: 8 }}>
        <span>Saldo más alto: <strong>{bs(puntoMax.saldo)}</strong> ({fechaCorta(puntoMax.fecha)})</span>
        <span>Saldo más bajo: <strong>{bs(puntoMin.saldo)}</strong> ({fechaCorta(puntoMin.fecha)})</span>
      </div>
    </>
  );
}
// =====================================================================
// 9. PESTAÑA "SALDO DE CAJA"
// =====================================================================

type RespuestaSaldo = { clave: string; datos: ResultadoSaldo | null };

function PestanaSaldo({ esAdmin, caja, cajaMovs, irAMovimientos }: {
  esAdmin: boolean; caja: Caja; cajaMovs: MovCaja[]; irAMovimientos: () => void;
}) {
  // Sin el panel de consulta, el corte es siempre hoy y el período arranca en la apertura de caja
  const [corte] = useState(hoyISO());
  const [desde] = useState("");
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

  // El backend genera el archivo (GET /caja/saldo/exportar): PDF con el nombre del
  // edificio, quién lo emite y la fecha de emisión, y Excel (.xlsx)
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);

  async function exportar(formato: "pdf" | "excel", d: ResultadoSaldo) {
    if (exportando) return;
    if (d.periodo.length === 0) {
      alert(MENSAJES.sinDatosExportar);
      return;
    }
    setExportando(formato);
    try {
      await exportarSaldoCaja(formato, corte, desde || undefined);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo exportar. Intenta nuevamente.");
    } finally {
      setExportando(null);
    }
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
      {errorFecha ? (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>{errorFecha}</div>
      ) : cargando ? (
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
      <h3>Evolución del saldo</h3>
      <p>Saldo de caja a lo largo del período consultado, sin contar movimientos anulados.</p>
    </div>
  </div>
  <div style={{ padding: "12px 20px 20px" }}>
    <GraficoEvolucionSaldo serie={datos.serie} />
  </div>
</section>
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
                <button className="btn btn-secondary" disabled={exportando !== null} onClick={() => exportar("pdf", datos)}>
                  <FileIcon size={16} /> {exportando === "pdf" ? "Generando…" : "Exportar PDF"}
                </button>
                <button className="btn btn-secondary" disabled={exportando !== null} onClick={() => exportar("excel", datos)}>
                  <FileIcon size={16} /> {exportando === "excel" ? "Generando…" : "Exportar Excel"}
                </button>
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

      {/* Saldo destacado */}
      <TarjetaSaldo
        etiqueta="Saldo de caja"
        monto={bs(saldoActual)}
        detalle={`Caja abierta el ${fechaCorta(caja.fecha)}`}
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

// ---------- Llamadas al backend (bancos) ----------

async function guardarCuentaApi(datos: DatosCuenta, editId: number | null, cuentas: Cuenta[]): Promise<Cuenta> {
  const duplicada = cuentas.some(
    (c) =>
      c.id !== editId &&
      c.banco.trim().toLowerCase() === datos.banco.trim().toLowerCase() &&
      c.numero.trim().toLowerCase() === datos.numero.trim().toLowerCase()
  );
  if (duplicada) throw new Error(MENSAJES_BANCO.cuentaDuplicada(datos.numero, datos.banco));

  if (editId !== null) return actualizarCuenta(editId, datos);
  return crearCuenta(datos);
}

async function registrarMovBancoApi(
  n: NuevoMovBanco,
  cuentas: Cuenta[],
  movs: MovBanco[]
): Promise<{ mov: MovBanco; cajaMov: MovCaja | null }> {
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

  // El backend todavía ignora "enCaja": se bloquea para no dejar caja y banco descuadrados.
  if (n.enCaja) {
    throw new Error("El traspaso automático con la caja aún no está disponible en el servidor. Desmarca esa opción.");
  }

  const mov = await crearMovBanco({
    cuentaId: n.cuentaId,
    fecha: n.fecha,
    tipo: n.tipo,
    signo: n.signo,
    monto: n.monto,
    referencia,
    concepto: n.concepto.trim(),
  });
  return { mov: { ...mov, usuario: readNombre() }, cajaMov: null };
}

async function anularMovBancoApi(numero: string, motivo: string, cuentas: Cuenta[], movs: MovBanco[]) {
  const mov = movs.find((x) => x.numero === numero);
  if (!mov) throw new Error("El movimiento no existe.");
  if (mov.anulado) throw new Error(MENSAJES.yaAnulado(mov.numero, mov.anulado.fecha.slice(0, 10)));
  if (mov.origen !== "Manual") throw new Error(MENSAJES_BANCO.generadoPor(mov.numero, mov.origen));
  const cuenta = cuentas.find((c) => c.id === mov.cuentaId);
  if (!cuenta) throw new Error("La cuenta no existe.");
  if (!cuenta.activa) throw new Error(MENSAJES_BANCO.cuentaInactiva);

  const resultante = r2(saldoCuenta(cuenta, movs) - mov.signo * mov.monto);
  if (resultante < 0) {
    throw new Error(MENSAJES_BANCO.anulacionNegativa(mov.numero, etiquetaCuenta(cuenta), resultante));
  }

  await anularMovBanco(numero, motivo);

  const lista = await listarMovBanco();
  const anulado = lista.find((x) => x.numero === numero)?.anulado;
  const contrario = lista.find((x) => x.anulaA === numero);
  if (!anulado || !contrario) {
    throw new Error("La anulación se registró, pero no se pudo actualizar la lista. Recarga la página.");
  }
  return {
    anulado,
    contrario,
    cajaAnulado: null as MovCaja | null,
    cajaContrario: null as MovCaja | null,
  };
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

  async function desactivar(cuenta: Cuenta) {
    // Confirmación antes de desactivar
    if (!window.confirm(MENSAJES_BANCO.confirmarDesactivar(etiquetaCuenta(cuenta)))) return;
    try {
      await desactivarCuenta(cuenta.id);
      setCuentas((prev) => prev.map((c) => (c.id === cuenta.id ? { ...c, activa: false } : c)));
      setAviso({ tipo: "ok", texto: MENSAJES_BANCO.cuentaDesactivada(etiquetaCuenta(cuenta)) });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo desactivar la cuenta." });
    }
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
        movBanco
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
  async function conciliar(numero: string) {
    try {
      await conciliarMovBanco(numero);
      setMovBanco((prev) => prev.map((x) => (x.numero === numero ? { ...x, conciliado: true } : x)));
      setAviso({ tipo: "ok", texto: `Movimiento ${numero} conciliado.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo conciliar el movimiento." });
    }
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
      const res = await anularMovBancoApi(numero, motivo.trim(), cuentas, movBanco);
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

// CAMBIO: se quitaron las pestañas "Cuentas bancarias" y "Movimientos bancarios" (solo visual)
const PESTANAS: [Vista, string][] = [
  ["saldo", "Saldo de caja"],
  ["caja", "Movimientos de caja"],
];

export default function CajaBancosPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");
  const puedeConsultar = esAdmin || rol.startsWith("DIRECTORIO") || rol.startsWith("CONSULTA");

  const [vista, setVista] = useState<Vista>("saldo");
  const [caja, setCaja] = useState<Caja>({ abierta: false, fecha: "", monto: 0 });
  const [cajaMovs, setCajaMovs] = useState<MovCaja[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [movBanco, setMovBanco] = useState<MovBanco[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [recarga, setRecarga] = useState(0);

  // Carga inicial desde el backend (y cada vez que se pulsa "Reintentar")
  useEffect(() => {
    if (!puedeConsultar) return;
    let activo = true;
    cargarTodo()
      .then((d) => {
        if (!activo) return;
        setCaja(d.caja);
        setCajaMovs(d.cajaMovs);
        setCuentas(d.cuentas);
        setMovBanco(d.movBanco);
      })
      .catch((e) => {
        if (activo) setErrorCarga(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [puedeConsultar, recarga]);

  function reintentar() {
    setCargando(true);
    setErrorCarga("");
    setRecarga((n) => n + 1);
  }

  if (!puedeConsultar) {
    return (
      <DashboardLayout active="caja-bancos">
        <div className="panel">
          <div className="empty-state">Acceso denegado. No tienes permiso para consultar caja y bancos.</div>
        </div>
      </DashboardLayout>
    );
  }

  if (cargando) {
    return (
      <DashboardLayout active="caja-bancos">
        <div className="panel">
          <div className="empty-state">Cargando caja y bancos…</div>
        </div>
      </DashboardLayout>
    );
  }

  if (errorCarga) {
    return (
      <DashboardLayout active="caja-bancos">
        <div className="panel">
          <div className="empty-state">
            <p>{errorCarga}</p>
            <button className="btn btn-primary" onClick={reintentar}>Reintentar</button>
          </div>
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