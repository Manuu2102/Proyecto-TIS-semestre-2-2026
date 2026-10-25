"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import {
  obtenerCaja,
  listarMovCaja,
  listarCuentas,
  listarMovBanco,
} from "../../../lib/caja-bancos";
import type { Caja, Cuenta, MovBanco, MovCaja } from "../../../lib/caja-bancos";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { BuildingIcon, CheckIcon, CreditCardIcon, FileIcon, PlusIcon, WalletIcon } from "../../../components/Icons";

// =====================================================================
// Tipos de lo que responde el backend
// =====================================================================

type IngresoApi = {
  id: string;
  fecha: string;
  monto: string;
  descripcion: string | null;
  metodo: string;
  anulado: boolean;
  created_at: string;
  categoria?: { nombre: string };
};

type GastoApi = {
  id: string;
  fecha: string;
  monto: string;
  proveedor: string | null;
  descripcion: string | null;
  metodo: string;
  anulado: boolean;
  created_at: string;
  categoria?: { nombre: string };
};

type ResumenPagosApi = {
  departamentos: { id: string; numero: number; categoria: string; responsable: string; tarifa: number }[];
  deudas: { id: string; departamento: number; periodo: string; monto: number; mora: number; vencida: boolean }[];
  aFavor: Record<number, number>;
};

type PagoHistorialApi = {
  id: string;
  fecha: string;
  departamento: number;
  tipo: "Pago de expensa" | "Pago anticipado registrado";
  monto: number;
};

type MensualApi = { departamento: number; estado: "Pendiente" | "Pagado" };
type DeptoApi = { numero: number; ocupado: boolean };

// =====================================================================
// Tipos de lo que muestra la pantalla
// =====================================================================

type Alerta = { color: string; titulo: string; detalle: string; href: string };
type CajaResumen = { abierta: boolean; desde: string; saldo: number };
type CuentaResumen = { id: number; banco: string; numero: string; titular: string; saldo: number };
type PuntoSerie = { mes: string; ingresos: number; egresos: number };
type FilaMora = {
  numero: number;
  responsable: string;
  categoria: string;
  sinPagar: number;
  adeudado: number;
  mora: number;
};
type MovimientoReciente = {
  id: string;
  fecha: string;
  creado: string;
  tipo: "Ingreso" | "Gasto";
  categoria: string;
  descripcion: string;
  metodo: string;
  monto: number;
  anulado: boolean;
};

// Cada bloque es null cuando no se pudo cargar (por ejemplo, por permisos del rol)
type Datos = {
  periodoTxt: string;
  caja: CajaResumen | null;
  cuentas: CuentaResumen[] | null;
  serie: PuntoSerie[] | null;
  expensasMes: { generadas: number; ocupados: number; pagadas: number } | null;
  adeudado: number | null;
  moraAcumulada: number | null;
  enMora: FilaMora[] | null;
  ultimos: MovimientoReciente[] | null;
  incompleto: boolean;
};

// =====================================================================
// Utilidades
// =====================================================================

const ALTO = 150;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const AVISO = { background: "#fbf1df", color: "#a16d25", border: "1px solid #f0dcb4" };

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}
function dia(valor: string) {
  return String(valor).slice(0, 10);
}
function mayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}
function valor<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

/** Un movimiento anulado y su contrario no forman parte del saldo. */
function saldoCaja(caja: Caja, movs: MovCaja[]) {
  const suma = movs
    .filter((m) => !m.anulado && !m.anulaA)
    .reduce((s, m) => s + (m.tipo === "ENTRADA" ? m.monto : -m.monto), 0);
  return r2(caja.monto + suma);
}
function saldoCuenta(cuenta: Cuenta, movs: MovBanco[]) {
  const suma = movs
    .filter((m) => m.cuentaId === cuenta.id && !m.anulado && !m.anulaA)
    .reduce((s, m) => s + m.signo * m.monto, 0);
  return r2(cuenta.apertura + suma);
}

// =====================================================================
// Carga de datos
// Se arma con los endpoints que ya existen. Si el backend publica un
// GET /finanzas/resumen, solo hay que reemplazar esta función.
// =====================================================================

async function cargarFinanzas(): Promise<Datos> {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  const periodo = `${anio}-${String(mes + 1).padStart(2, "0")}`;

  const resultados = await Promise.allSettled([
    obtenerCaja(),
    listarMovCaja(),
    listarCuentas(),
    listarMovBanco(),
    api<{ ingresos: IngresoApi[] }>("/ingresos"),
    api<{ gastos: GastoApi[] }>("/gastos"),
    api<ResumenPagosApi>("/expensas/pagos/resumen"),
    api<PagoHistorialApi[]>("/expensas/pagos/historial"),
    api<MensualApi[]>(`/expensas/mensuales?periodo=${periodo}`),
    api<DeptoApi[]>("/expensas/departamentos"),
  ]);

  // Si todo falla (sin conexión, sesión vencida), se muestra el error
  if (resultados.every((r) => r.status === "rejected")) {
    const primero = resultados[0];
    throw primero.status === "rejected"
      ? primero.reason
      : new Error("No se pudieron cargar los datos financieros.");
  }

  const [rCaja, rMovCaja, rCuentas, rMovBanco, rIngresos, rGastos, rResumen, rHistorial, rMensuales, rDeptos] =
    resultados;

  // Caja
  const caja = valor(rCaja);
  const movCaja = valor(rMovCaja);
  const cajaResumen: CajaResumen | null =
    caja && movCaja
      ? { abierta: caja.abierta, desde: fechaCorta(caja.fecha), saldo: saldoCaja(caja, movCaja) }
      : null;

  // Cuentas activas con su saldo actual
  const cuentas = valor(rCuentas);
  const movBanco = valor(rMovBanco);
  const cuentasResumen: CuentaResumen[] | null =
    cuentas && movBanco
      ? cuentas
          .filter((c) => c.activa)
          .map((c) => ({
            id: c.id,
            banco: c.banco,
            numero: c.numero,
            titular: c.titular,
            saldo: saldoCuenta(c, movBanco),
          }))
      : null;

  // Ingresos vs egresos de los últimos 3 meses (sin movimientos anulados).
  // Ingresos = ingresos registrados + expensas cobradas.
  const ingresos = valor(rIngresos)?.ingresos ?? null;
  const gastos = valor(rGastos)?.gastos ?? null;
  const historial = valor(rHistorial);

  const meses = [2, 1, 0].map((atras) => {
    const d = new Date(anio, mes - atras, 1);
    return {
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      nombre: MESES_CORTOS[d.getMonth()],
    };
  });

  const serie: PuntoSerie[] | null =
    ingresos && gastos && historial
      ? meses.map(({ clave, nombre }) => ({
          mes: nombre,
          ingresos: r2(
            ingresos
              .filter((i) => !i.anulado && dia(i.fecha).startsWith(clave))
              .reduce((s, i) => s + Number(i.monto), 0) +
              historial
                .filter((p) => p.tipo === "Pago de expensa" && p.fecha.startsWith(clave))
                .reduce((s, p) => s + p.monto, 0)
          ),
          egresos: r2(
            gastos
              .filter((g) => !g.anulado && dia(g.fecha).startsWith(clave))
              .reduce((s, g) => s + Number(g.monto), 0)
          ),
        }))
      : null;

  // Expensas del mes en curso
  const mensuales = valor(rMensuales);
  const deptos = valor(rDeptos);
  const expensasMes =
    mensuales && deptos
      ? {
          generadas: mensuales.length,
          ocupados: deptos.filter((d) => d.ocupado).length,
          pagadas: mensuales.filter((m) => m.estado === "Pagado").length,
        }
      : null;

  // Deuda, mora y departamentos en mora
  const resumen = valor(rResumen);
  let adeudado: number | null = null;
  let moraAcumulada: number | null = null;
  let enMora: FilaMora[] | null = null;

  if (resumen) {
    const filas = resumen.departamentos.map((d) => {
      const deudas = resumen.deudas.filter((x) => x.departamento === d.numero);
      return {
        numero: d.numero,
        responsable: d.responsable,
        categoria: d.categoria,
        sinPagar: deudas.length,
        adeudado: r2(deudas.reduce((s, x) => s + x.monto, 0)),
        mora: r2(deudas.reduce((s, x) => s + x.mora, 0)),
        vencida: deudas.some((x) => x.vencida),
      };
    });
    adeudado = r2(filas.reduce((s, f) => s + f.adeudado, 0));
    moraAcumulada = r2(filas.reduce((s, f) => s + f.mora, 0));
    enMora = filas
      .filter((f) => f.vencida)
      .map((f) => ({
        numero: f.numero,
        responsable: f.responsable,
        categoria: f.categoria,
        sinPagar: f.sinPagar,
        adeudado: f.adeudado,
        mora: f.mora,
      }));
  }

  // Últimos 5 ingresos y gastos (los anulados se muestran atenuados)
  const ultimos: MovimientoReciente[] | null =
    ingresos && gastos
      ? [
          ...ingresos.map((i) => ({
            id: `I-${i.id}`,
            fecha: dia(i.fecha),
            creado: i.created_at,
            tipo: "Ingreso" as const,
            categoria: i.categoria?.nombre ?? "Sin categoría",
            descripcion: i.descripcion || "—",
            metodo: mayuscula(i.metodo),
            monto: Number(i.monto),
            anulado: i.anulado,
          })),
          ...gastos.map((g) => ({
            id: `G-${g.id}`,
            fecha: dia(g.fecha),
            creado: g.created_at,
            tipo: "Gasto" as const,
            categoria: g.categoria?.nombre ?? "Sin categoría",
            descripcion: g.descripcion || g.proveedor || "—",
            metodo: mayuscula(g.metodo),
            monto: Number(g.monto),
            anulado: g.anulado,
          })),
        ]
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado))
          .slice(0, 5)
      : null;

  return {
    periodoTxt: `${MESES[mes]} ${anio}`,
    caja: cajaResumen,
    cuentas: cuentasResumen,
    serie,
    expensasMes,
    adeudado,
    moraAcumulada,
    enMora,
    ultimos,
    incompleto: resultados.some((r) => r.status === "rejected"),
  };
}

// =====================================================================
// Resumen para administrador (completo) y directorio (solo lectura)
// =====================================================================

function Resumen({ soloLectura }: { soloLectura: boolean }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    cargarFinanzas()
      .then((d) => {
        if (activo) setDatos(d);
      })
      .catch((e) => {
        if (activo) setError(e instanceof Error ? e.message : "No se pudieron cargar los datos financieros.");
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  function reintentar() {
    setDatos(null);
    setError("");
    setIntento((n) => n + 1);
  }

  if (error) {
    return (
      <div className="panel">
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={reintentar}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="panel">
        <div className="empty-state">Cargando resumen financiero…</div>
      </div>
    );
  }

  const { periodoTxt, caja, cuentas, serie, expensasMes, adeudado, moraAcumulada, enMora, ultimos } = datos;

  const totalBancos = cuentas ? cuentas.reduce((s, c) => s + c.saldo, 0) : null;
  const actual = serie ? serie[serie.length - 1] : null;
  const balance = actual ? actual.ingresos - actual.egresos : null;
  const maximo = serie ? Math.max(...serie.flatMap((s) => [s.ingresos, s.egresos]), 1) : 1;

  const alertas: Alerta[] = [];
  if (enMora && enMora.length > 0) {
    alertas.push({
      color: "#C13333",
      titulo: `${enMora.length} ${enMora.length === 1 ? "departamento" : "departamentos"} en mora`,
      detalle: `Dptos. ${enMora.map((d) => d.numero).join(", ")}`,
      href: "/pagos",
    });
  }
  if (expensasMes) {
    const faltan = expensasMes.ocupados - expensasMes.generadas;
    alertas.push(
      faltan > 0
        ? { color: "#D9A441", titulo: `Faltan expensas de ${periodoTxt}`, detalle: `${faltan} departamentos sin expensa generada`, href: "/expensas" }
        : { color: "#6E9B61", titulo: `Expensas de ${periodoTxt} generadas`, detalle: `${expensasMes.generadas} de ${expensasMes.ocupados} departamentos`, href: "/expensas" }
    );
  }
  if (caja && !caja.abierta) {
    alertas.push({ color: "#D9A441", titulo: "La caja aún no ha sido abierta", detalle: "Registra el monto inicial para empezar a usarla", href: "/caja-bancos" });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS · {periodoTxt.toUpperCase()}</p>
          <h1>Resumen financiero</h1>
          <p>{soloLectura ? "Supervisión financiera del edificio (solo lectura)." : "Cómo va el mes y qué necesita tu atención."}</p>
        </div>
        {!soloLectura && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/expensas" className="btn btn-secondary"><PlusIcon size={16} /> Generar expensas</Link>
            <Link href="/pagos" className="btn btn-secondary"><CreditCardIcon size={16} /> Registrar pago</Link>
            <Link href="/ingresos-egresos" className="btn btn-primary"><PlusIcon size={16} /> Nuevo movimiento</Link>
          </div>
        )}
      </div>

      {datos.incompleto && (
        <div className="alert" style={{ ...AVISO, marginBottom: 16 }}>
          Algunos datos no se pudieron cargar (por ejemplo, por los permisos de tu rol). Las secciones afectadas muestran “—”.
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon"><WalletIcon size={20} /></div>
          <span>Saldo de caja</span>
          <strong>{caja ? (caja.abierta ? bs(caja.saldo) : "Sin abrir") : "—"}</strong>
          <small>
            {caja ? (caja.abierta ? `Caja abierta desde ${caja.desde}` : "La caja aún no ha sido abierta") : "No disponible"}
          </small>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><BuildingIcon size={20} /></div>
          <span>Saldo en bancos</span>
          <strong>{totalBancos !== null ? bs(totalBancos) : "—"}</strong>
          <small>
            {cuentas
              ? `${cuentas.length} ${cuentas.length === 1 ? "cuenta activa" : "cuentas activas"}`
              : "No disponible"}
          </small>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <span>Balance de {periodoTxt}</span>
          <strong>{balance !== null ? bs(balance) : "—"}</strong>
          <small>{actual ? `Ingresos ${bs(actual.ingresos)} · Egresos ${bs(actual.egresos)}` : "No disponible"}</small>
        </div>
        {soloLectura ? (
          <div className="metric-card">
            <div className="metric-icon"><FileIcon size={20} /></div>
            <span>Movimientos recientes</span>
            <strong>{ultimos ? ultimos.length : "—"}</strong>
            <small>{ultimos ? "Ingresos y gastos registrados" : "No disponible"}</small>
          </div>
        ) : (
          <div className="metric-card">
            <div className="metric-icon attention"><CreditCardIcon size={20} /></div>
            <span>Monto adeudado</span>
            <strong>{adeudado !== null ? bs(adeudado) : "—"}</strong>
            <small>
              {moraAcumulada !== null
                ? `Mora acumulada ${bs(moraAcumulada)} · calculada automáticamente`
                : "No disponible"}
            </small>
          </div>
        )}
      </div>

      <div className="dashboard-bottom" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Ingresos vs egresos</h3>
            <p>Últimos 3 meses, sin contar movimientos anulados.</p>
          </div>
          <div style={{ padding: "20px 22px" }}>
            {serie ? (
              <>
                <svg viewBox={`0 0 420 ${ALTO + 30}`} width="100%" role="img" aria-label="Ingresos vs egresos">
                  {[0, 0.5, 1].map((t) => (
                    <line key={t} x1="0" x2="420" y1={ALTO - ALTO * t} y2={ALTO - ALTO * t} stroke="#F0EAE5" />
                  ))}
                  {serie.map((d, i) => {
                    const x = i * 140 + 24;
                    const hi = (d.ingresos / maximo) * ALTO;
                    const he = (d.egresos / maximo) * ALTO;
                    return (
                      <g key={d.mes}>
                        <rect x={x} y={ALTO - hi} width="36" height={hi} rx="4" fill="#C13333" />
                        <rect x={x + 42} y={ALTO - he} width="36" height={he} rx="4" fill="#FFAA82" />
                        <text x={x + 39} y={ALTO + 18} textAnchor="middle" fontSize="11" fill="#9A918B">{d.mes}</text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#766E69", marginTop: 6, flexWrap: "wrap" }}>
                  <span><b style={{ color: "#C13333" }}>■</b> Ingresos (expensas cobradas + extraordinarios)</span>
                  <span><b style={{ color: "#FFAA82" }}>■</b> Egresos</span>
                </div>
              </>
            ) : (
              <div className="empty-state">No disponible</div>
            )}
          </div>
        </section>

        {soloLectura ? (
          <section className="panel">
            <div className="panel-heading">
              <h3>Cuentas bancarias</h3>
              <p>Saldo actual de cada cuenta del edificio.</p>
            </div>
            <div style={{ padding: "6px 20px 14px" }}>
              {cuentas ? (
                cuentas.length === 0 ? (
                  <div className="empty-state">No hay cuentas bancarias activas.</div>
                ) : (
                  cuentas.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #F1ECE8" }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: 12 }}>{c.banco}</strong>
                        <small style={{ color: "#766E69", fontSize: 10 }}>Cuenta {c.numero} · {c.titular}</small>
                      </div>
                      <strong>{bs(c.saldo)}</strong>
                    </div>
                  ))
                )
              ) : (
                <div className="empty-state">No disponible</div>
              )}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <h3>Requiere atención</h3>
              <p>Alertas del período en curso.</p>
            </div>
            <div style={{ padding: "6px 20px 14px" }}>
              {alertas.length === 0 ? (
                <div className="empty-state">Sin alertas por ahora.</div>
              ) : (
                alertas.map((a) => (
                  <Link
                    href={a.href}
                    key={a.titulo}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #F1ECE8" }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flex: "none" }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", fontSize: 12 }}>{a.titulo}</strong>
                      <small style={{ color: "#766E69", fontSize: 10 }}>{a.detalle}</small>
                    </div>
                    <b style={{ color: "#B4AAA3" }}>→</b>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* La lista de saldos pendientes es solo para el administrador. */}
      {!soloLectura && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-toolbar">
            <div>
              <h3>Departamentos en mora</h3>
              <p>
                {expensasMes
                  ? `${expensasMes.pagadas} de ${expensasMes.generadas} expensas de ${periodoTxt} pagadas. `
                  : ""}
                El detalle completo está en Pagos y mora.
              </p>
            </div>
            <Link href="/pagos" className="btn btn-secondary"><FileIcon size={16} /> Ver saldos pendientes</Link>
          </div>
          {enMora === null ? (
            <div className="empty-state">No disponible</div>
          ) : enMora.length === 0 ? (
            <div className="empty-state">No hay departamentos en mora.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Departamento</th><th>Responsable</th><th>Categoría</th><th>Expensas sin pagar</th>
                    <th>Adeudado</th><th>Mora</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {enMora.map((d) => (
                    <tr key={d.numero}>
                      <td><span className="tag">Dpto. {d.numero}</span></td>
                      <td>{d.responsable}</td>
                      <td>{d.categoria}</td>
                      <td>{d.sinPagar}</td>
                      <td>{bs(d.adeudado)}</td>
                      <td>{bs(d.mora)}</td>
                      <td>
                        <span className="status" style={{ color: "#9F2727", background: "#FFE5E1" }}><i />En mora</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Últimos ingresos y gastos</h3>
            <p>Los movimientos anulados se conservan en el historial.</p>
          </div>
          {!soloLectura && (
            <Link href="/ingresos-egresos" className="btn btn-secondary"><FileIcon size={16} /> Ver historial</Link>
          )}
        </div>
        {ultimos === null ? (
          <div className="empty-state">No disponible</div>
        ) : ultimos.length === 0 ? (
          <div className="empty-state">Todavía no hay ingresos ni gastos registrados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Monto</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {ultimos.map((m) => (
                  <tr key={m.id} style={m.anulado ? { opacity: 0.55 } : undefined}>
                    <td>{fechaCorta(m.fecha)}</td>
                    <td>
                      <span className={`status ${m.tipo === "Ingreso" ? "status-success" : "status-attention"}`}><i />{m.tipo}</span>
                    </td>
                    <td><span className="tag">{m.categoria}</span></td>
                    <td>{m.descripcion}</td>
                    <td>{m.metodo}</td>
                    <td>{bs(m.monto)}</td>
                    <td>{m.anulado ? <span className="tag">Anulado</span> : "Vigente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// =====================================================================
// Copropietario e inquilino: su estado de cuenta llega con la app de copropietarios.
// No se les muestra información financiera de todo el edificio.
// =====================================================================

function SinVistaPropia() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Mis finanzas</h1>
          <p>Aquí verás tu estado de cuenta, tus pagos y tus comprobantes.</p>
        </div>
      </div>
      <div className="panel">
        <div className="empty-state">Tu estado de cuenta estará disponible próximamente.</div>
      </div>
    </>
  );
}

// =====================================================================
// Página
// =====================================================================

export default function FinanzasPage() {
  const [rol] = useState(readRol);

  return (
    <DashboardLayout active="finanzas">
      {rol.startsWith("ADMIN") ? (
        <Resumen soloLectura={false} />
      ) : rol.startsWith("DIRECTORIO") ? (
        <Resumen soloLectura />
      ) : (
        <SinVistaPropia />
      )}
    </DashboardLayout>
  );
}