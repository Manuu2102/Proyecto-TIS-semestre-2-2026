"use client";

import { useCallback, useEffect, useState } from "react";
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
  id: string | number;
  descripcion?: string;
  numero?: string | number;
};

type CopropietarioAPI = {
  id: string | number;
  nombres: string;
  apellido_paterno?: string;
  apellido_materno?: string;
};

type UsuarioHistorial = {
  nombres: string;
  apellido_paterno?: string;
};

type HistorialItemAPI = {
  estatus: boolean;
  id_copropietario?: string;
  usuario: UsuarioHistorial;
};

type HistorialResponse = {
  historial?: HistorialItemAPI[];
};

type DepartamentosResponse = {
  departamentos: DepartamentoAPI[];
};

type CopropietariosResponse = {
  copropietarios: CopropietarioAPI[];
};

type ApiErrorResponse = {
  message?: string | string[];
};

// Extrae "[A-101] descripcion" → "A-101"
const parseCodigo = (desc: string) => {
  const match = desc.match(/^\[([^\]]+)\]/);
  return match ? match[1] : "";
};

export default function Asociaciones() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [copropietarios, setCopropietarios] = useState<PersonaOption[]>([]);
  const [asociaciones, setAsociaciones] = useState<Record<string, Asociacion>>({});
  const [deptSeleccionado, setDeptSeleccionado] = useState<string>("");
  const [draftOwnerId, setDraftOwnerId] = useState("");
  const [draftTenantId, setDraftTenantId] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Declarada ANTES del useEffect que la usa
  const cargarAsociaciones = useCallback(
    async (depts: DepartamentoOption[], deptActivo?: string) => {
      const asocs: Record<string, Asociacion> = {};
      for (const d of depts) {
        try {
          const r = await fetch(`${API_URL}/ocupaciones/departamento/${d.id}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!r.ok) continue;
          const data: HistorialResponse = await r.json();
          const activos = (data.historial ?? []).filter((h) => h.estatus === true);

          const owner = activos[0];
          const tenant = activos[1];

          asocs[d.id] = {
            propietario: owner
              ? `${owner.usuario.nombres} ${owner.usuario.apellido_paterno ?? ""}`.trim()
              : "",
            propietarioId: owner?.id_copropietario ?? "",
            inquilino: tenant
              ? `${tenant.usuario.nombres} ${tenant.usuario.apellido_paterno ?? ""}`.trim()
              : SIN_INQUILINO,
            inquilinoId: tenant?.id_copropietario ?? "",
          };
        } catch {
          asocs[d.id] = {
            propietario: "",
            propietarioId: "",
            inquilino: SIN_INQUILINO,
            inquilinoId: "",
          };
        }
      }
      setAsociaciones(asocs);

      // Sincroniza drafts con el departamento activo, sin useEffect
      if (deptActivo && asocs[deptActivo]) {
        setDraftOwnerId(asocs[deptActivo].propietarioId);
        setDraftTenantId(asocs[deptActivo].inquilinoId);
      }
    },
    []
  );

  // Cargar departamentos y copropietarios al montar
  useEffect(() => {
    const cargar = async () => {
      try {
        const [resDept, resCop] = await Promise.all([
          fetch(`${API_URL}/departamentos`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`${API_URL}/copropietarios`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);

        if (!resDept.ok || !resCop.ok) throw new Error("Error cargando datos");

        const dataDept: DepartamentosResponse = await resDept.json();
        const dataCop: CopropietariosResponse = await resCop.json();

        const optsDept: DepartamentoOption[] = dataDept.departamentos
          .map((d) => {
            const codigo = parseCodigo(d.descripcion ?? "");
            return { id: String(d.id), codigo: codigo || `N° ${d.numero ?? ""}` };
          })
          .filter((o) => o.codigo.length > 0);
        setDepartamentos(optsDept);

        const optsCop: PersonaOption[] = dataCop.copropietarios.map((c) => ({
          id: String(c.id),
          nombre: `${c.nombres} ${c.apellido_paterno ?? ""} ${c.apellido_materno ?? ""}`.trim(),
        }));
        setCopropietarios(optsCop);

        const primerDept = optsDept[0]?.id ?? "";
        if (primerDept) {
          setDeptSeleccionado(primerDept);
        }

        await cargarAsociaciones(optsDept, primerDept);
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
    };
    cargar();
  }, [cargarAsociaciones]);

  const recargarAsociaciones = async () => {
    await cargarAsociaciones(departamentos, deptSeleccionado);
  };

  const handleChangeDept = (nuevoDeptId: string) => {
    setDeptSeleccionado(nuevoDeptId);
    const asoc = asociaciones[nuevoDeptId];
    setDraftOwnerId(asoc?.propietarioId ?? "");
    setDraftTenantId(asoc?.inquilinoId ?? "");
    setSavedMsg("");
    setErrores([]);
  };

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

    try {
      setGuardando(true);
      const hoy = new Date().toISOString().slice(0, 10);

      const resOwner = await fetch(`${API_URL}/ocupaciones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          id_copropietario: draftOwnerId,
          id_departamento: Number(deptSeleccionado),
          fecha_ocupacion: hoy,
        }),
      });

      if (!resOwner.ok) {
        const data: ApiErrorResponse = await resOwner.json();
        setErrores(Array.isArray(data.message) ? data.message : [data.message ?? "Error"]);
        return;
      }

      if (draftTenantId) {
        const resTenant = await fetch(`${API_URL}/ocupaciones`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            id_copropietario: draftTenantId,
            id_departamento: Number(deptSeleccionado),
            fecha_ocupacion: hoy,
          }),
        });

        if (!resTenant.ok) {
          const data: ApiErrorResponse = await resTenant.json();
          setErrores([
            "Propietario asociado, pero el inquilino falló: " +
              (Array.isArray(data.message)
                ? data.message.join(", ")
                : data.message ?? "Error desconocido"),
          ]);
          await recargarAsociaciones();
          return;
        }
      }

      await recargarAsociaciones();
      setSavedMsg(
        `Asociación de ${
          departamentos.find((d) => d.id === deptSeleccionado)?.codigo
        } guardada correctamente.`
      );
    } catch (e) {
      setErrores([`Error: ${(e as Error).message}`]);
    } finally {
      setGuardando(false);
    }
  };

  const quitarInquilino = async (deptId: string) => {
    const asoc = asociaciones[deptId];
    if (!asoc || !asoc.inquilinoId) return;

    if (!window.confirm("¿Quitar el inquilino de este departamento?")) return;

    try {
      const res = await fetch(
        `${API_URL}/ocupaciones/cerrar/${asoc.inquilinoId}/${deptId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (!res.ok) {
        const data: ApiErrorResponse = await res.json();
        alert(
          Array.isArray(data.message)
            ? data.message.join("\n")
            : data.message ?? "Error desconocido"
        );
        return;
      }

      await recargarAsociaciones();
      if (deptId === deptSeleccionado) setDraftTenantId("");
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  };

  const deptActual = departamentos.find((d) => d.id === deptSeleccionado);
  const nombreOwner =
    copropietarios.find((c) => c.id === draftOwnerId)?.nombre ?? "Sin asignar";
  const nombreTenant = draftTenantId
    ? copropietarios.find((c) => c.id === draftTenantId)?.nombre ?? SIN_INQUILINO
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
                {copropietarios.map((c) => (
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