"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  CheckIcon, EditIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon, WrenchIcon,
} from "../../../components/Icons";
import { fechaCorta, formatoBs, hoyISO, normalizar } from "../../../lib/formato";
import {
  actualizarEmpleado, CARGOS_SUGERIDOS, crearEmpleado, eliminarEmpleado,
  listarAnticipos, listarEmpleados,
} from "../../../lib/personal";
import type { Anticipo, Empleado, EmpleadoForm } from "../../../lib/personal";

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CI_REGEX = /^\d{5,10}$/;
const TELEFONO_REGEX = /^\d{7,15}$/;
const SUELDO_MAXIMO = 999999.99;

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export default function PersonalPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [modal, setModal] = useState<"nuevo" | "editar" | null>(null);
  const [aEliminar, setAEliminar] = useState<Empleado | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function recargar() {
    const [emps, ants] = await Promise.all([listarEmpleados(), listarAnticipos()]);
    setEmpleados(emps);
    setAnticipos(ants);
  }

  useEffect(() => {
    let vigente = true;
    Promise.all([listarEmpleados(), listarAnticipos()])
      .then(([emps, ants]) => {
        if (!vigente) return;
        setEmpleados(emps);
        setAnticipos(ants);
      })
      .catch((e: Error) => vigente && setError(e.message || "No se pudo cargar el personal."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  // Los mensajes de éxito se ocultan solos
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(""), 4500);
    return () => clearTimeout(t);
  }, [mensaje]);

  const seleccionado = empleados.find((e) => e.id === seleccionadoId) ?? null;
  const anticiposDelSeleccionado = anticipos
    .filter((a) => a.empleadoId === seleccionadoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return empleados.filter((e) => !q || normalizar(e.nombre).includes(q));
  }, [empleados, busqueda]);

  const totalCargos = new Set(empleados.map((e) => normalizar(e.cargo.trim()))).size;
  const totalActivos = empleados.filter((e) => e.activo).length;
  const cargosConocidos = useMemo(
    () => Array.from(new Set([...CARGOS_SUGERIDOS, ...empleados.map((e) => e.cargo)])),
    [empleados]
  );

  /** Devuelve el mensaje de error si falla; null si todo salió bien (así lo muestra el formulario). */
  async function guardar(datos: EmpleadoForm): Promise<string | null> {
    try {
      if (modal === "editar" && seleccionado) {
        await actualizarEmpleado(seleccionado.id, datos);
        setMensaje("Los nuevos datos del empleado se guardaron correctamente.");
      } else {
        const nuevo = await crearEmpleado(datos);
        setSeleccionadoId(nuevo.id);
        setMensaje("Empleado registrado correctamente.");
      }
      await recargar();
      setModal(null);
      return null;
    } catch (e) {
      return (e as Error).message || "No se pudo guardar el empleado.";
    }
  }

  async function confirmarEliminacion() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      await eliminarEmpleado(aEliminar.id);
      if (seleccionadoId === aEliminar.id) setSeleccionadoId(null);
      await recargar();
      setMensaje("Empleado eliminado correctamente.");
    } catch (e) {
      setError((e as Error).message || "No se pudo eliminar al empleado.");
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  return (
    <DashboardLayout active="personal">
      <div className="page-header">
        <div>
          <p className="eyebrow">PERSONAL</p>
          <h1>Empleados</h1>
          <p>Registra al personal del edificio y consulta su información laboral.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("nuevo")}>
          <PlusIcon size={17} />
          Registrar empleado
        </button>
      </div>

      {mensaje && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>{mensaje}</div>}
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><UsersIcon size={20} /></div>
          <div><span>Total de empleados</span><strong>{cargando ? "…" : empleados.length}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Empleados activos</span><strong>{cargando ? "…" : totalActivos}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><WrenchIcon size={20} /></div>
          <div><span>Cargos registrados</span><strong>{cargando ? "…" : totalCargos}</strong></div>
        </div>
      </div>

      <div className="personal-layout">
        {/* ---------- Lista ---------- */}
        <section className="panel">
          <div className="panel-toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div>
              <h3>Historial de empleados</h3>
              <p>{filtrados.length} {filtrados.length === 1 ? "empleado" : "empleados"}</p>
            </div>
            <div className="search-box" style={{ width: "100%" }}>
              <SearchIcon size={17} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar empleado por nombre..."
                aria-label="Buscar empleado por nombre"
              />
            </div>
          </div>

          {cargando ? (
            <div className="state-box">Cargando empleados…</div>
          ) : filtrados.length === 0 ? (
            <div className="state-box">
              {empleados.length === 0
                ? "Aún no hay empleados registrados."
                : "No se encontraron empleados con ese nombre."}
            </div>
          ) : (
            <div className="personal-list">
              {filtrados.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`personal-item ${e.id === seleccionadoId ? "active" : ""}`}
                  onClick={() => setSeleccionadoId(e.id)}
                  aria-pressed={e.id === seleccionadoId}
                >
                  <span className="personal-avatar">{iniciales(e.nombre)}</span>
                  <span>
                    <strong>{e.nombre}</strong>
                    <small>{e.cargo}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Detalle ---------- */}
        <section className="panel">
          {!seleccionado ? (
            <div className="state-box">Selecciona un empleado de la lista para ver sus datos.</div>
          ) : (
            <>
              <div className="personal-detail-head">
                <div>
                  <h3>{seleccionado.nombre}</h3>
                  <p>{seleccionado.cargo}</p>
                </div>
                <div className="personal-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal("editar")}>
                    <EditIcon size={15} />
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setAEliminar(seleccionado)}>
                    <TrashIcon size={15} />
                    Eliminar
                  </button>
                </div>
              </div>

              <dl className="personal-datos">
                <div><dt>Nombre completo</dt><dd>{seleccionado.nombre}</dd></div>
                <div><dt>Correo electrónico</dt><dd>{seleccionado.email}</dd></div>
                <div><dt>Cargo</dt><dd>{seleccionado.cargo}</dd></div>
                <div><dt>CI</dt><dd>{seleccionado.ci}</dd></div>
                <div><dt>Teléfono</dt><dd>{seleccionado.telefono}</dd></div>
                <div><dt>Fecha de registro</dt><dd>{fechaCorta(seleccionado.fechaRegistro)}</dd></div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={seleccionado.activo ? "status status-success" : "status status-neutral"}>
                      <span />
                      {seleccionado.activo ? "Activo" : "Inactivo"}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="personal-sueldo">
                <span>Sueldo mensual</span>
                <strong>{formatoBs(seleccionado.sueldo)}</strong>
              </div>

              <div className="personal-section">
                <h4>Anticipos registrados</h4>
                {anticiposDelSeleccionado.length === 0 ? (
                  <div className="alert alert-info">Este empleado no tiene anticipos registrados.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Método</th>
                          <th>Monto</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anticiposDelSeleccionado.map((a) => (
                          <tr key={a.id}>
                            <td>{fechaCorta(a.fecha)}</td>
                            <td>{a.metodo}</td>
                            <td className="money">{formatoBs(a.monto)}</td>
                            <td>
                              <span className={a.estado === "Por descontar" ? "status status-attention" : "status status-success"}>
                                <span />
                                {a.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        open={modal !== null}
        title={modal === "editar" ? "Editar empleado" : "Registrar empleado"}
        onClose={() => setModal(null)}
      >
        <EmpleadoFormulario
          initial={modal === "editar" ? seleccionado : null}
          cargos={cargosConocidos}
          onSave={guardar}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={aEliminar !== null} title="Eliminar empleado" onClose={() => !eliminando && setAEliminar(null)}>
        <div className="confirm-body">
          ¿Seguro que deseas eliminar a <strong>{aEliminar?.nombre}</strong>? Dejará de aparecer en el historial de empleados.
        </div>
        <div className="modal-actions" style={{ padding: "0 24px 22px" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setAEliminar(null)} disabled={eliminando}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={confirmarEliminacion} disabled={eliminando}>
            {eliminando ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// =====================================================================
// Formulario (registro y edición)
// =====================================================================

type Valores = { nombre: string; email: string; cargo: string; ci: string; telefono: string; sueldo: string };
type Errores = Partial<Record<keyof Valores, string>>;

/** Solo dígitos y un punto decimal, con máximo 2 decimales. Acepta coma como separador. */
function soloDecimal(v: string) {
  const limpio = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [entero, ...resto] = limpio.split(".");
  return resto.length === 0 ? entero : `${entero}.${resto.join("").slice(0, 2)}`;
}

function validar(f: Valores): Errores {
  const e: Errores = {};
  const nombre = f.nombre.trim();
  if (!nombre) e.nombre = "El nombre completo es obligatorio.";
  else if (nombre.split(/\s+/).length < 2) e.nombre = "Ingresa el nombre y al menos un apellido.";

  if (!f.email.trim()) e.email = "El correo electrónico es obligatorio.";
  else if (!CORREO_REGEX.test(f.email.trim())) e.email = "El correo electrónico no tiene un formato válido.";

  if (!f.cargo.trim()) e.cargo = "El cargo es obligatorio.";

  if (!f.ci.trim()) e.ci = "El CI es obligatorio.";
  else if (!CI_REGEX.test(f.ci.trim())) e.ci = "El CI debe tener solo números (5 a 10 dígitos).";

  if (!f.telefono.trim()) e.telefono = "El teléfono es obligatorio.";
  else if (!TELEFONO_REGEX.test(f.telefono.trim())) e.telefono = "El teléfono debe tener solo números (7 a 15 dígitos).";

  const sueldo = Number(f.sueldo);
  if (!f.sueldo.trim()) e.sueldo = "El sueldo mensual es obligatorio.";
  else if (!Number.isFinite(sueldo) || sueldo <= 0) e.sueldo = "El sueldo debe ser un número mayor a 0.";
  else if (sueldo > SUELDO_MAXIMO) e.sueldo = "El sueldo es demasiado alto.";

  return e;
}

function EmpleadoFormulario({
  initial,
  cargos,
  onSave,
  onCancel,
}: {
  initial: Empleado | null;
  cargos: string[];
  onSave: (datos: EmpleadoForm) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Valores>({
    nombre: initial?.nombre ?? "",
    email: initial?.email ?? "",
    cargo: initial?.cargo ?? "",
    ci: initial?.ci ?? "",
    telefono: initial?.telefono ?? "",
    sueldo: initial ? String(initial.sueldo) : "",
  });
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cambiar(campo: keyof Valores, valor: string) {
    setF((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: undefined }));
    setErrorGeneral("");
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const encontrados = validar(f);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErrorGeneral("Revisa los campos marcados antes de guardar.");
      return;
    }
    setGuardando(true);
    const falla = await onSave({
      nombre: f.nombre.trim().replace(/\s+/g, " "),
      email: f.email.trim(),
      cargo: f.cargo.trim(),
      ci: f.ci.trim(),
      telefono: f.telefono.trim(),
      sueldo: Number(f.sueldo),
    });
    setGuardando(false);
    if (falla) setErrorGeneral(falla);
  }

  return (
    <form onSubmit={enviar} className="modal-form" noValidate>
      <div className="form-grid">
        <Campo label="Nombre completo" error={errores.nombre} className="span-2">
          <input value={f.nombre} onChange={(e) => cambiar("nombre", e.target.value)} placeholder="Ej. Carlos Mamani Quispe" autoComplete="off" />
        </Campo>

        <Campo label="Correo electrónico" error={errores.email}>
          <input type="email" value={f.email} onChange={(e) => cambiar("email", e.target.value)} placeholder="correo@email.com" autoComplete="off" />
        </Campo>

        <Campo label="Cargo" error={errores.cargo}>
          <input list="cargos-personal" value={f.cargo} onChange={(e) => cambiar("cargo", e.target.value)} placeholder="Ej. Portero" autoComplete="off" />
          <datalist id="cargos-personal">
            {cargos.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Campo>

        <Campo label="CI" error={errores.ci}>
          <input inputMode="numeric" value={f.ci} onChange={(e) => cambiar("ci", e.target.value.replace(/\D/g, ""))} placeholder="Solo números, ej. 7012245" autoComplete="off" />
        </Campo>

        <Campo label="Teléfono" error={errores.telefono}>
          <input inputMode="numeric" value={f.telefono} onChange={(e) => cambiar("telefono", e.target.value.replace(/\D/g, ""))} placeholder="Solo números, ej. 71234567" autoComplete="off" />
        </Campo>

        <Campo label="Sueldo mensual (Bs)" error={errores.sueldo}>
          <input inputMode="decimal" value={f.sueldo} onChange={(e) => cambiar("sueldo", soloDecimal(e.target.value))} placeholder="Ej. 2500.00" autoComplete="off" />
        </Campo>

        <Campo label="Fecha de registro" required={false} hint={initial ? undefined : "Se asigna automáticamente al guardar."}>
          <input value={fechaCorta(initial?.fechaRegistro ?? hoyISO())} disabled readOnly />
        </Campo>
      </div>

      {errorGeneral && <div className="alert alert-error" role="alert">{errorGeneral}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : initial ? "Guardar cambios" : "Registrar empleado"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  error,
  hint,
  required = true,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "has-error" : ""} ${className}`}>
      <span>{label} {required && <b>*</b>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}