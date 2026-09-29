"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  FileIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
} from "../../../components/Icons";
import { api } from "../../../lib/api";

// ========================================================
// TIPOS
// ========================================================
type Doc = {
  id: string;
  nombre: string;
  categoria: string;
  fecha: string;
  tamano: string;
  restringido: boolean;
  mime_type: string;
};

type TipoDocumento = {
  id: string;
  nombre: string;
};

// Respuesta cruda del backend para un documento
type DocumentoAPI = {
  id: string;
  nombre_original?: string;
  descripcion: string;
  fecha_subida: string;
  peso_bytes: number | string;
  restringido?: boolean;
  mime_type?: string;
  tipo_documento?: {
    nombre: string;
  };
};

// Respuesta de GET /documentos
type DocumentosResponse = {
  documentos?: DocumentoAPI[];
};

// Respuesta de GET /documentos/tipos
type TiposResponse = {
  tipos?: TipoDocumento[];
};

// Respuesta de POST /documentos
type UploadResponse = {
  message?: string;
};

export default function DocumentosPage() {
  const [items, setItems] = useState<Doc[]>([]);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [idTipo, setIdTipo] = useState("");
  const [restringido, setRestringido] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errores, setErrores] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper para mapear la respuesta del backend a nuestro tipo Doc
  function mapearDocumentos(data: DocumentosResponse): Doc[] {
    return (data.documentos || []).map((d) => ({
      id: d.id,
      nombre: d.nombre_original || d.descripcion,
      categoria: d.tipo_documento?.nombre || "Sin categoría",
      fecha: new Date(d.fecha_subida).toLocaleDateString("es-BO"),
      tamano: formatFileSize(Number(d.peso_bytes)),
      restringido: d.restringido ?? false,
      mime_type: d.mime_type || "",
    }));
  }

  // ========================================================
  // CARGAR DOCUMENTOS
  // ========================================================
  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true);
        const data = await api<DocumentosResponse>("/documentos");
        setItems(mapearDocumentos(data));
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido";
        console.error("Error al cargar documentos:", mensaje);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // ========================================================
  // CARGAR TIPOS DE DOCUMENTO
  // ========================================================
  useEffect(() => {
    async function cargarTipos() {
      try {
        const data = await api<TiposResponse>("/documentos/tipos");
        setTipos(data.tipos || []);
        if (data.tipos && data.tipos.length > 0) {
          setIdTipo(data.tipos[0].id);
        }
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido";
        console.error("Error al cargar tipos:", mensaje);
      }
    }
    cargarTipos();
  }, []);

  // ========================================================
  // FILTROS
  // ========================================================
  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (cat === "Todas" || x.categoria === cat) &&
          `${x.nombre} ${x.categoria}`.toLowerCase().includes(q.toLowerCase())
      ),
    [items, q, cat]
  );

  // ========================================================
  // HANDLE FILE CHANGE
  // ========================================================
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = file.name.toLowerCase().split(".").pop();

    if (!["pdf", "jpg", "jpeg", "png", "docx"].includes(extension || "")) {
      setErrores([
        "Formato no permitido. Selecciona un archivo PDF, DOCX, JPG o PNG.",
      ]);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrores(["El archivo no puede superar los 10 MB."]);
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setErrores([]);
    setSelectedFile(file);
  }

  // ========================================================
  // SUBIR DOCUMENTO
  // ========================================================
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedFile) {
      setErrores(["Debes seleccionar un archivo."]);
      return;
    }

    if (!descripcion.trim()) {
      setErrores(["La descripción es obligatoria."]);
      return;
    }

    if (!idTipo) {
      setErrores(["Debes seleccionar una categoría."]);
      return;
    }

    setErrores([]);
    setGuardando(true);

    try {
      const formData = new FormData();
      formData.append("archivo", selectedFile);
      formData.append("descripcion", descripcion.trim());
      formData.append("id_tipo", String(Number(idTipo)));
      formData.append("restringido", restringido ? "true" : "false");

      const token = sessionStorage.getItem("token");
      const API = "http://localhost:3001";

      const response = await fetch(`${API}/documentos`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const err: { message?: string } = await response
          .json()
          .catch(() => ({}));
        throw new Error(err.message || `Error ${response.status}`);
      }

      const data: UploadResponse = await response.json();

      // ✅ MENSAJE DE CONFIRMACIÓN (ARREGLA HU-42 CA-5)
      setMensajeExito(data.message || "✅ Documento subido correctamente");
      setTimeout(() => setMensajeExito(""), 4000);

      // Limpiar formulario
      setSelectedFile(null);
      setDescripcion("");
      setRestringido(false);
      setOpen(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Recargar lista
      const dataLista = await api<DocumentosResponse>("/documentos");
      setItems(mapearDocumentos(dataLista));
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error al subir documento";
      setErrores([mensaje]);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // CERRAR MODAL
  // ========================================================
  function closeModal() {
    setOpen(false);
    setSelectedFile(null);
    setDescripcion("");
    setRestringido(false);
    setErrores([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // ========================================================
  // DESCARGAR DOCUMENTO
  // ========================================================
  async function descargarDocumento(doc: Doc) {
    try {
      const token = sessionStorage.getItem("token");
      const API = "http://localhost:3001";

      const response = await fetch(`${API}/documentos/${doc.id}/descargar`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("No se pudo descargar el documento");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = doc.nombre;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error al descargar";
      setErrores([mensaje]);
      setTimeout(() => setErrores([]), 4000);
    }
  }

  // ========================================================
  // VISUALIZAR DOCUMENTO
  // ========================================================
  function visualizarDocumento(doc: Doc) {
    setPreviewDoc(doc);
  }

  function cerrarVistaPrevia() {
    setPreviewDoc(null);
  }

  // ========================================================
  // ELIMINAR DOCUMENTO
  // ========================================================
  async function eliminarDocumento(doc: Doc) {
    if (!confirm("¿Confirmas eliminar este documento?")) {
      return;
    }

    try {
      await api(`/documentos/${doc.id}`, { method: "DELETE" });

      // ✅ MENSAJE DE CONFIRMACIÓN (ARREGLA HU-46 CA-4)
      setMensajeExito("✅ Documento eliminado correctamente");
      setTimeout(() => setMensajeExito(""), 4000);

      // Recargar lista
      const data = await api<DocumentosResponse>("/documentos");
      setItems(mapearDocumentos(data));
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error al eliminar";
      setErrores([mensaje]);
      setTimeout(() => setErrores([]), 4000);
    }
  }

  // ========================================================
  // RENDER
  // ========================================================
  return (
    <DashboardLayout active="documentos">
      <div className="page-header">
        <div>
          <h1>Gestión documental</h1>
          <p>
            Centraliza, clasifica, consulta y controla el acceso a los
            documentos del edificio.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon size={17} />
          Subir documento
        </button>
      </div>

      {mensajeExito && (
        <div className="alert alert-success" style={{ marginBottom: "16px" }}>
          {mensajeExito}
        </div>
      )}

      {errores.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: "16px" }}>
          {errores.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <div className="metric-row">
        <Metric t="Documentos" n={items.length} />
        <Metric t="Categorías" n={tipos.length} />
        <Metric
          t="Restringidos"
          n={items.filter((x) => x.restringido).length}
        />
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Repositorio del edificio</h3>
            <p>
              Formatos permitidos: PDF, DOCX, JPG y PNG · máximo 10 MB
            </p>
          </div>

          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar documento..."
            />
          </div>
        </div>

        <div className="doc-filters">
          <button
            className={cat === "Todas" ? "filter-chip active" : "filter-chip"}
            onClick={() => setCat("Todas")}
          >
            Todos
          </button>

          {tipos.map((t) => (
            <button
              key={t.id}
              className={cat === t.nombre ? "filter-chip active" : "filter-chip"}
              onClick={() => setCat(t.nombre)}
            >
              {t.nombre}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="empty-state">Cargando documentos...</div>
        ) : (
          <div className="document-grid">
            {filtered.map((x) => (
              <article className="document-card" key={x.id}>
                <div className="doc-icon">
                  <FileIcon size={24} />
                </div>

                <div className="doc-body">
                  <div className="doc-top">
                    <span className="tag">{x.categoria}</span>
                    {x.restringido && (
                      <span className="status status-attention">
                        <span />
                        Restringido
                      </span>
                    )}
                  </div>

                  <h4>{x.nombre}</h4>
                  <p>
                    {x.fecha} · {x.tamano}
                  </p>
                </div>

                <div className="doc-actions">
                  <button
                    className="icon-action"
                    title="Visualizar documento"
                    onClick={() => visualizarDocumento(x)}
                  >
                    <EyeIcon size={16} />
                  </button>

                  <button
                    className="icon-action"
                    title="Descargar documento"
                    onClick={() => descargarDocumento(x)}
                  >
                    ↓
                  </button>

                  <button
                    className="icon-action danger"
                    title="Eliminar"
                    onClick={() => eliminarDocumento(x)}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!cargando && filtered.length === 0 && (
          <div className="empty-state">
            No existen documentos que coincidan con la búsqueda.
          </div>
        )}
      </section>

      {/* MODAL SUBIR DOCUMENTO */}
      <Modal open={open} title="Subir documento" onClose={closeModal}>
        <form className="modal-form" onSubmit={upload}>
          <div className="form-grid">
            <div className="field">
              <span>Archivo</span>

              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
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
                <small style={{ display: "block", marginTop: "8px" }}>
                  Archivo seleccionado: <strong>{selectedFile.name}</strong>
                </small>
              )}
            </div>

            <label className="field">
              <span>Descripción</span>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Acta de Asamblea General 2026"
              />
            </label>

            <label className="field">
              <span>Categoría</span>
              <select
                value={idTipo}
                onChange={(e) => setIdTipo(e.target.value)}
              >
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
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancelar
            </button>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={!selectedFile || guardando}
            >
              {guardando ? "Guardando..." : "Guardar documento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL VISTA PREVIA */}
      <Modal
        open={!!previewDoc}
        title={previewDoc?.nombre || "Vista previa"}
        onClose={cerrarVistaPrevia}
      >
        {previewDoc && (
          <div style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() => descargarDocumento(previewDoc)}
              >
                ↓ Descargar
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#666", textAlign: "center" }}>
              Vista previa disponible solo después de descargar el documento.
            </p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

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

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}