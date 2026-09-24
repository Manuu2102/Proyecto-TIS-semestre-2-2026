"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  HomeIcon,
} from "../../../components/Icons";

type Estado = "Activo" | "Inactivo";

type Inquilino = {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  correo: string;
  departamento: string;
  inicio: string;
  estado: Estado;
};

// Simula la lista real de departamentos (vendrá de /departamentos en el backend).
const DEPARTAMENTOS_DISPONIBLES = [
  "A-101", "A-102", "A-103", "A-105", "A-106",
  "A-201", "A-202",
  "B-201", "B-202", "B-204",
  "B-301", "B-302", "B-402",
];

const CI_REGEX = /^[0-9]{5,10}$/;
const TELEFONO_REGEX = /^[0-9]{7,15}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialData: Inquilino[] = [
  { id: 1, nombres: "Ana Lucía", apellidoPaterno: "Vargas", apellidoMaterno: "Rocha", ci: "7012245", telefono: "72011833", correo: "ana.vargas@email.com", departamento: "A-103", inicio: "2026-02-12", estado: "Activo" },
  { id: 2, nombres: "Diego Mauricio", apellidoPaterno: "Salazar", apellidoMaterno: "Vega", ci: "6389102", telefono: "74439022", correo: "diego.salazar@email.com", departamento: "B-204", inicio: "2026-05-03", estado: "Activo" },
  { id: 3, nombres: "Valeria", apellidoPaterno: "Núñez", apellidoMaterno: "Castro", ci: "8190031", telefono: "70922345", correo: "valeria.nunez@email.com", departamento: "B-402", inicio: "2026-01-21", estado: "Activo" },
];

type InquilinoFormData = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  correo: string;
  departamento: string;
  inicio: string;
};

export default function InquilinosPage() {
  const [items, setItems] = useState<Inquilino[]>(initialData);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inquilino | null>(null);

  const filtered = useMemo(() => {
    const texto = query.toLowerCase();
    return items.filter((x) =>
      `${x.nombres} ${x.apellidoPaterno} ${x.apellidoMaterno} ${x.ci} ${x.departamento}`
        .toLowerCase()
        .includes(texto)
    );
  }, [items, query]);

  function abrirRegistro() {
    setEditing(null);
    setOpen(true);
  }

  function editarInquilino(inquilino: Inquilino) {
    setEditing(inquilino);
    setOpen(true);
  }

  function cerrarModal() {
    setOpen(false);
    setEditing(null);
  }

  function validarDuplicado(ci: string, correo: string): string | null {
    const ciDup = items.some((x) => x.ci === ci && x.id !== editing?.id);
    if (ciDup) return "Ya existe un inquilino registrado con ese CI.";

    const correoDup = items.some(
      (x) => x.correo.toLowerCase() === correo.toLowerCase() && x.id !== editing?.id
    );
    if (correoDup) return "Ya existe un inquilino registrado con ese correo.";

    return null;
  }

  function save(data: InquilinoFormData): string | null {
    const duplicadoError = validarDuplicado(data.ci, data.correo);
    if (duplicadoError) return duplicadoError;

    if (editing) {
      setItems((actuales) =>
        actuales.map((x) => (x.id === editing.id ? { ...x, ...data } : x))
      );
      cerrarModal();
    } else {
      const nuevoInquilino: Inquilino = {
        id: Date.now(),
        ...data,
        estado: "Activo",
      };
      setItems((actuales) => [nuevoInquilino, ...actuales]);
      cerrarModal();
    }

    return null;
  }

  // Baja lógica primero (se conserva el historial de ocupación); solo se
  // borra físicamente si ya estaba Inactivo.
  function eliminarInquilino(id: number) {
    const item = items.find((x) => x.id === id);
    if (!item) return;

    if (item.estado === "Activo") {
      const confirmar = window.confirm(
        `¿Marcar a ${item.nombres} ${item.apellidoPaterno} como Inactivo? Se conservará su historial de ocupación.`
      );
      if (!confirmar) return;
      setItems((actuales) =>
        actuales.map((x) => (x.id === id ? { ...x, estado: "Inactivo" } : x))
      );
    } else {
      const confirmar = window.confirm(
        "Este inquilino ya está Inactivo. ¿Eliminar el registro de forma permanente?"
      );
      if (!confirmar) return;
      setItems((actuales) => actuales.filter((x) => x.id !== id));
    }
  }

  return (
    <DashboardLayout active="inquilinos">
      <div className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Inquilinos</h1>
          <p>Registra y consulta las personas que ocupan los departamentos.</p>
        </div>

        <button className="btn btn-primary" onClick={abrirRegistro}>
          <PlusIcon size={17} />
          Registrar inquilino
        </button>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><HomeIcon size={20} /></div>
          <div>
            <span>Total inquilinos</span>
            <strong>{items.length}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft"><HomeIcon size={20} /></div>
          <div>
            <span>Ocupaciones activas</span>
            <strong>{items.filter((x) => x.estado === "Activo").length}</strong>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Listado de inquilinos</h3>
            <p>{filtered.length} registros encontrados</p>
          </div>

          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, CI o departamento..."
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Inquilino</th>
                <th>CI</th>
                <th>Teléfono</th>
                <th>Departamento</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.nombres} {x.apellidoPaterno} {x.apellidoMaterno}</strong>
                    <small>{x.correo}</small>
                  </td>
                  <td>{x.ci}</td>
                  <td>{x.telefono}</td>
                  <td><span className="tag">{x.departamento}</span></td>
                  <td>{x.inicio}</td>
                  <td>
                    <span className={x.estado === "Activo" ? "status status-success" : "status status-neutral"}>
                      <span />
                      {x.estado}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-action" onClick={() => editarInquilino(x)} title="Editar">
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="icon-action danger"
                        onClick={() => eliminarInquilino(x.id)}
                        title={x.estado === "Activo" ? "Marcar como inactivo" : "Eliminar definitivamente"}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px" }}>
                    No se encontraron inquilinos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} title={editing ? "Editar inquilino" : "Registrar inquilino"} onClose={cerrarModal}>
        <InquilinoForm initial={editing} onSave={save} onCancel={cerrarModal} />
      </Modal>
    </DashboardLayout>
  );
}

function InquilinoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Inquilino | null;
  onSave: (data: InquilinoFormData) => string | null;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    nombres: initial?.nombres ?? "",
    apellidoPaterno: initial?.apellidoPaterno ?? "",
    apellidoMaterno: initial?.apellidoMaterno ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    correo: initial?.correo ?? "",
    departamento: initial?.departamento ?? "",
    inicio: initial?.inicio ?? "",
  });

  const [error, setError] = useState("");

  function field(key: keyof typeof f, value: string) {
    setF((actual) => ({ ...actual, [key]: value }));
    setError("");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!f.nombres.trim() || !f.apellidoPaterno.trim() || !f.departamento || !f.inicio) {
      setError("Completa todos los campos obligatorios.");
      return;
    }

    if (!CI_REGEX.test(f.ci.trim())) {
      setError("El CI debe tener solo números (5 a 10 dígitos).");
      return;
    }

    if (!TELEFONO_REGEX.test(f.telefono.trim())) {
      setError("El teléfono debe tener solo números (7 a 15 dígitos).");
      return;
    }

    if (!CORREO_REGEX.test(f.correo.trim())) {
      setError("El correo electrónico no tiene un formato válido.");
      return;
    }

    const errorGuardado = onSave({
      nombres: f.nombres.trim(),
      apellidoPaterno: f.apellidoPaterno.trim(),
      apellidoMaterno: f.apellidoMaterno.trim(),
      ci: f.ci.trim(),
      telefono: f.telefono.trim(),
      correo: f.correo.trim(),
      departamento: f.departamento,
      inicio: f.inicio,
    });

    if (errorGuardado) setError(errorGuardado);
  }

  return (
    <form onSubmit={submit} className="modal-form">
      <div className="form-grid">
        <Field label="Nombres" value={f.nombres} onChange={(v) => field("nombres", v)} placeholder="Ej. Ana Lucía" />
        <Field label="Apellido paterno" value={f.apellidoPaterno} onChange={(v) => field("apellidoPaterno", v)} placeholder="Ej. Vargas" />
        <Field label="Apellido materno" value={f.apellidoMaterno} onChange={(v) => field("apellidoMaterno", v)} placeholder="Ej. Rocha (opcional)" />
        <Field label="CI" value={f.ci} onChange={(v) => field("ci", v.replace(/\D/g, ""))} placeholder="Solo números, ej. 7012245" />
        <Field label="Teléfono" value={f.telefono} onChange={(v) => field("telefono", v.replace(/\D/g, ""))} placeholder="Solo números, ej. 69848860" />
        <Field label="Correo electrónico" type="email" value={f.correo} onChange={(v) => field("correo", v)} placeholder="correo@email.com" />

        <label className="field">
          <span>Departamento *</span>
          <select value={f.departamento} onChange={(e) => field("departamento", e.target.value)}>
            <option value="">Selecciona un departamento</option>
            {DEPARTAMENTOS_DISPONIBLES.map((dep) => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </label>

        <Field label="Fecha de inicio de ocupación" type="date" value={f.inicio} onChange={(v) => field("inicio", v)} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">
          {initial ? "Guardar cambios" : "Registrar inquilino"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label} *</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}