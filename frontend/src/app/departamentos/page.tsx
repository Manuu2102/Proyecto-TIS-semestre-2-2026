"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Modal } from "../../components/Modal";
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  BuildingIcon,
} from "../../components/Icons";

type Departamento = {
  id: number;
  numero: string;
  piso: string;
  tipo: string;
  superficie: string;
  ocupacion: string;
  estado: "Ocupado" | "Disponible";
};

const initialData: Departamento[] = [
  {
    id: 1,
    numero: "A-101",
    piso: "1",
    tipo: "Estándar",
    superficie: "82 m²",
    ocupacion: "María F. Rojas",
    estado: "Ocupado",
  },
  {
    id: 2,
    numero: "A-202",
    piso: "2",
    tipo: "Estándar",
    superficie: "82 m²",
    ocupacion: "Carlos A. Pérez",
    estado: "Ocupado",
  },
  {
    id: 3,
    numero: "B-301",
    piso: "3",
    tipo: "Premium",
    superficie: "105 m²",
    ocupacion: "Sofía V. Cruz",
    estado: "Ocupado",
  },
  {
    id: 4,
    numero: "B-402",
    piso: "4",
    tipo: "Premium",
    superficie: "105 m²",
    ocupacion: "Disponible",
    estado: "Disponible",
  },
];

export default function DepartamentosPage() {
  const [items, setItems] = useState(initialData);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Departamento | null>(null);
  const filtered = useMemo(
    () =>
      items.filter((x) =>
        `${x.numero} ${x.piso} ${x.tipo} ${x.ocupacion}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  function save(data: Omit<Departamento, "id">) {
    setItems(
      editing
        ? items.map((x) => (x.id === editing.id ? { ...editing, ...data } : x))
        : [{ ...data, id: Date.now() }, ...items],
    );
    setOpen(false);
    setEditing(null);
  }

  return (
    <DashboardLayout active="departamentos">
      <div className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Departamentos</h1>
          <p>
            Administra las unidades habitacionales y su estado de ocupación.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <PlusIcon size={17} /> Registrar departamento
        </button>
      </div>
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <BuildingIcon size={20} />
          </div>
          <div>
            <span>Total unidades</span>
            <strong>{items.length}</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft">
            <BuildingIcon size={20} />
          </div>
          <div>
            <span>Ocupadas</span>
            <strong>
              {items.filter((x) => x.estado === "Ocupado").length}
            </strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention">
            <BuildingIcon size={20} />
          </div>
          <div>
            <span>Disponibles</span>
            <strong>
              {items.filter((x) => x.estado === "Disponible").length}
            </strong>
          </div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Unidades del edificio</h3>
            <p>{filtered.length} departamentos encontrados</p>
          </div>
          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, piso o estado..."
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Piso</th>
                <th>Tipo</th>
                <th>Superficie</th>
                <th>Ocupante</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.numero}</strong>
                  </td>
                  <td>{x.piso}</td>
                  <td>{x.tipo}</td>
                  <td>{x.superficie}</td>
                  <td>{x.ocupacion}</td>
                  <td>
                    <span
                      className={`status ${x.estado === "Ocupado" ? "status-success" : "status-attention"}`}
                    >
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
        title={editing ? "Editar departamento" : "Registrar departamento"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <DepartamentoForm
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

function DepartamentoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Departamento | null;
  onSave: (x: Omit<Departamento, "id">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    numero: initial?.numero ?? "",
    piso: initial?.piso ?? "",
    tipo: initial?.tipo ?? "Estándar",
    superficie: initial?.superficie ?? "",
    ocupacion: initial?.ocupacion ?? "Disponible",
    estado: initial?.estado ?? ("Disponible" as Departamento["estado"]),
  });
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.numero || !f.piso || !f.superficie) return;
    onSave(f);
  };
  return (
    <form onSubmit={submit} className="modal-form">
      <div className="form-grid">
        <Field
          label="Número de departamento"
          value={f.numero}
          onChange={(v) => set("numero", v)}
          placeholder="Ej. A-101"
        />
        <Field
          label="Piso"
          value={f.piso}
          onChange={(v) => set("piso", v)}
          placeholder="Ej. 1"
        />
        <Select
          label="Tipo"
          value={f.tipo}
          onChange={(v) => set("tipo", v)}
          options={["Estándar", "Premium", "Penthouse"]}
        />
        <Field
          label="Superficie"
          value={f.superficie}
          onChange={(v) => set("superficie", v)}
          placeholder="Ej. 82 m²"
        />
        <Select
          label="Ocupación"
          value={f.ocupacion}
          onChange={(v) => set("ocupacion", v)}
          options={["Disponible", "Propietario", "Inquilino"]}
        />
        <Select
          label="Estado"
          value={f.estado}
          onChange={(v) => set("estado", v)}
          options={["Disponible", "Ocupado"]}
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary">
          {initial ? "Guardar cambios" : "Registrar departamento"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label} *</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
