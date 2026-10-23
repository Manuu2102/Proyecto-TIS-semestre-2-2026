"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { UsersIcon, BuildingIcon, TrashIcon } from "../../../components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

const SIN_INQUILINO = "Sin inquilino";

type DepartamentoOption = {
  id: string;
  codigo: string;
};

type PersonaOption = {
  id: string;
  nombre: string;
};

type Asociacion = {
  propietario: string;
  propietarioId: string;
  inquilino: string;
  inquilinoId: string;
};

type DepartamentoAPI = {
  id: string;
  numeroCompleto: string;
};

type CopropietarioAPI = {
  id: string;
  nombres: string;
  apellido_paterno?: string;
  apellido_materno?: string | null;
  estatus?: boolean;
  departamentos?: { id: string; codigo: string }[];
};

type InquilinoAPI = {
  id: string;
  nombres: string;
  apellido_paterno?: string;
  apellido_materno?: string | null;
  estatus?: boolean;
  id_departamento?: string | null;
  departamento?: string | null;
  ocupacion_activa?: boolean;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const nombreCompleto = (p: { nombres: string; apellido_paterno?: string; apellido_materno?: string | null }) =>
  `${p.nombres} ${p.apellido_paterno ?? ""} ${p.apellido_materno ?? ""}`.replace(/\s+/g, " ").trim();

const mensajeDeError = (data: ApiErrorResponse) =>
  (Array.isArray(data.message) ? data.message.join(", ") : data.message) ?? "Error desconocido";

const vacia = (): Asociacion => ({
  propietario: "",
  propietarioId: "",
  inquilino: SIN_INQUILINO,
  inquilinoId: "",
});

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const data: ApiErrorResponse = await res.json().catch(() => ({}));
    throw new Error(mensajeDeError(data));
  }
  return res.json();
}

export default function Asociaciones() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [copropietarios, setCopropietarios] = useState<PersonaOption[]>([]);
  const [inquilinos, setInquilinos] = useState<PersonaOption[]>([]);
  const [asociaciones, setAsociaciones] = useState<Record<string, Asociacion>>({});
  const [deptSeleccionado, setDeptSeleccionado] = useState<string>("");
  const [draftOwnerId, setDraftOwnerId] = useState("");
  const [draftTenantId, setDraftTenantId] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  /**
   * Carga departamentos, copropietarios e inquilinos (3 consultas en total) y arma
   * las asociaciones según el rol de cada ocupante. Devuelve las asociaciones para
   * sincronizar el formulario con el departamento activo.
   */
  const cargar = async (deptActivo?: string) => {
    const [dataDept, dataCop, dataInq]: [
      { departamentos: DepartamentoAPI[] },
      { copropietarios: CopropietarioAPI[] },
      { inquilinos: InquilinoAPI[] },
    ] = await Promise.all([pedir("/departamentos"), pedir("/copropietarios"), pedir("/inquilinos")]);

    const optsDept = dataDept.departamentos.map((d) => ({ id: String(d.id), codigo: d.numeroCompleto }));
    const asocs: Record<string, Asociacion> = {};
    for (const d of optsDept) asocs[d.id] = vacia();

    for (const c of dataCop.copropietarios) {
      for (const d of c.departamentos ?? []) {
        if (!asocs[d.id]) continue;
        asocs[d.id].propietario = nombreCompleto(c);
        asocs[d.id].propietarioId = c.id;
      }
    }

    for (const i of dataInq.inquilinos) {
      if (!i.estatus || !i.ocupacion_activa || !i.id_departamento || !asocs[i.id_departamento]) continue;
      asocs[i.id_departamento].inquilino = nombreCompleto(i);
      asocs[i.id_departamento].inquilinoId = i.id;
    }

    setDepartamentos(optsDept);
    setCopropietarios(
      dataCop.copropietarios
        .filter((c) => c.estatus !== false)
        .map((c) => ({ id: c.id, nombre: nombreCompleto(c) }))
    );
    // Se muestra dónde vive cada inquilino: asignarlo aquí lo muda de departamento
    setInquilinos(
      dataInq.inquilinos
        .filter((i) => i.estatus !== false)
        .map((i) => ({
          id: i.id,
          nombre: i.ocupacion_activa && i.departamento
            ? `${nombreCompleto(i)} (${i.departamento})`
            : nombreCompleto(i),
        }))
    );
    setAsociaciones(asocs);

    const activo = deptActivo || optsDept[0]?.id || "";
    setDeptSeleccionado(activo);
    setDraftOwnerId(asocs[activo]?.propietarioId ?? "");
    setDraftTenantId(asocs[activo]?.inquilinoId ?? "");
  };

  // Cargar todo al montar
  useEffect(() => {
    const inicial = async () => {
      try {
        await cargar();
      } catch (e) {
        console.error("Error cargando datos:", e);
        setErrores([`Error cargando datos: ${(e as Error).message}`]);
      }
    };
    inicial();
  }, []);

  const handleChangeDept = (nuevoDeptId: string) => {
    setDeptSeleccionado(nuevoDeptId);
    const asoc = asociaciones[nuevoDeptId];
    setDraftOwnerId(asoc?.propietarioId ?? "");
    setDraftTenantId(asoc?.inquilinoId ?? "");
    setSavedMsg("");
    setErrores([]);
  };

  const cerrarOcupacion = (idUsuario: string, idDepartamento: string) =>
    pedir(`/ocupaciones/cerrar/${idUsuario}/${idDepartamento}`, { method: "PATCH" });

  const guardar = async () => {
    setErrores([]);
    setSavedMsg("");

    if (!deptSeleccionado) {
      setErrores(["Selecciona un departamento."]);
      return;
    }
    if (!draftOwnerId) {
      setErrores(["Debes seleccionar un propietario."]);
      return;
    }

    const actual = asociaciones[deptSeleccionado] ?? vacia();
    const cambiaOwner = draftOwnerId !== actual.propietarioId;
    const cambiaTenant = draftTenantId !== actual.inquilinoId;
    const codigo = departamentos.find((d) => d.id === deptSeleccionado)?.codigo;

    if (!cambiaOwner && !cambiaTenant) {
      setSavedMsg(`No hay cambios en ${codigo}.`);
      return;
    }

    setGuardando(true);
    let paso = "propietario";
    try {
      // Propietario: se cierra el anterior y se asocia el nuevo (puede tener otros departamentos)
      if (cambiaOwner) {
        if (actual.propietarioId) await cerrarOcupacion(actual.propietarioId, deptSeleccionado);
        await pedir("/ocupaciones", {
          method: "POST",
          body: JSON.stringify({
            id_copropietario: draftOwnerId,
            id_departamento: Number(deptSeleccionado),
            fecha_ocupacion: new Date().toISOString().slice(0, 10),
          }),
        });
      }

      // Inquilino: se quita el anterior y el nuevo se muda aquí (deja su departamento previo)
      paso = "inquilino";
      if (cambiaTenant) {
        if (actual.inquilinoId) await cerrarOcupacion(actual.inquilinoId, deptSeleccionado);
        if (draftTenantId) {
          await pedir(`/inquilinos/${draftTenantId}`, {
            method: "PATCH",
            body: JSON.stringify({ id_departamento: Number(deptSeleccionado), estatus: true }),
          });
        }
      }

      await cargar(deptSeleccionado);
      setSavedMsg(`Asociación de ${codigo} guardada correctamente.`);
    } catch (e) {
      const mensaje = (e as Error).message;
      setErrores([
        paso === "inquilino" && cambiaOwner
          ? `Propietario asociado, pero el inquilino falló: ${mensaje}`
          : mensaje,
      ]);
      await cargar(deptSeleccionado).catch(() => undefined);
    } finally {
      setGuardando(false);
    }
  };

  const quitarInquilino = async (deptId: string) => {
    const asoc = asociaciones[deptId];
    if (!asoc || !asoc.inquilinoId) return;

    if (!window.confirm("¿Quitar el inquilino de este departamento?")) return;

    try {
      await cerrarOcupacion(asoc.inquilinoId, deptId);
      await cargar(deptSeleccionado);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deptActual = departamentos.find((d) => d.id === deptSeleccionado);
  const nombreOwner =
    copropietarios.find((c) => c.id === draftOwnerId)?.nombre ?? "Sin asignar";
  const nombreTenant = draftTenantId
    ? inquilinos.find((c) => c.id === draftTenantId)?.nombre ?? SIN_INQUILINO
    : SIN_INQUILINO;

  return (
    <DashboardLayout active="asociaciones">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-01 · RELACIONES</p>
          <h1>Asociar ocupantes</h1>
          <p>Relaciona propietarios e inquilinos existentes con cada departamento.</p>
        </div>
      </div>

      <section className="association-layout">
        <div className="panel association-form">
          <div className="panel-toolbar">
            <div>
              <h3>Asignación de ocupantes</h3>
              <p>Solo se pueden seleccionar registros previamente creados.</p>
            </div>
          </div>
          <div className="modal-form">
            <label className="field">
              <span>Departamento</span>
              <select
                value={deptSeleccionado}
                onChange={(e) => handleChangeDept(e.target.value)}
                disabled={departamentos.length === 0}
              >
                {departamentos.length === 0 && <option>No hay departamentos</option>}
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.codigo}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Propietario</span>
              <select
                value={draftOwnerId}
                onChange={(e) => setDraftOwnerId(e.target.value)}
                disabled={copropietarios.length === 0}
              >
                <option value="">Selecciona propietario</option>
                {copropietarios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Inquilino</span>
              <select
                value={draftTenantId}
                onChange={(e) => setDraftTenantId(e.target.value)}
              >
                <option value="">{SIN_INQUILINO}</option>
                {inquilinos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="btn btn-primary"
              onClick={guardar}
              disabled={guardando || departamentos.length === 0}
            >
              {guardando ? "Guardando..." : "Guardar asociación"}
            </button>

            {errores.length > 0 && (
              <div className="alert alert-error">
                {errores.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}
            {savedMsg && <div className="alert alert-success">{savedMsg}</div>}
          </div>
        </div>

        <div className="association-preview">
          <div className="association-node">
            <BuildingIcon size={24} />
            <strong>{deptActual?.codigo ?? "—"}</strong>
            <span>Departamento</span>
          </div>
          <div className="connector">↕</div>
          <div className="association-people">
            <div>
              <UsersIcon size={18} />
              <b>{nombreOwner}</b>
              <span>Propietario</span>
            </div>
            <div>
              <UsersIcon size={18} />
              <b>{nombreTenant}</b>
              <span>Inquilino</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Asociaciones existentes</h3>
            <p>Estado actual de todos los departamentos ya asignados.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Propietario</th>
                <th>Inquilino</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {departamentos.map((d) => {
                const a = asociaciones[d.id];
                const tienePropietario = !!(a && a.propietarioId);
                const tieneInquilino = !!(a && a.inquilinoId);

                return (
                  <tr key={d.id}>
                    <td>
                      <span className="tag">{d.codigo}</span>
                    </td>
                    <td>
                      {tienePropietario ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{a.propietario}</span>
                          <span className="status status-success">
                            <span />
                            Actual
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#9A918B" }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      {tieneInquilino ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{a.inquilino}</span>
                          <span className="status status-success">
                            <span />
                            Actual
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#9A918B" }}>Sin inquilino</span>
                      )}
                    </td>
                    <td>
                      {tieneInquilino && (
                        <button
                          className="icon-button"
                          title="Quitar inquilino"
                          onClick={() => quitarInquilino(d.id)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
