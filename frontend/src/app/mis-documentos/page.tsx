"use client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EyeIcon, FileIcon, Icon } from "../../../components/Icons";
import { api, apiArchivoUrl, apiDescargar } from "../../../lib/api";
import { MUTED, fechaLarga } from "../../../lib/mi-cuenta";
import { normalizar } from "../../../lib/formato";

// =====================================================================
// Tipos (lo que devuelve el backend)
// =====================================================================

type Documento = {
  id: string;
  descripcion: string | null;
  nombre_original: string;
  peso_bytes: string;
  mime_type: string;
  fecha_subida: string; // ISO
  tipo_documento: { id: string; nombre: string };
};
type Tipo = { id: string; nombre: string };

// =====================================================================
// LLAMADAS AL BACKEND
// =====================================================================

// BACKEND: GET /documentos → documentos visibles para el usuario (los restringidos no llegan)
const cargarDocumentosApi = () =>
  api<{ total: number; documentos: Documento[] }>("/documentos").then((r) => r.documentos);

// BACKEND: GET /documentos/tipos
const cargarTiposApi = () => api<{ total: number; tipos: Tipo[] }>("/documentos/tipos").then((r) => r.tipos);

// BACKEND: GET /documentos/{id}/descargar → el archivo
const verDocumentoApi = (id: string) => apiArchivoUrl(`/documentos/${id}/descargar`);
const descargarDocumentoApi = (d: Documento) => apiDescargar(`/documentos/${d.id}/descargar`, d.nombre_original);

// =====================================================================
// Utilidades de presentación
// =====================================================================

/** 901120 → "880 KB" */
function tamano(bytes: string) {
  const n = Number(bytes);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toLocaleString("es-BO", { maximumFractionDigits: 1 })} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Fecha local "YYYY-MM-DD" de un ISO (para comparar con los filtros Desde / Hasta). */
function diaLocal(iso: string) {
  const d = new Date(iso);
  const dos = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

const DescargarIcon = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Icon>
);

const ETIQUETA = { fontSize: 12, fontWeight: 600, color: "#413B38" } as const;
const CONTROL = { minHeight: 40 } as const;

// =====================================================================
// Página
// =====================================================================

// Documentos del edificio para el copropietario: solo consulta (ver y descargar)
export default function MisDocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abriendo, setAbriendo] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    Promise.all([cargarDocumentosApi(), cargarTiposApi()])
      .then(([d, t]) => {
        setDocumentos(d);
        setTipos(t);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos."))
      .finally(() => setCargando(false));
  }, []);

  // La búsqueda ignora mayúsculas y tildes, y mira el título, el archivo y la categoría
  const q = normalizar(busqueda.trim());
  const filtrados = documentos.filter((d) => {
    const dia = diaLocal(d.fecha_subida);
    const texto = normalizar(`${d.descripcion ?? ""} ${d.nombre_original} ${d.tipo_documento.nombre}`);
    return (
      (q === "" || texto.includes(q)) &&
      (tipo === "" || d.tipo_documento.id === tipo) &&
      (desde === "" || dia >= desde) &&
      (hasta === "" || dia <= hasta)
    );
  });

  function limpiar() {
    setBusqueda("");
    setTipo("");
    setDesde("");
    setHasta("");
  }

  // Abre el archivo en otra pestaña (PDF e imágenes se ven en el navegador)
  async function ver(d: Documento) {
    if (abriendo) return;
    setAbriendo(d.id);
    try {
      const url = await verDocumentoApi(d.id);
      window.open(url, "_blank", "noopener");
      // Se libera después de que la pestaña lo cargue
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el documento.");
    } finally {
      setAbriendo(null);
    }
  }

  async function descargar(d: Documento) {
    try {
      await descargarDocumentoApi(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el documento.");
    }
  }

  return (
    <DashboardLayout active="mis-documentos">
      <div className="page-header">
        <div>
          <h1>Documentos del edificio</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Filtros */}
      <section
        className="panel"
        style={{ padding: "18px 18px", marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}
      >
        <label className="field" style={{ flex: "3 1 260px" }}>
          <span style={ETIQUETA}>Buscar por palabra clave</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. asamblea, presupuesto, parqueo"
            style={CONTROL}
          />
        </label>
        <label className="field" style={{ flex: "1 1 160px" }}>
          <span style={ETIQUETA}>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={CONTROL}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: "1 1 140px" }}>
          <span style={ETIQUETA}>Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} style={CONTROL} />
        </label>
        <label className="field" style={{ flex: "1 1 140px" }}>
          <span style={ETIQUETA}>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} style={CONTROL} />
        </label>
        <button className="btn btn-secondary" onClick={limpiar} style={CONTROL}>Limpiar</button>
        <span style={{ ...MUTED, marginLeft: "auto", alignSelf: "center" }}>
          Mostrando {filtrados.length} de {documentos.length} documentos
        </span>
      </section>

      {/* Lista */}
      <section className="panel">
        {cargando ? (
          <div className="empty-state">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            {documentos.length === 0 ? "Todavía no hay documentos del edificio." : "Ningún documento coincide con los filtros."}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          style={{
                            width: 36, height: 36, borderRadius: 9, flex: "none",
                            display: "grid", placeItems: "center", background: "#FFF0EE", color: "#C83A3A",
                          }}
                        >
                          <FileIcon size={18} />
                        </span>
                        <div>
                          <strong>{d.descripcion || d.nombre_original}</strong>
                          <small>Documento oficial</small>
                        </div>
                      </div>
                    </td>
                    <td>{d.tipo_documento.nombre}</td>
                    <td>{fechaLarga(diaLocal(d.fecha_subida))}</td>
                    <td>{tamano(d.peso_bytes)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => ver(d)}
                        disabled={abriendo === d.id}
                        style={{ marginRight: 8 }}
                      >
                        <EyeIcon size={16} />
                        {abriendo === d.id ? "Abriendo…" : "Ver"}
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => descargar(d)}>
                        <DescargarIcon size={16} />
                        Descargar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ ...MUTED, margin: 0, padding: "14px 18px", borderTop: "1px solid #F0EAE5" }}>
          Los documentos no se pueden editar ni eliminar desde esta cuenta.
        </p>
      </section>
    </DashboardLayout>
  );
}
