"use client";

import { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  FileIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
} from "../../../components/Icons";

type Doc = {
  id: number;
  nombre: string;
  categoria: string;
  fecha: string;
  tamano: string;
  restringido: boolean;
  archivo?: File;
  url?: string;
  tipo?: string;
};

const cats = [
  "Actas",
  "Reglamentos",
  "Contratos",
  "Facturas",
  "Fotografías",
  "Cotizaciones",
];

const initial: Doc[] = [
  {
    id: 1,
    nombre: "Acta de Asamblea General 2026.pdf",
    categoria: "Actas",
    fecha: "02/09/2026",
    tamano: "2.4 MB",
    restringido: false,
  },
  {
    id: 2,
    nombre: "Reglamento de Copropiedad.pdf",
    categoria: "Reglamentos",
    fecha: "15/08/2026",
    tamano: "1.1 MB",
    restringido: false,
  },
  {
    id: 3,
    nombre: "Contrato mantenimiento ascensores.pdf",
    categoria: "Contratos",
    fecha: "28/07/2026",
    tamano: "3.8 MB",
    restringido: true,
  },
  {
    id: 4,
    nombre: "Factura servicios comunes.pdf",
    categoria: "Facturas",
    fecha: "01/09/2026",
    tamano: "680 KB",
    restringido: false,
  },
];

export default function DocumentosPage() {
  const [items, setItems] = useState<Doc[]>(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (cat === "Todas" || x.categoria === cat) &&
          `${x.nombre} ${x.categoria}`
            .toLowerCase()
            .includes(q.toLowerCase())
      ),
    [items, q, cat]
  );

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = file.name
      .toLowerCase()
      .split(".")
      .pop();

    if (
      !["pdf", "jpg", "jpeg", "png", "docx"].includes(
        extension || ""
      )
    ) {
      alert(
        "Formato no permitido. Selecciona un archivo PDF, DOCX, JPG o PNG."
      );

      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo no puede superar los 10 MB.");

      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedFile) return;

    const extension = selectedFile.name
      .toLowerCase()
      .split(".")
      .pop();

    if (
      !["pdf", "jpg", "jpeg", "png", "docx"].includes(
        extension || ""
      )
    ) {
      return;
    }

    const form = new FormData(e.currentTarget);

    const fileUrl = URL.createObjectURL(selectedFile);

    const nuevoDocumento: Doc = {
      id: Date.now(),
      nombre: selectedFile.name,
      categoria: String(form.get("categoria")),
      fecha: "06/09/2026",
      tamano: formatFileSize(selectedFile.size),
      restringido: form.get("restringido") === "on",
      archivo: selectedFile,
      url: fileUrl,
      tipo: selectedFile.type,
    };

    setItems([nuevoDocumento, ...items]);

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setOpen(false);
  }

  function closeModal() {
    setOpen(false);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function visualizarDocumento(doc: Doc) {
    if (!doc.url) {
      alert(
        "Este documento pertenece a los archivos de ejemplo y todavía no tiene un archivo disponible para visualizar."
      );
      return;
    }

    setPreviewDoc(doc);
  }

  function descargarDocumento(doc: Doc) {
    if (!doc.url) {
      alert(
        "Este documento pertenece a los archivos de ejemplo y no tiene un archivo disponible para descargar."
      );
      return;
    }

    const link = document.createElement("a");

    link.href = doc.url;
    link.download = doc.nombre;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function cerrarVistaPrevia() {
    setPreviewDoc(null);
  }

  function eliminarDocumento(doc: Doc) {
    if (
      confirm(
        "¿Confirmas eliminar este documento?"
      )
    ) {
      if (doc.url) {
        URL.revokeObjectURL(doc.url);
      }

      setItems(
        items.filter((i) => i.id !== doc.id)
      );
    }
  }

  return (
    <DashboardLayout active="documentos">
      <div className="page-header">
        <div>
          <h1>Gestión documental</h1>

          <p>
            Centraliza, clasifica, consulta y controla el
            acceso a los documentos del edificio.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setOpen(true)}
        >
          <PlusIcon size={17} />
          Subir documento
        </button>
      </div>

      <div className="metric-row">
        <Metric
          t="Documentos"
          n={items.length}
        />

        <Metric
          t="Categorías"
          n={cats.length}
        />

        <Metric
          t="Restringidos"
          n={
            items.filter(
              (x) => x.restringido
            ).length
          }
        />
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Repositorio del edificio</h3>

            <p>
              Formatos permitidos: PDF, DOCX, JPG y PNG ·
              máximo 10 MB
            </p>
          </div>

          <div className="search-box">
            <SearchIcon size={17} />

            <input
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
              placeholder="Buscar documento..."
            />
          </div>
        </div>

        <div className="doc-filters">
          <button
            className={
              cat === "Todas"
                ? "filter-chip active"
                : "filter-chip"
            }
            onClick={() =>
              setCat("Todas")
            }
          >
            Todos
          </button>

          {cats.map((c) => (
            <button
              key={c}
              className={
                cat === c
                  ? "filter-chip active"
                  : "filter-chip"
              }
              onClick={() =>
                setCat(c)
              }
            >
              {c}
            </button>
          ))}
        </div>

        <div className="document-grid">
          {filtered.map((x) => (
            <article
              className="document-card"
              key={x.id}
            >
              <div className="doc-icon">
                <FileIcon size={24} />
              </div>

              <div className="doc-body">
                <div className="doc-top">
                  <span className="tag">
                    {x.categoria}
                  </span>

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
                  onClick={() =>
                    visualizarDocumento(x)
                  }
                >
                  <EyeIcon size={16} />
                </button>

                <button
                  className="icon-action"
                  title="Descargar documento"
                  onClick={() =>
                    descargarDocumento(x)
                  }
                >
                  ↓
                </button>

                <button
                  className="icon-action danger"
                  title="Eliminar"
                  onClick={() =>
                    eliminarDocumento(x)
                  }
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            No existen documentos que coincidan
            con la búsqueda.
          </div>
        )}
      </section>

      {/* MODAL SUBIR DOCUMENTO */}
      <Modal
        open={open}
        title="Subir documento"
        onClose={closeModal}
      >
        <form
          className="modal-form"
          onSubmit={upload}
        >
          <div className="form-grid">
            <div className="field">
              <span>Archivo</span>

              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                style={{
                  display: "none",
                }}
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <FileIcon size={17} />
                Seleccionar archivo
              </button>

              {selectedFile && (
                <small
                  style={{
                    display: "block",
                    marginTop: "8px",
                  }}
                >
                  Archivo seleccionado:{" "}
                  <strong>
                    {selectedFile.name}
                  </strong>
                </small>
              )}
            </div>

            <Select
              label="Categoría"
              name="categoria"
            />

            <label className="check-label">
              <input
                name="restringido"
                type="checkbox"
              />

              Documento restringido
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
            >
              Cancelar
            </button>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={!selectedFile}
            >
              Guardar documento
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL VISTA PREVIA */}
      <Modal
        open={!!previewDoc}
        title={
          previewDoc?.nombre ||
          "Vista previa"
        }
        onClose={cerrarVistaPrevia}
      >
        {previewDoc && (
          <div
            style={{
              width: "100%",
            }}
          >
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
                onClick={() =>
                  descargarDocumento(
                    previewDoc
                  )
                }
              >
                ↓ Descargar
              </button>
            </div>

            {previewDoc.tipo ===
              "application/pdf" && (
              <iframe
                src={previewDoc.url}
                title={previewDoc.nombre}
                style={{
                  width: "100%",
                  height: "600px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                }}
              />
            )}

            {previewDoc.tipo?.startsWith(
              "image/"
            ) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                  maxHeight: "600px",
                  overflow: "auto",
                }}
              >
                <img
                  src={previewDoc.url}
                  alt={previewDoc.nombre}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "600px",
                    objectFit: "contain",
                    borderRadius: "8px",
                  }}
                />
              </div>
            )}

            {previewDoc.tipo ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && (
              <div
                style={{
                  padding: "30px",
                  textAlign: "center",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                }}
              >
                <FileIcon size={40} />

                <h3>
                  Vista previa no disponible
                </h3>

                <p>
                  Los archivos DOCX no pueden
                  visualizarse directamente en
                  el navegador.
                </p>

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    descargarDocumento(
                      previewDoc
                    )
                  }
                >
                  ↓ Descargar documento
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

function Metric({
  t,
  n,
}: {
  t: string;
  n: number;
}) {
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

function Select({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <select name={name}>
        {cats.map((c) => (
          <option key={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
  ];

  const i = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return `${(
    bytes / Math.pow(1024, i)
  ).toFixed(i === 0 ? 0 : 1)} ${
    units[i]
  }`;
}