"use client";
import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { PlusIcon, WalletIcon, CheckIcon, BuildingIcon } from "../../../components/Icons";

type Categoria = "A" | "B" | "C";
type Estado = "Pendiente" | "Pagado";
type Concepto = { concepto: string; monto: number };
type Departamento = { numero: number; categoria: Categoria | null; ocupado: boolean };
type Expensa = {
  id: string;
  departamento: number;
  categoria: Categoria;
  periodo: string; // "2026-09"
  desglose: Concepto[];
  total: number;
  fechaLimite: string; // "2026-09-30"
  estado: Estado;
};
type Omitido = { departamento: number; motivo: string };
type Resultado = { periodo: string; generadas: Expensa[]; omitidos: Omitido[]; yaExistian: number };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ANIO_INICIO = 2025; // BACKEND: primer año con datos del edificio

// =====================================================================
// DATOS DE EJEMPLO (los reemplaza backend)
// =====================================================================

// BACKEND: GET /expensas/tarifas  → monto fijo por categoría, con su desglose
const TARIFAS: Record<Categoria, Concepto[]> = {
  A: [
    { concepto: "Mantenimiento general", monto: 180 },
    { concepto: "Limpieza de áreas comunes", monto: 70 },
    { concepto: "Seguridad", monto: 50 },
  ],
  B: [
    { concepto: "Mantenimiento general", monto: 230 },
    { concepto: "Limpieza de áreas comunes", monto: 90 },
    { concepto: "Seguridad", monto: 60 },
  ],
  C: [
    { concepto: "Mantenimiento general", monto: 280 },
    { concepto: "Limpieza de áreas comunes", monto: 100 },
    { concepto: "Seguridad", monto: 70 },
  ],
};

// BACKEND: GET /departamentos
const DEPARTAMENTOS: Departamento[] = [
  { numero: 101, categoria: "A", ocupado: true },
  { numero: 102, categoria: "A", ocupado: true },
  { numero: 103, categoria: "A", ocupado: true },
  { numero: 201, categoria: "B", ocupado: true },
  { numero: 202, categoria: "B", ocupado: true },
  { numero: 203, categoria: "B", ocupado: true },
  { numero: 301, categoria: "C", ocupado: true },
  { numero: 302, categoria: "C", ocupado: true },
  { numero: 401, categoria: null, ocupado: true }, // sin categoría → se omite
  { numero: 402, categoria: "B", ocupado: false }, // libre → no recibe expensa
];

const ELEGIBLES = DEPARTAMENTOS.filter(
  (d): d is Departamento & { categoria: Categoria } => d.ocupado && d.categoria !== null
);

function totalDe(conceptos: Concepto[]) {
  return conceptos.reduce((s, c) => s + c.monto, 0);
}

function ultimoDia(periodo: string) {
  const [a, m] = periodo.split("-").map(Number);
  const dia = new Date(a, m, 0).getDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function crear(numero: number, categoria: Categoria, periodo: string, estado: Estado): Expensa {
  const desglose = TARIFAS[categoria];
  return {
    id: `${periodo}-${numero}`,
    departamento: numero,
    categoria,
    periodo,
    desglose,
    total: totalDe(desglose),
    fechaLimite: ultimoDia(periodo),
    estado,
  };
}

// BACKEND: GET /expensas?periodo=YYYY-MM
// Agosto: completo. Septiembre: faltan 2 departamentos (sirve para probar el aviso de "solo se generarán...").
const EXPENSAS_INICIALES: Expensa[] = [
  ...ELEGIBLES.map((d) => crear(d.numero, d.categoria, "2026-08", "Pagado")),
  ...ELEGIBLES.filter((d) => d.numero < 301).map((d) =>
    crear(d.numero, d.categoria, "2026-09", [101, 102, 201].includes(d.numero) ? "Pagado" : "Pendiente")
  ),
];

// SIMULACIÓN de lo que hace backend. Se reemplaza por el POST real.
async function generarExpensasApi(periodo: string, existentes: Expensa[]): Promise<Resultado> {
  await new Promise((r) => setTimeout(r, 900));

  // BACKEND: POST /expensas/generar  { mes, anio }
  // if (res.status === 403) throw new Error("Permiso denegado: solo el administrador puede generar expensas.");
  // if (res.status === 400) throw new Error("Período inválido. Selecciona un mes y un año que ya hayan comenzado.");
  // if (!res.ok) throw new Error("Fallo del servicio. No se pudieron generar las expensas, intenta nuevamente.");

  const yaExistian = existentes.filter((e) => e.periodo === periodo).length;
  const generadas: Expensa[] = [];
  const omitidos: Omitido[] = [];
  for (const d of DEPARTAMENTOS) {
    if (!d.ocupado) continue;
    if (!d.categoria) {
      omitidos.push({ departamento: d.numero, motivo: "No tiene una categoría asignada." });
      continue;
    }
    if (existentes.some((e) => e.periodo === periodo && e.departamento === d.numero)) continue;
    generadas.push(crear(d.numero, d.categoria, periodo, "Pendiente"));
  }
  return { periodo, generadas, omitidos, yaExistian };
}

// =====================================================================
// Utilidades de presentación
// =====================================================================

function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nombrePeriodo(p: string) {
  const [a, m] = p.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}
function fecha(iso: string) {
  return iso.split("-").reverse().join("/");
}
function plural(n: number, uno: string, varios: string) {
  return n === 1 ? uno : varios;
}

const ESTADO_CLASE: Record<Estado, string> = { Pendiente: "status-warning", Pagado: "status-success" };
const AVISO = { background: "#fbf1df", color: "#a16d25", border: "1px solid #f0dcb4" };

function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}

// =====================================================================
// Página
// =====================================================================

export default function ExpensasPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN"); // Criterio 1: el botón solo es visible para el administrador

  const [expensas, setExpensas] = useState<Expensa[]>(EXPENSAS_INICIALES);
  const [periodoVista, setPeriodoVista] = useState("2026-09");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [paso, setPaso] = useState<"form" | "confirmar">("form");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const anios = Array.from({ length: Math.max(anioActual - ANIO_INICIO + 1, 1) }, (_, i) => ANIO_INICIO + i);

  // Criterios 2 y 3: mes y año obligatorios, sin años ni meses futuros
  const mesFuturo = (m: number) => anio !== "" && Number(anio) === anioActual && m > mesActual;
  const periodoValido =
    mes !== "" && anio !== "" && Number(anio) <= anioActual && !mesFuturo(Number(mes));
  const periodoSel = periodoValido ? `${anio}-${mes.padStart(2, "0")}` : "";

  // BACKEND: esta vista previa (cuántas existen / cuántas faltan) la devuelve el servidor
  const existentesSel = periodoSel ? expensas.filter((e) => e.periodo === periodoSel).length : 0;
  const faltantes = periodoSel ? ELEGIBLES.length - existentesSel : 0;

  const periodos = Array.from(new Set(expensas.map((e) => e.periodo))).sort().reverse();
  const lista = expensas.filter((e) => e.periodo === periodoVista);
  const montoTotal = lista.reduce((s, e) => s + e.total, 0);
  const pendientes = lista.filter((e) => e.estado === "Pendiente").length;

  function abrirModal() {
    setPaso("form");
    setMes("");
    setAnio("");
    setError("");
    setModalOpen(true);
  }

  function cerrarModal() {
    if (generando) return; // no se puede cerrar mientras genera
    setModalOpen(false);
    setPaso("form");
    setMes("");
    setAnio("");
    setError("");
  }

  function cambiarAnio(valor: string) {
    setAnio(valor);
    if (valor !== "" && Number(valor) === anioActual && Number(mes) > mesActual) setMes("");
    setError("");
  }

  async function confirmarGeneracion() {
    if (generando) return; // Criterio 6: evita doble generación
    setGenerando(true);
    setError("");
    try {
      const res = await generarExpensasApi(periodoSel, expensas);
      setExpensas((prev) => [...prev, ...res.generadas]);
      setPeriodoVista(periodoSel);
      setResultado(res);
      setModalOpen(false);
      setPaso("form");
      setMes("");
      setAnio("");
    } catch (e) {
      // Criterio 9: se muestra el motivo del error
      setError(e instanceof Error ? e.message : "No se pudieron generar las expensas. Intenta nuevamente.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <DashboardLayout active="expensas">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · EXPENSAS</p>
          <h1>Expensas mensuales</h1>
          <p>Genera las expensas de cada período y consulta las ya emitidas.</p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary" onClick={abrirModal} disabled={generando}>
            <PlusIcon size={16} /> Generar expensas
          </button>
        )}
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><BuildingIcon size={20} /></div>
          <div><span>Expensas del período</span><strong>{lista.length}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><WalletIcon size={20} /></div>
          <div><span>Monto total del período</span><strong>{bs(montoTotal)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention"><CheckIcon size={20} /></div>
          <div><span>Pendientes de pago</span><strong>{pendientes}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Expensas de {nombrePeriodo(periodoVista)}</h3>
            <p>Las expensas generadas no se pueden modificar.</p>
          </div>
          {periodos.length > 0 && (
            <select value={periodoVista} onChange={(e) => setPeriodoVista(e.target.value)}>
              {periodos.map((p) => (
                <option key={p} value={p}>{nombrePeriodo(p)}</option>
              ))}
            </select>
          )}
        </div>

        {resultado && resultado.periodo === periodoVista && (
          <div style={{ padding: "16px 20px 0", display: "grid", gap: 10 }}>
            <div className="alert alert-success">
              Se generaron {resultado.generadas.length} {plural(resultado.generadas.length, "expensa", "expensas")} de{" "}
              {nombrePeriodo(resultado.periodo).toLowerCase()}.
              {resultado.yaExistian > 0 && ` Ya existían ${resultado.yaExistian}; solo se generaron las que faltaban.`}
            </div>
            {resultado.omitidos.length > 0 && (
              <div className="alert" style={AVISO}>
                <strong>
                  {resultado.omitidos.length} {plural(resultado.omitidos.length, "departamento omitido", "departamentos omitidos")}:
                </strong>
                {resultado.omitidos.map((o) => (
                  <div key={o.departamento}>Dpto. {o.departamento}: {o.motivo}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {lista.length === 0 ? (
          <div className="empty-state">Todavía no se generaron expensas para este período.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Categoría</th>
                  <th>Desglose por concepto</th>
                  <th>Monto total</th>
                  <th>Fecha límite</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td><span className="tag">Dpto. {e.departamento}</span></td>
                    <td>{e.categoria}</td>
                    <td>
                      {e.desglose.map((c) => (
                        <div key={c.concepto} style={{ fontSize: 11, color: "#766E69" }}>
                          {c.concepto}: {bs(c.monto)}
                        </div>
                      ))}
                    </td>
                    <td><strong>{bs(e.total)}</strong></td>
                    <td>{fecha(e.fechaLimite)}</td>
                    <td>
                      <span className={`status ${ESTADO_CLASE[e.estado]}`}><span />{e.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {esAdmin && (
        <Modal open={modalOpen} title="Generar expensas mensuales" onClose={cerrarModal}>
          {paso === "form" ? (
            <div className="modal-form">
              <div className="form-grid">
                <label className="field">
                  <span>Mes <b>*</b></span>
                  <select value={mes} onChange={(e) => { setMes(e.target.value); setError(""); }}>
                    <option value="">Selecciona un mes</option>
                    {MESES.map((m, i) => (
                      <option key={m} value={String(i + 1)} disabled={mesFuturo(i + 1)}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Año <b>*</b></span>
                  <select value={anio} onChange={(e) => cambiarAnio(e.target.value)}>
                    <option value="">Selecciona un año</option>
                    {anios.map((a) => (
                      <option key={a} value={String(a)}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>

              {!periodoValido && (
                <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
                  Selecciona el mes y el año para continuar. No se pueden elegir meses que aún no han llegado.
                </p>
              )}

              {periodoValido && existentesSel > 0 && (
                <div className="alert" style={{ ...AVISO, marginTop: 12 }}>
                  {faltantes > 0
                    ? `Ya existen expensas para este período, solo se generarán ${faltantes} ${plural(faltantes, "expensa", "expensas")} que ${plural(faltantes, "falta", "faltan")}.`
                    : "Ya existen expensas para todos los departamentos de este período. No hay expensas por generar."}
                </div>
              )}

              <h3 style={{ fontSize: 13, margin: "18px 0 8px" }}>Vista previa de tarifas por categoría</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Categoría</th><th>Conceptos</th><th>Monto por departamento</th></tr>
                  </thead>
                  <tbody>
                    {(Object.keys(TARIFAS) as Categoria[]).map((cat) => (
                      <tr key={cat}>
                        <td><span className="tag">Categoría {cat}</span></td>
                        <td>
                          {TARIFAS[cat].map((c) => (
                            <div key={c.concepto} style={{ fontSize: 11, color: "#766E69" }}>
                              {c.concepto}: {bs(c.monto)}
                            </div>
                          ))}
                        </td>
                        <td><strong>{bs(totalDe(TARIFAS[cat]))}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
                El monto es fijo por categoría. Los departamentos libres no reciben expensa y los que no tienen
                categoría quedan omitidos.
              </p>

              {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={() => setPaso("confirmar")}
                  disabled={!periodoValido || faltantes <= 0}
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-form">
              {/* Criterio 5: confirmación con el período elegido */}
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                Se generan las expensas de {nombrePeriodo(periodoSel).toLowerCase()}.
              </p>
              {existentesSel > 0 && (
                <p style={{ fontSize: 12, color: "#766E69", margin: 0 }}>
                  Solo se generarán {faltantes} {plural(faltantes, "expensa", "expensas")} que {plural(faltantes, "falta", "faltan")}.
                </p>
              )}

              {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cerrarModal} disabled={generando}>Cancelar</button>
                <button className="btn btn-primary" onClick={confirmarGeneracion} disabled={generando}>
                  {generando ? "Generando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}