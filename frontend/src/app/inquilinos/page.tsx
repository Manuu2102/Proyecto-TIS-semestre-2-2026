"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Modal } from "../../components/Modal";
import { saveUser } from "../auth";
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  HomeIcon,
} from "../../components/Icons";

type Inquilino = {
  id: number;
  nombre: string;
  ci: string;
  telefono: string;
  correo: string;
  departamento: string;
  inicio: string;
  estado: "Activo" | "Inactivo";
};

const initialData: Inquilino[] = [
  {
    id: 1,
    nombre: "Ana Lucía Vargas",
    ci: "7012245",
    telefono: "720 118 332",
    correo: "ana.vargas@email.com",
    departamento: "A-103",
    inicio: "12/02/2026",
    estado: "Activo",
  },
  {
    id: 2,
    nombre: "Diego Mauricio Salazar",
    ci: "6389102",
    telefono: "744 390 221",
    correo: "diego.salazar@email.com",
    departamento: "B-204",
    inicio: "03/05/2026",
    estado: "Activo",
  },
  {
    id: 3,
    nombre: "Valeria Núñez",
    ci: "8190031",
    telefono: "709 223 456",
    correo: "valeria.nunez@email.com",
    departamento: "B-402",
    inicio: "21/01/2026",
    estado: "Activo",
  },
];

export default function InquilinosPage() {
  const [items, setItems] = useState(initialData);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inquilino | null>(null);
  const filtered = useMemo(
    () =>
      items.filter((x) =>
        `${x.nombre} ${x.ci} ${x.departamento}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );

  function save(
    data: Omit<Inquilino, "id" | "estado"> & { password?: string },
  ) {
    setItems(
      editing
        ? items.map((x) => (x.id === editing.id ? { ...editing, ...data } : x))
        : [{ ...data, id: Date.now(), estado: "Activo" }, ...items],
    );
    if (!editing && data.password)
      saveUser({
        id: Date.now(),
        nombre: data.nombre,
        email: data.correo,
        password: data.password,
        role: "INQUILINO",
        departamento: data.departamento,
      });
    setOpen(false);
    setEditing(null);
  }
  return (
    <DashboardLayout active="inquilinos">
      <div className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Inquilinos</h1>
          <p>Registra y consulta las personas que ocupan los departamentos.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <PlusIcon size={17} /> Registrar inquilino
        </button>
      </div>
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <HomeIcon size={20} />
          </div>
          <div>
            <span>Total inquilinos</span>
            <strong>{items.length}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft">
            <HomeIcon size={20} />
          </div>
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
                    <strong>{x.nombre}</strong>
                    <small>{x.correo}</small>
                  </td>
                  <td>{x.ci}</td>
                  <td>{x.telefono}</td>
                  <td>
                    <span className="tag">{x.departamento}</span>
                  </td>
                  <td>{x.inicio}</td>
                  <td>
                    <span className="status status-success">
                      <span />
                      {x.estado}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-action"
                        onClick={() => {
                          setEditing(x);
                          setOpen(true);
                        }}
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="icon-action danger"
                        onClick={() =>
                          setItems(items.filter((i) => i.id !== x.id))
                        }
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={open}
        title={editing ? "Editar inquilino" : "Registrar inquilino"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <InquilinoForm
          initial={editing}
          onSave={save}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
          }}
        />
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
  onSave: (x: Omit<Inquilino, "id" | "estado"> & { password?: string }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    nombre: initial?.nombre ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    correo: initial?.correo ?? "",
    password: "",
    departamento: initial?.departamento ?? "",
    inicio: initial?.inicio ?? "",
  });
  const [error, setError] = useState("");
  const field = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.values(f).some((v) => !v))
      return setError("Completa todos los campos obligatorios.");
    onSave(f);
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <div className="form-grid">
        <Field
          label="Nombre completo"
          value={f.nombre}
          onChange={(v) => field("nombre", v)}
          placeholder="Ej. Ana Lucía Vargas"
        />
        <Field
          label="CI"
          value={f.ci}
          onChange={(v) => field("ci", v)}
          placeholder="Ej. 7012245"
        />
        <Field
          label="Teléfono"
          value={f.telefono}
          onChange={(v) => field("telefono", v)}
          placeholder="Ej. 720 118 332"
        />
        <Field
          label="Correo electrónico"
          type="email"
          value={f.correo}
          onChange={(v) => field("correo", v)}
          placeholder="correo@email.com"
        />
        <Field
          label="Contraseña de acceso"
          type="password"
          value={f.password}
          onChange={(v) => field("password", v)}
          placeholder="Mínimo 8 caracteres"
        />
        <Field
          label="Departamento"
          value={f.departamento}
          onChange={(v) => field("departamento", v)}
          placeholder="Ej. A-103"
        />
        <Field
          label="Fecha de inicio"
          type="date"
          value={f.inicio}
          onChange={(v) => field("inicio", v)}
        />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary">
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
