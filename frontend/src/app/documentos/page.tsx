"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

// Fallback de categorías mientras carga desde BD (deben coincidir con la tabla tipo_documento)
const CATEGORIAS_FALLBACK = [
  "Actas",
  "Reglamentos",
  "Contratos",
  "Facturas",
  "Fotografías",
  "Cotizaciones",
];

type TipoDocumento = { id: string; nombre: string };

type DocumentoAPI = {
  id: string;
  id_tipo: string;
  descripcion: string;
  nombre_original: string;
  peso_bytes: string;
  mime_type: string;
  restringido: boolean;
  fecha_subida: string;
  tipo_documento?: { id: number; nombre: string };
  usuario?: { id: string; nombres: string; apellido_paterno: string };
};

type TiposResponse = { total: number; tipos: TipoDocumento[] };
type DocumentosResponse = {
  total: number;
  documentos: DocumentoAPI[];
  message?: string;
};
type ApiErrorResponse = { message?: string | string[] };

// Formatea "2026-10-04T14:30:00" → "04/10/2026"
const formatearFecha = (fecha: string) => {
  try {
    const d = new Date(fecha);
    return d.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return fecha;
  }
};

// Convierte "2457600" bytes → "2.4 MB"
const formatearTamano = (bytes: string | number) => {
  const b = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!b || Number.isNaN(b)) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export default function DocumentosPage() {
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [idTipoFiltro, setIdTipoFiltro] = useState<string>("");

  // Mensajes globales
  const [mensajeExito, setMensajeExito] = useState("");

  // Modal subir
  const [modalSubir, setModalSubir] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [idTipo, setIdTipo] = useState("");
  const [restringido, setRestringido] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [erroresSubida, setErroresSubida] = useState<string[]>([]);

  // Modal confirmar eliminar
  const [docAEliminar, setDocAEliminar] = useState<DocumentoAPI | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar tipos al montar (fetch dentro del effect, sin setState directo en el body)
  useEffect(() => {
    const cargarTipos = async () => {
      try {
        const res = await fetch(`${API_URL}/documentos/tipos`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TiposResponse = await res.json();
        setTipos(data.tipos ?? []);
      } catch (e) {
        console.error("Error cargando tipos:", e);
      }
    };
    void cargarTipos();
  }, []);

  // 2. Cargar documentos al montar (fetch dentro del effect)
  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        setError("");
        const res = await fetch(`${API_URL}/documentos`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: DocumentosResponse = await res.json();
        setDocumentos(data.documentos ?? []);
      } catch (e) {
        console.error("Error cargando documentos:", e);
        setError("No se pudieron cargar los documentos.");
        setDocumentos([]);
      } finally {
        setCargando(false);
      }
    };
    void cargar();
  }, []);

  // Función para recargar documentos (la usan subir y eliminar)
  const recargarDocumentos = async () => {
    try {
      const res = await fetch(`${API_URL}/documentos`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DocumentosResponse = await res.json();
      setDocumentos(data.documentos ?? []);
    } catch (e) {
      console.error("Error recargando documentos:", e);
    }
  };

  // 3. Filtrado en cliente
  const documentosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return documentos.filter((d) => {
      const coincideTipo = !idTipoFiltro || d.id_tipo === idTipoFiltro;
      const coincideTexto =
        !texto ||
        d.nombre_original.toLowerCase().includes(texto) ||
        d.descripcion.toLowerCase().includes(texto) ||
        (d.tipo_documento?.nombre ?? "").toLowerCase().includes(texto);
      return coincideTipo && coincideTexto;
    });
  }, [documentos, busqueda, idTipoFiltro]);

  // 4. Mostrar mensaje temporal
  const mostrarExito = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(""), 4000);
  };

  // 5. Manejo del archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(extension || "")) {
      setErroresSubida([
        "Formato no permitido. Solo se aceptan: PDF, DOC, DOCX, JPG, JPEG, PNG.",
      ]);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErroresSubida(["El archivo excede el tamaño máximo de 10 MB."]);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setErroresSubida([]);
    setSelectedFile(file);
  };

  // 6. Subir documento
  const subirDocumento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroresSubida([]);

    const problemas: string[] = [];
    if (!selectedFile) problemas.push("Debes seleccionar un archivo.");
    if (!descripcion.trim()) problemas.push("La descripción es obligatoria.");
    if (!idTipo) problemas.push("Debes seleccionar un tipo de documento.");

    if (problemas.length > 0) {
      setErroresSubida(problemas);
      return;
    }

    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append("archivo", selectedFile!);
      formData.append("descripcion", descripcion.trim());
      formData.append("id_tipo", idTipo);
      formData.append("restringido", String(restringido));

      const res = await fetch(`${API_URL}/documentos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const data: ApiErrorResponse = await res.json();

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message
          : [data.message ?? "Error al subir el documento"];
        setErroresSubida(msg);
        return;
      }

      const nombreSubido = selectedFile!.name;
      cerrarModalSubir();
      mostrarExito(`Documento "${nombreSubido}" subido correctamente.`);
      await recargarDocumentos();
    } catch (e) {
      setErroresSubida([`Error: ${(e as Error).message}`]);
    } finally {
      setSubiendo(false);
    }
  };

  // 7. Descargar
  const descargarDocumento = async (doc: DocumentoAPI) => {
    try {
      const res = await fetch(`${API_URL}/documentos/${doc.id}/descargar`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data: ApiErrorResponse = await res.json();
        const msg = Array.isArray(data.message)
          ? data.message.join("\n")
          : data.message ?? "No se pudo descargar el documento.";
        alert(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nombre_original;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  };

  // 8. Abrir en nueva pestaña
  const abrirDocumento = async (doc: DocumentoAPI) => {
    try {
      const res = await fetch(`${API_URL}/documentos/${doc.id}/descargar`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        alert("No se pudo abrir el documento.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  };

  // 9. Eliminar (con modal custom)
  const confirmarEliminar = async () => {
    if (!docAEliminar) return;

    try {
      setEliminando(true);
      const res = await fetch(`${API_URL}/documentos/${docAEliminar.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const data: ApiErrorResponse = await res.json();
        const msg = Array.isArray(data.message)
          ? data.message.join("\n")
          : data.message ?? "Error al eliminar";
        alert(msg);
        return;
      }

      setDocumentos((docs) => docs.filter((d) => d.id !== docAEliminar.id));
      setDocAEliminar(null);
      mostrarExito("Documento eliminado correctamente.");
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setEliminando(false);
    }
  };

  // 10. Cerrar modal subir
  const cerrarModalSubir = () => {
    setModalSubir(false);
    setSelectedFile(null);
    setDescripcion("");
    setIdTipo("");
    setRestringido(false);
    setErroresSubida([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const conteoRestringidos = documentos.filter((d) => d.restringido).length;

  return (
    <DashboardLayout active="documentos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-08 · REPOSITORIO</p>
          <h1>Gestión documental</h1>
          <p>
            Centraliza, clasifica, consulta y controla el acceso a los
            documentos del edificio.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setModalSubir(true)}>
          <PlusIcon size={17} />
          Subir documento
        </button>
      </div>

      {mensajeExito && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {mensajeExito}
        </div>
      )}

      <div className="metric-row">
        <Metric t="Documentos" n={documentos.length} />
        <Metric t="Categorías" n={tipos.length || CATEGORIAS_FALLBACK.length} />
        <Metric t="Restringidos" n={conteoRestringidos} />
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Repositorio del edificio</h3>
            <p>
              Formatos permitidos: PDF, DOC, DOCX, JPG, JPEG, PNG · máximo 10 MB
            </p>
          </div>

          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar documento..."
            />
          </div>
        </div>

        <div className="doc-filters">
          <button
            className={idTipoFiltro === "" ? "filter-chip active" : "filter-chip"}
            onClick={() => setIdTipoFiltro("")}
          >
            Todos
          </button>
          {tipos.length > 0
            ? tipos.map((t) => (
                <button
                  key={t.id}
                  className={
                    idTipoFiltro === t.id ? "filter-chip active" : "filter-chip"
                  }
                  onClick={() => setIdTipoFiltro(t.id)}
                >
                  {t.nombre}
                </button>
              ))
            : CATEGORIAS_FALLBACK.map((c) => (
                <button key={c} className="filter-chip" disabled>
                  {c}
                </button>
              ))}
        </div>

        {cargando && <div className="empty-state">Cargando documentos...</div>}

        {!cargando && error && <div className="empty-state">{error}</div>}

        {!cargando && !error && documentosFiltrados.length > 0 && (
          <div className="document-grid">
            {documentosFiltrados.map((x) => (
              <article className="document-card" key={x.id}>
                <div className="doc-icon">
                  <FileIcon size={24} />
                </div>

                <div className="doc-body">
                  <div className="doc-top">
                    <span className="tag">
                      {x.tipo_documento?.nombre ?? "Sin categoría"}
                    </span>
                    {x.restringido && (
                      <span className="status status-attention">
                        <span />
                        Restringido
                      </span>
                    )}
                  </div>

                  <h4>{x.nombre_original}</h4>
                  <p>{x.descripcion}</p>
                  <p>
                    {formatearFecha(x.fecha_subida)} ·{" "}
                    {formatearTamano(x.peso_bytes)}
                  </p>
                </div>

                <div className="doc-actions">
                  <button
                    className="icon-action"
                    title="Abrir en nueva pestaña"
                    onClick={() => abrirDocumento(x)}
                  >
                    <EyeIcon size={16} />
                  </button>
                  <button
                    className="icon-action"
                    title="Descargar"
                    onClick={() => descargarDocumento(x)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-action danger"
                    title="Eliminar"
                    onClick={() => setDocAEliminar(x)}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!cargando && !error && documentosFiltrados.length === 0 && (
          <div className="empty-state">
            No existen documentos que coincidan con la búsqueda.
          </div>
        )}
      </section>

      {/* MODAL SUBIR */}
      <Modal
        open={modalSubir}
        title="Subir documento"
        onClose={cerrarModalSubir}
      >
        <form className="modal-form" onSubmit={subirDocumento}>
          {erroresSubida.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              {erroresSubida.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <span>Archivo *</span>
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileIcon size={17} />
                Seleccionar archivo
              </button>
              {selectedFile && (
                <small style={{ display: "block", marginTop: 8 }}>
                  Archivo: <strong>{selectedFile.name}</strong>
                </small>
              )}
            </div>

            <label className="field">
              <span>Descripción *</span>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Acta de asamblea de septiembre"
                maxLength={255}
              />
            </label>

            <label className="field">
              <span>Categoría *</span>
              <select value={idTipo} onChange={(e) => setIdTipo(e.target.value)}>
                <option value="">Selecciona un tipo</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                checked={restringido}
                onChange={(e) => setRestringido(e.target.checked)}
              />
              Documento restringido
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cerrarModalSubir}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!selectedFile || subiendo}
            >
              {subiendo ? "Subiendo..." : "Guardar documento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL CONFIRMAR ELIMINAR */}
      <Modal
        open={!!docAEliminar}
        title="Eliminar documento"
        onClose={() => setDocAEliminar(null)}
      >
        {docAEliminar && (
          <div className="modal-form">
            <p style={{ marginBottom: 20, fontSize: 14 }}>
              ¿Confirmas eliminar este documento?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarEliminar}
                disabled={eliminando}
              >
                {eliminando ? "Eliminando..." : "Aceptar"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDocAEliminar(null)}
                disabled={eliminando}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

/* ============ COMPONENTES INTERNOS ============ */

function Metric({ t, n }: { t: string; n: number }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <FileIcon size={20} />
      </div>
      <div>
        <span>{t}</span>
        <strong>{n}</strong>
      </div>
    </div>
  );
}

/* ============ ICONOS INLINE ============ */

function FileIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}