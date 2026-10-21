"use client";
import { Fragment, useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { api } from "../../../lib/api";
import { FileIcon } from "../../../components/Icons";

type Categoria = "A" | "B" | "C";
type Concepto = { concepto: string; monto: number };
type Departamento = { numero: number; categoria: Categoria; responsable: string };
type Tipo = "expensa" | "pago" | "anticipo" | "mora";
type Movimiento = {
  id: string;
  fecha: string; // "2026-09-01"
  tipo: Tipo;
  detalle: string;
  monto: number;
  desglose?: Concepto[]; // solo en las expensas emitidas
  vencimiento?: string; // solo en las expensas emitidas
};
type EstadoCuenta = {
  depto: Departamento;
  movimientos: Movimiento[];
  totales: { expensas: number; pagos: number; anticipos: number; moras: number; saldo: number };
};

// =====================================================================
// LLAMADAS AL BACKEND
// =====================================================================

// BACKEND: GET /expensas/estado-cuenta → departamentos activos (alimenta el buscador)
const cargarDepartamentosApi = () => api<Departamento[]>("/expensas/estado-cuenta");

// BACKEND: GET /expensas/estado-cuenta/{numero}
// Los movimientos llegan en orden cronológico y el saldo viene calculado por el servidor.
const cargarEstadoApi = (numero: number) =>
  api<EstadoCuenta>(`/expensas/estado-cuenta/${numero}`);

// =====================================================================
// Utilidades de presentación
// =====================================================================

function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}
// La búsqueda ignora mayúsculas y tildes
function normalizar(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}
// Llega desde Saldos pendientes: /estado-cuenta?depto=103
function leerDeptoDeUrl(): number | null {
  if (typeof window === "undefined") return null;
  const n = Number(new URLSearchParams(window.location.search).get("depto"));
  // Si el número no existe, el backend responde 404 y se muestra el error
  return Number.isInteger(n) && n > 0 ? n : null;
}
function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
function imprimirHtml(titulo: string, cuerpo: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.");
    return;
  }
  w.document.write(
    `<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}h2{margin:0 0 8px}p{margin:4px 0}small{color:#555}</style></head><body>${cuerpo}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

const MUTED = { fontSize: 11, color: "#766E69" } as const;
const BOTON_LINK = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" } as const;

// =====================================================================
// Página
// =====================================================================

export default function EstadoCuentaPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");

  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<number | null>(leerDeptoDeUrl);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  // Se guarda junto al número pedido para no mostrar el estado de otro departamento
  const [cargado, setCargado] = useState<{ numero: number; estado: EstadoCuenta } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDepartamentosApi()
      .then(setDepartamentos)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los departamentos."));
  }, []);

  useEffect(() => {
    if (seleccionado === null) return;
    cargarEstadoApi(seleccionado)
      .then((estado) => {
        setCargado({ numero: seleccionado, estado });
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el estado de cuenta."));
  }, [seleccionado]);

  // Criterio 1: el buscador solo ofrece departamentos que existen
  const q = normalizar(busqueda);
  const coincidencias = departamentos.filter(
    (d) => q === "" || String(d.numero).includes(q) || normalizar(d.responsable).includes(q)
  );

  const estado = cargado && cargado.numero === seleccionado ? cargado.estado : null;

  function seleccionar(numero: number) {
    setSeleccionado(numero);
    setAbiertas({});
  }
  function alternar(id: string) {
    setAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Criterio 5: exportar con el mismo contenido que se ve en pantalla
  function exportarExcel() {
    // BACKEND: GET /estado-cuenta/{departamento}/exportar?formato=xlsx. Aquí se simula con un CSV que abre Excel.
    if (!estado) return;
    const num = (n: number) => n.toFixed(2).replace(".", ",");
    const col = (m: Movimiento, t: Tipo) => (m.tipo === t ? num(m.monto) : "");
    const lineas: string[][] = [
      ["Estado de cuenta"],
      [`Departamento: ${estado.depto.numero}`, `Categoría: ${estado.depto.categoria}`, `Responsable: ${estado.depto.responsable}`],
      [],
      ["Fecha", "Detalle", "Expensas emitidas", "Pagos realizados", "Anticipos pagados", "Moras generadas", "Desglose por concepto"],
      ...estado.movimientos.map((m) => [
        fechaCorta(m.fecha),
        m.detalle,
        col(m, "expensa"),
        col(m, "pago"),
        col(m, "anticipo"),
        col(m, "mora"),
        m.desglose ? m.desglose.map((c) => `${c.concepto}: ${num(c.monto)}`).join(" | ") : "",
      ]),
      [],
      ["Totales", "", num(estado.totales.expensas), num(estado.totales.pagos), num(estado.totales.anticipos), num(estado.totales.moras), ""],
      ["Saldo", num(estado.totales.saldo)],
    ];
    const csv = lineas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    descargar(`estado-de-cuenta-dpto-${estado.depto.numero}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
  }
  function exportarPdf() {
    // BACKEND: GET /estado-cuenta/{departamento}/exportar?formato=pdf. Aquí se simula con la ventana de impresión.
    if (!estado) return;
    const celda = (m: Movimiento, t: Tipo) => (m.tipo === t ? bs(m.monto) : "");
    const filas = estado.movimientos
      .map(
        (m) =>
          `<tr><td>${fechaCorta(m.fecha)}</td><td>${m.detalle}${
            m.desglose ? "<br>" + m.desglose.map((c) => `<small>${c.concepto}: ${bs(c.monto)}</small>`).join("<br>") + `<br><small>Fecha límite: ${fechaCorta(m.vencimiento ?? "")}</small>` : ""
          }</td><td>${celda(m, "expensa")}</td><td>${celda(m, "pago")}</td><td>${celda(m, "anticipo")}</td><td>${celda(m, "mora")}</td></tr>`
      )
      .join("");
    const t = estado.totales;
    imprimirHtml(
      "Estado de cuenta",
      `<h2>Estado de cuenta</h2><p><b>Departamento:</b> ${estado.depto.numero} · <b>Categoría:</b> ${estado.depto.categoria} · <b>Responsable:</b> ${estado.depto.responsable}</p><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Expensas emitidas</th><th>Pagos realizados</th><th>Anticipos pagados</th><th>Moras generadas</th></tr></thead><tbody>${filas}<tr><td colspan="2"><b>Totales</b></td><td>${bs(t.expensas)}</td><td>${bs(t.pagos)}</td><td>${bs(t.anticipos)}</td><td>${bs(t.moras)}</td></tr></tbody></table><p><b>Saldo:</b> ${bs(t.saldo)}</p>`
    );
  }

  if (!esAdmin) {
    return (
      <DashboardLayout active="estado-cuenta">
        <div className="panel">
          <div className="empty-state">Acceso denegado. Solo el administrador puede consultar el estado de cuenta.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout active="estado-cuenta">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · CONSULTA</p>
          <h1>Estado de cuenta</h1>
          <p>Consulta las expensas, pagos, anticipos, moras y el saldo de un departamento.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Criterio 1: buscador de departamento */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Buscar departamento</h3>
            <p>Busca por número o por nombre del responsable y selecciónalo. Solo aparecen departamentos existentes.</p>
          </div>
        </div>
        <div className="modal-form" style={{ paddingTop: 8 }}>
          <label className="field">
            <span>Departamento</span>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. 103 o Ana Vargas" />
          </label>
          {coincidencias.length === 0 ? (
            <p style={{ ...MUTED, marginTop: 12 }}>No existe ningún departamento con ese dato.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {coincidencias.map((d) => (
                <button
                  key={d.numero}
                  className={seleccionado === d.numero ? "filter-chip active" : "filter-chip"}
                  onClick={() => seleccionar(d.numero)}
                >
                  Dpto. {d.numero} · {d.responsable}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!estado ? (
        <div className="panel">
          <div className="empty-state">Busca y selecciona un departamento para ver su estado de cuenta.</div>
        </div>
      ) : (
        <>
          {/* Criterio 2: encabezado con categoría y responsable */}
          <section className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center", padding: "20px 22px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
                <div>
                  <small style={MUTED}>Departamento</small>
                  <div><span className="tag">Dpto. {estado.depto.numero}</span></div>
                </div>
                <div>
                  <small style={MUTED}>Categoría</small>
                  <div><strong>Categoría {estado.depto.categoria}</strong></div>
                </div>
                <div>
                  <small style={MUTED}>Responsable</small>
                  <div><strong>{estado.depto.responsable}</strong></div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <small style={MUTED}>Saldo</small>
                <div style={{ fontSize: 24, fontWeight: 700, color: estado.totales.saldo < 0 ? "#56704F" : estado.totales.saldo > 0 ? "#9F2727" : undefined }}>
                  {estado.totales.saldo < 0 ? `A favor ${bs(-estado.totales.saldo)}` : bs(estado.totales.saldo)}
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <div>
                <h3>Movimientos del Dpto. {estado.depto.numero}</h3>
                <p>En orden cronológico. Haz clic en una expensa para ver su desglose por concepto.</p>
              </div>
              {/* Criterio 5: exportar a PDF y Excel */}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={exportarPdf}><FileIcon size={16} /> Exportar PDF</button>
                <button className="btn btn-secondary" onClick={exportarExcel}><FileIcon size={16} /> Exportar Excel</button>
              </div>
            </div>

            {estado.movimientos.length === 0 ? (
              <div className="empty-state">Este departamento todavía no tiene movimientos.</div>
            ) : (
              <div className="table-wrap">
                {/* Criterio 3: una columna por tipo de movimiento */}
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Detalle</th>
                      <th>Expensas emitidas</th>
                      <th>Pagos realizados</th>
                      <th>Anticipos pagados</th>
                      <th>Moras generadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estado.movimientos.map((m) => (
                      <Fragment key={m.id}>
                        <tr>
                          <td>{fechaCorta(m.fecha)}</td>
                          <td>
                            {m.tipo === "expensa" ? (
                              <button style={BOTON_LINK} onClick={() => alternar(m.id)} aria-expanded={!!abiertas[m.id]}>
                                <strong>{abiertas[m.id] ? "▾" : "▸"} {m.detalle}</strong>
                              </button>
                            ) : (
                              m.detalle
                            )}
                          </td>
                          <td>{m.tipo === "expensa" ? bs(m.monto) : ""}</td>
                          <td style={{ color: "#56704F" }}>{m.tipo === "pago" ? bs(m.monto) : ""}</td>
                          <td style={{ color: "#56704F" }}>{m.tipo === "anticipo" ? bs(m.monto) : ""}</td>
                          <td style={{ color: "#9F2727" }}>{m.tipo === "mora" ? bs(m.monto) : ""}</td>
                        </tr>

                        {/* Criterio 4: al abrir una expensa se ve su desglose */}
                        {m.tipo === "expensa" && abiertas[m.id] && m.desglose && (
                          <tr>
                            <td colSpan={6} style={{ background: "#faf7f4" }}>
                              <div style={{ padding: "6px 4px" }}>
                                <strong style={{ fontSize: 12 }}>Desglose por concepto</strong>
                                {m.desglose.map((c) => (
                                  <div key={c.concepto} style={{ display: "flex", justifyContent: "space-between", maxWidth: 360, fontSize: 12, padding: "3px 0" }}>
                                    <span>{c.concepto}</span>
                                    <span>{bs(c.monto)}</span>
                                  </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 360, fontSize: 12, padding: "5px 0 0", borderTop: "1px solid #E7E0DA", marginTop: 4 }}>
                                  <strong>Total</strong>
                                  <strong>{bs(m.monto)}</strong>
                                </div>
                                <div style={{ ...MUTED, marginTop: 6 }}>Fecha límite de pago: {fechaCorta(m.vencimiento ?? "")}</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#fff0eb", fontWeight: 700 }}>
                      <td colSpan={2}>Totales</td>
                      <td>{bs(estado.totales.expensas)}</td>
                      <td>{bs(estado.totales.pagos)}</td>
                      <td>{bs(estado.totales.anticipos)}</td>
                      <td>{bs(estado.totales.moras)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashboardLayout>
  );
}