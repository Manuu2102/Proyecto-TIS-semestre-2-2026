"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Modal } from "../../components/Modal";
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  UsersIcon,
} from "../../components/Icons";

type Copropietario = {
  id: number;
  nombre: string;
  apellidos: string;
  ci: string;
  telefono: string;
  correo: string;
  departamento: string;
  estado: "Activo" | "Inactivo";
};

const initialData: Copropietario[] = [
  {
    id: 1,
    nombre: "María Fernanda",
    apellidos: "Rojas",
    ci: "4587210",
    telefono: "721 456 780",
    correo: "maria.rojas@email.com",
    departamento: "A-101",
    estado: "Activo",
  },
  {
    id: 2,
    nombre: "Carlos Andrés",
    apellidos: "Pérez",
    ci: "5129034",
    telefono: "734 220 114",
    correo: "carlos.perez@email.com",
    departamento: "A-202",
    estado: "Activo",
  },
  {
    id: 3,
    nombre: "Sofía Valentina",
    apellidos: "Cruz",
    ci: "6342189",
    telefono: "703 881 220",
    correo: "sofia.cruz@email.com",
    departamento: "B-301",
    estado: "Activo",
  },
];

export default function CopropietariosPage() {
  const [items, setItems] = useState(initialData);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Copropietario | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((x) =>
        `${x.nombre} ${x.apellidos} ${x.ci} ${x.departamento}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );

  function save(data: Omit<Copropietario, "id" | "estado">) {
    if (editing) {
      setItems(
        items.map((x) => (x.id === editing.id ? { ...editing, ...data } : x)),
      );
    } else {
      const newId = Date.now();
      setItems([{ ...data, id: newId, estado: "Activo" }, ...items]);
    }
    setOpen(false);
    setEditing(null);
  }

  function remove(id: number) {
    setItems(items.filter((x) => x.id !== id));
  }

  return (
    <DashboardLayout active="copropietarios">
      <PageHeader
        eyebrow="ADMINISTRACIÓN"
        title="Copropietarios"
        description="Gestiona la información de los propietarios del edificio."
        action={
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <PlusIcon size={17} /> Registrar copropietario
          </button>
        }
      />

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <UsersIcon size={20} />
          </div>
          <div>
            <span>Total copropietarios</span>
            <strong>{items.length}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft">
            <UsersIcon size={20} />
          </div>
          <div>
            <span>Activos</span>
            <strong>{items.filter((x) => x.estado === "Activo").length}</strong>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Listado de copropietarios</h3>
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
        <DataTable
          items={filtered}
          onEdit={(x) => {
            setEditing(x);
            setOpen(true);
          }}
          onDelete={remove}
        />
      </section>

      <Modal
        open={open}
        title={editing ? "Editar copropietario" : "Registrar copropietario"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <CopropietarioForm
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

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

function DataTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Copropietario[];
  onEdit: (x: Copropietario) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre completo</th>
            <th>Apellidos</th>
            <th>CI</th>
            <th>Teléfono</th>
            <th>Departamento</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td>
                <strong>{x.nombre}</strong>
                <small>{x.correo}</small>
              </td>
              <td>{x.apellidos}</td>
              <td>{x.ci}</td>
              <td>{x.telefono}</td>
              <td>
                <span className="tag">{x.departamento}</span>
              </td>
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
                    onClick={() => onEdit(x)}
                    aria-label="Editar"
                  >
                    <EditIcon size={16} />
                  </button>
                  <button
                    className="icon-action danger"
                    onClick={() => onDelete(x.id)}
                    aria-label="Eliminar"
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
  );
}

function CopropietarioForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Copropietario | null;
  onSave: (data: Omit<Copropietario, "id" | "estado">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? "",
    apellidos: initial?.apellidos ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    correo: initial?.correo ?? "",
    departamento: initial?.departamento ?? "",
  });
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.nombre ||
      !form.apellidos ||
      !form.ci ||
      !form.telefono ||
      !form.correo ||
      !form.departamento
    )
      return setError("Completa todos los campos obligatorios.");
    onSave(form);
  }
  return (
    <form onSubmit={submit} className="modal-form">
      <div className="form-grid">
        <Field
          label="Nombre completo"
          value={form.nombre}
          onChange={(v) => change("nombre", v)}
          placeholder="Ej. María Fernanda"
          required
        />
        <Field
          label="Apellidos"
          value={form.apellidos}
          onChange={(v) => change("apellidos", v)}
          placeholder="Ej. Rojas"
          required
        />
        <Field
          label="CI"
          value={form.ci}
          onChange={(v) => change("ci", v)}
          placeholder="Ej. 4587210"
          required
        />
        <Field
          label="Correo electrónico"
          type="email"
          value={form.correo}
          onChange={(v) => change("correo", v)}
          placeholder="correo@email.com"
          required
        />
        <Field
          label="Teléfono"
          value={form.telefono}
          onChange={(v) => change("telefono", v)}
          placeholder="Ej. 721 456 780"
          required
        />
        <Field
          label="Departamento"
          value={form.departamento}
          onChange={(v) => change("departamento", v)}
          placeholder="Ej. A-101"
          required
        />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit">
          {initial ? "Guardar cambios" : "Registrar copropietario"}
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
