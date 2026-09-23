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

type InquilinoFormData = {
  nombre: string;
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

  const [editing, setEditing] =
    useState<Inquilino | null>(null);

  const filtered = useMemo(() => {
    const texto = query.toLowerCase();

    return items.filter((x) =>
      `${x.nombre} ${x.ci} ${x.departamento}`
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

  function save(data: InquilinoFormData) {
    if (editing) {
      // Editar inquilino existente
      setItems((actuales) =>
        actuales.map((x) =>
          x.id === editing.id
            ? {
                ...x,
                nombre: data.nombre,
                ci: data.ci,
                telefono: data.telefono,
                correo: data.correo,
                departamento: data.departamento,
                inicio: data.inicio,
              }
            : x
        )
      );

      cerrarModal();

      alert("Los datos del inquilino se actualizaron correctamente.");
    } else {
      // Registrar nuevo inquilino
      const nuevoInquilino: Inquilino = {
        id: Date.now(),
        nombre: data.nombre,
        ci: data.ci,
        telefono: data.telefono,
        correo: data.correo,
        departamento: data.departamento,
        inicio: data.inicio,
        estado: "Activo",
      };

      setItems((actuales) => [
        nuevoInquilino,
        ...actuales,
      ]);

      cerrarModal();

      alert("El inquilino se registró correctamente.");
    }
  }

  function eliminarInquilino(id: number) {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar este inquilino?"
    );

    if (!confirmar) {
      return;
    }

    setItems((actuales) =>
      actuales.filter((item) => item.id !== id)
    );

    alert("El inquilino se eliminó correctamente.");
  }

  return (
    <DashboardLayout active="inquilinos">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            ADMINISTRACIÓN
          </p>

          <h1>Inquilinos</h1>

          <p>
            Registra y consulta las personas que ocupan
            los departamentos.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={abrirRegistro}
        >
          <PlusIcon size={17} />
          Registrar inquilino
        </button>
      </div>

      {/* MÉTRICAS */}
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

            <strong>
              {
                items.filter(
                  (x) => x.estado === "Activo"
                ).length
              }
            </strong>
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Listado de inquilinos</h3>

            <p>
              {filtered.length} registros encontrados
            </p>
          </div>

          <div className="search-box">
            <SearchIcon size={17} />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
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
                    <span className="tag">
                      {x.departamento}
                    </span>
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
                        onClick={() =>
                          editarInquilino(x)
                        }
                        title="Editar"
                      >
                        <EditIcon size={16} />
                      </button>

                      <button
                        className="icon-action danger"
                        onClick={() =>
                          eliminarInquilino(x.id)
                        }
                        title="Eliminar"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No se encontraron inquilinos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL */}
      <Modal
        open={open}
        title={
          editing
            ? "Editar inquilino"
            : "Registrar inquilino"
        }
        onClose={cerrarModal}
      >
        <InquilinoForm
          initial={editing}
          onSave={save}
          onCancel={cerrarModal}
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
  onSave: (data: InquilinoFormData) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    nombre: initial?.nombre ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    correo: initial?.correo ?? "",
    departamento: initial?.departamento ?? "",
    inicio: initial?.inicio ?? "",
  });

  const [error, setError] = useState("");

  function field(
    key: keyof typeof f,
    value: string
  ) {
    setF((actual) => ({
      ...actual,
      [key]: value,
    }));

    setError("");
  }

  function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (
      !f.nombre ||
      !f.ci ||
      !f.telefono ||
      !f.correo ||
      !f.departamento ||
      !f.inicio
    ) {
      setError(
        "Completa todos los campos obligatorios."
      );
      return;
    }

    onSave({
      nombre: f.nombre,
      ci: f.ci,
      telefono: f.telefono,
      correo: f.correo,
      departamento: f.departamento,
      inicio: f.inicio,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="modal-form"
    >
      <div className="form-grid">
        <Field
          label="Nombre completo"
          value={f.nombre}
          onChange={(v) =>
            field("nombre", v)
          }
          placeholder="Ej. Ana Lucía Vargas"
        />

        <Field
          label="CI"
          value={f.ci}
          onChange={(v) =>
            field("ci", v)
          }
          placeholder="Ej. 7012245"
        />

        <Field
          label="Teléfono"
          value={f.telefono}
          onChange={(v) =>
            field("telefono", v)
          }
          placeholder="Ej. 720 118 332"
        />

        <Field
          label="Correo electrónico"
          type="email"
          value={f.correo}
          onChange={(v) =>
            field("correo", v)
          }
          placeholder="correo@email.com"
        />

        <Field
          label="Departamento"
          value={f.departamento}
          onChange={(v) =>
            field("departamento", v)
          }
          placeholder="Ej. A-103"
        />

        <Field
          label="Fecha de inicio"
          type="date"
          value={f.inicio}
          onChange={(v) =>
            field("inicio", v)
          }
        />
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="btn btn-primary"
        >
          {initial
            ? "Guardar cambios"
            : "Registrar inquilino"}
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
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  );
}