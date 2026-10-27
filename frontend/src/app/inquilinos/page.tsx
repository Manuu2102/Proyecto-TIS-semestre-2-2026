"use client";

import { useEffect, useMemo, useState } from "react";
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
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  correo: string;
  sexo: string;
  fechaNacimiento: string;
  idDepartamento: string;
  departamento: string;
  inicio: string;
  estado: Estado;
  ocupacionActiva: boolean;
};

type InquilinoAPI = {
  id: string;
  nombres: string;
  apellido_paterno?: string;
  apellido_materno?: string | null;
  ci: string;
  telefono?: string;
  email: string;
  sexo?: string;
  fecha_de_nacimiento?: string;
  estatus?: boolean;
  id_departamento?: string | null;
  departamento?: string | null;
  fecha_ocupacion?: string | null;
  ocupacion_activa?: boolean;
};

type DepartamentoAPI = {
  id: string;
  numeroCompleto: string;
};

type DepartamentoOpcion = {
  id: string;
  codigo: string;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

const CI_REGEX = /^[0-9]{5,10}$/;
const TELEFONO_REGEX = /^[0-9]{7,15}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const soloFecha = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

const adaptar = (u: InquilinoAPI): Inquilino => ({
  id: u.id,
  nombres: u.nombres,
  apellidoPaterno: u.apellido_paterno ?? "",
  apellidoMaterno: u.apellido_materno ?? "",
  ci: u.ci,
  telefono: u.telefono ?? "",
  correo: u.email,
  sexo: u.sexo ?? "",
  fechaNacimiento: soloFecha(u.fecha_de_nacimiento),
  idDepartamento: u.id_departamento ?? "",
  departamento: u.departamento ?? "",
  inicio: soloFecha(u.fecha_ocupacion),
  estado: u.estatus ? "Activo" : "Inactivo",
  ocupacionActiva: u.ocupacion_activa ?? false,
});

const mensajeDeError = (data: ApiErrorResponse) =>
  (Array.isArray(data.message) ? data.message.join(" ") : data.message) ??
  "No se pudo completar la acción.";

type InquilinoFormData = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  correo: string;
  sexo: string;
  fechaNacimiento: string;
  departamento: string; // id del departamento
  inicio: string;
};

export default function InquilinosPage() {
  const [items, setItems] = useState<Inquilino[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOpcion[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Inquilino | null>(null);

  const recargar = async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const [resInq, resDep] = await Promise.all([
      fetch(`${API_URL}/inquilinos`, { headers }),
      fetch(`${API_URL}/departamentos`, { headers }),
    ]);
    if (!resInq.ok || !resDep.ok) throw new Error("Error cargando datos");

    const dataInq: { inquilinos: InquilinoAPI[] } = await resInq.json();
    const dataDep: { departamentos: DepartamentoAPI[] } = await resDep.json();
    setItems(dataInq.inquilinos.map(adaptar));
    setDepartamentos(dataDep.departamentos.map((d) => ({ id: String(d.id), codigo: d.numeroCompleto })));
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        await recargar();
      } catch (e) {
        console.error("Error cargando inquilinos:", e);
      }
    };
    cargar();
  }, []);

  // Un departamento con inquilino activo no se ofrece (salvo el del que se está editando)
  const departamentosDisponibles = useMemo(() => {
    const conInquilino = new Set(
      items
        .filter((x) => x.estado === "Activo" && x.ocupacionActiva && x.id !== editing?.id)
        .map((x) => x.idDepartamento)
    );
    return departamentos.filter((d) => !conInquilino.has(d.id));
  }, [departamentos, items, editing]);

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

  async function save(data: InquilinoFormData): Promise<string | null> {
    const duplicadoError = validarDuplicado(data.ci, data.correo);
    if (duplicadoError) return duplicadoError;

    const body = {
      ci: data.ci,
      nombres: data.nombres,
      apellido_paterno: data.apellidoPaterno,
      apellido_materno: data.apellidoMaterno || undefined,
      email: data.correo,
      telefono: data.telefono,
      sexo: data.sexo,
      fecha_de_nacimiento: data.fechaNacimiento,
      id_departamento: Number(data.departamento),
      fecha_inicio: data.inicio,
    };

    try {
      const res = await fetch(
        editing ? `${API_URL}/inquilinos/${editing.id}` : `${API_URL}/inquilinos`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          // Al editar un inquilino inactivo y guardarlo, se reactiva en el departamento elegido
          body: JSON.stringify(editing ? { ...body, estatus: true } : body),
        }
      );

      if (!res.ok) return mensajeDeError(await res.json());

      await recargar();
      cerrarModal();
      return null;
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  }

  // Baja lógica primero (se conserva el historial de ocupación); solo se
  // borra físicamente si ya estaba Inactivo.
  async function eliminarInquilino(id: string) {
    const item = items.find((x) => x.id === id);
    if (!item) return;

    const activo = item.estado === "Activo";
    const confirmar = window.confirm(
      activo
        ? `¿Marcar a ${item.nombres} ${item.apellidoPaterno} como Inactivo? Se conservará su historial de ocupación.`
        : "Este inquilino ya está Inactivo. ¿Eliminar el registro de forma permanente?"
    );
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_URL}/inquilinos/${id}`, {
        method: activo ? "PATCH" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        ...(activo && { body: JSON.stringify({ estatus: false }) }),
      });

      if (!res.ok) {
        window.alert(mensajeDeError(await res.json()));
        return;
      }

      await recargar();
    } catch (e) {
      window.alert(`Error: ${(e as Error).message}`);
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
        <InquilinoForm
          key={editing?.id ?? "nuevo"}
          initial={editing}
          departamentos={departamentosDisponibles}
          onSave={save}
          onCancel={cerrarModal}
        />
      </Modal>
    </DashboardLayout>
  );
}

function InquilinoForm({
  initial,
  departamentos,
  onSave,
  onCancel,
}: {
  initial: Inquilino | null;
  departamentos: DepartamentoOpcion[];
  onSave: (data: InquilinoFormData) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    nombres: initial?.nombres ?? "",
    apellidoPaterno: initial?.apellidoPaterno ?? "",
    apellidoMaterno: initial?.apellidoMaterno ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    correo: initial?.correo ?? "",
    sexo: initial?.sexo ?? "",
    fechaNacimiento: initial?.fechaNacimiento ?? "",
    departamento: initial?.idDepartamento ?? "",
    inicio: initial?.inicio ?? "",
  });

  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function field(key: keyof typeof f, value: string) {
    setF((actual) => ({ ...actual, [key]: value }));
    setError("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !f.nombres.trim() || !f.apellidoPaterno.trim() || !f.departamento || !f.inicio ||
      !f.sexo || !f.fechaNacimiento
    ) {
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

    setGuardando(true);
    const errorGuardado = await onSave({
      nombres: f.nombres.trim(),
      apellidoPaterno: f.apellidoPaterno.trim(),
      apellidoMaterno: f.apellidoMaterno.trim(),
      ci: f.ci.trim(),
      telefono: f.telefono.trim(),
      correo: f.correo.trim(),
      sexo: f.sexo,
      fechaNacimiento: f.fechaNacimiento,
      departamento: f.departamento,
      inicio: f.inicio,
    });
    setGuardando(false);

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
          <span>Sexo *</span>
          <select value={f.sexo} onChange={(e) => field("sexo", e.target.value)}>
            <option value="">Selecciona</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </label>

        <Field label="Fecha de nacimiento" type="date" value={f.fechaNacimiento} onChange={(v) => field("fechaNacimiento", v)} />

        <label className="field">
          <span>Departamento *</span>
          <select value={f.departamento} onChange={(e) => field("departamento", e.target.value)}>
            <option value="">
              {departamentos.length === 0 ? "No hay departamentos disponibles" : "Selecciona un departamento"}
            </option>
            {departamentos.map((dep) => (
              <option key={dep.id} value={dep.id}>{dep.codigo}</option>
            ))}
          </select>
        </label>

        <Field label="Fecha de inicio de ocupación" type="date" value={f.inicio} onChange={(v) => field("inicio", v)} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : initial ? "Guardar cambios" : "Registrar inquilino"}
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