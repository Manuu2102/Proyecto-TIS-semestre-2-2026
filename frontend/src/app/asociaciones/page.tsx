"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { UsersIcon, BuildingIcon, TrashIcon } from "../../../components/Icons";
import { api } from "../../../lib/api";

type Copropietario = {
  id: string;
  nombres: string;
  apellido_paterno: string;
};

type Departamento = {
  id: number;
  numero: number;
  piso: number;
};

type Ocupacion = {
  id_copropietario: string;
  id_departamento: string;
  fecha_ocupacion: string;
  fecha_fin_ocupacion: string | null;
  estatus: boolean;
  usuario: any;
};

export default function Asociaciones() {
  const [copropietarios, setCopropietarios] = useState<Copropietario[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [deptSeleccionado, setDeptSeleccionado] = useState<number | null>(null);
  const [copSeleccionado, setCopSeleccionado] = useState<string>("");
  const [ocupaciones, setOcupaciones] = useState<Ocupacion[]>([]);
  const [savedMsg, setSavedMsg] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Cargar copropietarios + departamentos
  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true);
        const [copData, depData] = await Promise.all([
          api<any>("/copropietarios"),
          api<any>("/departamentos"),
        ]);
        setCopropietarios(copData.copropietarios || []);
        setDepartamentos(depData.departamentos || []);
        if (depData.departamentos.length > 0) {
          setDeptSeleccionado(depData.departamentos[0].id);
        }
      } catch (err: any) {
        console.error("Error al cargar:", err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // Cargar ocupaciones del depto seleccionado
  useEffect(() => {
    if (!deptSeleccionado) return;
    async function cargarOcupaciones() {
      try {
        const data = await api<any>(`/ocupaciones/departamento/${deptSeleccionado}`);
        setOcupaciones(data.historial || []);
      } catch (err: any) {
        console.error(err);
        setOcupaciones([]);
      }
    }
    cargarOcupaciones();
  }, [deptSeleccionado]);

  async function guardar() {
    setErrores([]);
    setSavedMsg("");

    if (!deptSeleccionado || !copSeleccionado) {
      setErrores(["Selecciona un departamento y un copropietario."]);
      return;
    }

    setGuardando(true);
    try {
      await api("/ocupaciones", {
        method: "POST",
        body: JSON.stringify({
          id_copropietario: copSeleccionado,
          id_departamento: deptSeleccionado,
          fecha_ocupacion: new Date().toISOString().split("T")[0],
        }),
      });

      setSavedMsg("✅ Asociación guardada correctamente");
      setCopSeleccionado("");

      const data = await api<any>(`/ocupaciones/departamento/${deptSeleccionado}`);
      setOcupaciones(data.historial || []);

      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err: any) {
      setErrores([err.message || "Error al asociar"]);
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar(idCop: string, idDept: string) {
    if (!confirm("¿Cerrar esta ocupación?")) return;
    try {
      await api(`/ocupaciones/cerrar/${idCop}/${idDept}`, { method: "PATCH" });
      const data = await api<any>(`/ocupaciones/departamento/${deptSeleccionado}`);
      setOcupaciones(data.historial || []);
      setSavedMsg("✅ Ocupación cerrada");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err: any) {
      setErrores([err.message]);
    }
  }

  const deptActual = departamentos.find((d) => d.id === deptSeleccionado);
  const ocupacionActual = ocupaciones.find((o) => o.estatus);

  if (cargando) {
    return (
      <DashboardLayout active="asociaciones">
        <div className="page-header"><h1>Cargando...</h1></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout active="asociaciones">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-01 · RELACIONES</p>
          <h1>Asociar ocupantes</h1>
          <p>Relaciona propietarios e inquilinos existentes con cada departamento.</p>
        </div>
      </div>

      {savedMsg && <div className="alert alert-success">{savedMsg}</div>}
      {errores.length > 0 && (
        <div className="alert alert-error">
          {errores.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

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
                value={deptSeleccionado ?? ""}
                onChange={(e) => setDeptSeleccionado(Number(e.target.value))}
              >
                {departamentos.length === 0 && <option value="">Sin departamentos</option>}
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.numero} - Piso {d.piso}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Copropietario</span>
              <select
                value={copSeleccionado}
                onChange={(e) => setCopSeleccionado(e.target.value)}
              >
                <option value="">Seleccionar copropietario</option>
                {copropietarios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombres} {c.apellido_paterno}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar asociación"}
            </button>
          </div>
        </div>

        <div className="association-preview">
          <div className="association-node">
            <BuildingIcon size={24} />
            <strong>{deptActual ? `#${deptActual.numero}` : "—"}</strong>
            <span>Departamento</span>
          </div>
          <div className="connector">↕</div>
          <div className="association-people">
            <div>
              <UsersIcon size={18} />
              <b>
                {ocupacionActual
                  ? `${ocupacionActual.usuario?.nombres || ""} ${ocupacionActual.usuario?.apellido_paterno || ""}`
                  : "Sin ocupante"}
              </b>
              <span>Ocupante actual</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Historial de este departamento</h3>
            <p>Todas las ocupaciones registradas.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ocupante</th>
                <th>Fecha inicio</th>
                <th>Fecha fin</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ocupaciones.length === 0 ? (
                <tr><td colSpan={5}>Sin ocupaciones registradas</td></tr>
              ) : (
                ocupaciones.map((o, i) => (
                  <tr key={i}>
                    <td>{o.usuario?.nombres} {o.usuario?.apellido_paterno}</td>
                    <td>{new Date(o.fecha_ocupacion).toLocaleDateString()}</td>
                    <td>
                      {o.fecha_fin_ocupacion
                        ? new Date(o.fecha_fin_ocupacion).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {o.estatus ? (
                        <span className="status status-success"><span />Activo</span>
                      ) : (
                        <span className="status">Cerrado</span>
                      )}
                    </td>
                    <td>
                      {o.estatus && (
                        <button
                          className="icon-button"
                          title="Cerrar ocupación"
                          onClick={() => cerrar(o.id_copropietario, o.id_departamento)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}