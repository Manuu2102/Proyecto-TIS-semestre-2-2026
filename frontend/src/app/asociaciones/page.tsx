"use client";
import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { UsersIcon, BuildingIcon, TrashIcon } from "../../../components/Icons";

const PEOPLE = ["María Fernanda Rojas", "Carlos Andrés Pérez", "Sofía Valentina Cruz"];
const TENANTS = ["Ana Lucía Vargas", "Diego Mauricio Salazar"];
const SIN_INQUILINO = "Sin inquilino";

type Asociacion = { propietario: string; inquilino: string };

// Simula lo que vendrá de /ocupaciones en el backend: una asociación distinta por depto.
const initialAsociaciones: Record<string, Asociacion> = {
  "A-101": { propietario: "María Fernanda Rojas", inquilino: "Ana Lucía Vargas" },
  "A-202": { propietario: "Carlos Andrés Pérez", inquilino: SIN_INQUILINO },
  "B-301": { propietario: "Sofía Valentina Cruz", inquilino: "Diego Mauricio Salazar" },
  "B-402": { propietario: PEOPLE[0], inquilino: SIN_INQUILINO },
};

const DEPARTAMENTOS = Object.keys(initialAsociaciones);

export default function Asociaciones() {
  const [asociaciones, setAsociaciones] = useState(initialAsociaciones);
  const [dept, setDept] = useState(DEPARTAMENTOS[0]);
  const [draftOwner, setDraftOwner] = useState(initialAsociaciones[DEPARTAMENTOS[0]].propietario);
  const [draftTenant, setDraftTenant] = useState(initialAsociaciones[DEPARTAMENTOS[0]].inquilino);
  const [savedMsg, setSavedMsg] = useState("");

  function selectDept(nuevo: string) {
    setDept(nuevo);
    setDraftOwner(asociaciones[nuevo].propietario);
    setDraftTenant(asociaciones[nuevo].inquilino);
    setSavedMsg("");
  }

  function guardar() {
    setAsociaciones((prev) => ({
      ...prev,
      [dept]: { propietario: draftOwner, inquilino: draftTenant },
    }));
    setSavedMsg(`Asociación de ${dept} guardada correctamente.`);
  }

  function quitarInquilino(deptCode: string) {
    setAsociaciones((prev) => ({
      ...prev,
      [deptCode]: { ...prev[deptCode], inquilino: SIN_INQUILINO },
    }));
    if (deptCode === dept) setDraftTenant(SIN_INQUILINO);
  }

  const actual = asociaciones[dept];

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
              <select value={dept} onChange={(e) => selectDept(e.target.value)}>
                {DEPARTAMENTOS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Propietario</span>
              <select value={draftOwner} onChange={(e) => setDraftOwner(e.target.value)}>
                {PEOPLE.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Inquilino</span>
              <select value={draftTenant} onChange={(e) => setDraftTenant(e.target.value)}>
                {TENANTS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
                <option>{SIN_INQUILINO}</option>
              </select>
            </label>

            <button className="btn btn-primary" onClick={guardar}>
              Guardar asociación
            </button>

            {savedMsg && <div className="alert alert-success">{savedMsg}</div>}
          </div>
        </div>

        <div className="association-preview">
          <div className="association-node">
            <BuildingIcon size={24} />
            <strong>{dept}</strong>
            <span>Departamento</span>
          </div>
          <div className="connector">↕</div>
          <div className="association-people">
            <div>
              <UsersIcon size={18} />
              <b>{actual.propietario}</b>
              <span>Propietario</span>
            </div>
            <div>
              <UsersIcon size={18} />
              <b>{actual.inquilino}</b>
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
              {DEPARTAMENTOS.map((d) => {
                const a = asociaciones[d];
                const tieneInquilino = a.inquilino !== SIN_INQUILINO;
                return (
                  <tr key={d}>
                    <td><span className="tag">{d}</span></td>
                    <td>{a.propietario}</td>
                    <td>
                      {tieneInquilino ? (
                        a.inquilino
                      ) : (
                        <span style={{ color: "#9A918B" }}>Sin inquilino</span>
                      )}
                    </td>
                    <td>
                      {tieneInquilino && (
                        <button
                          className="icon-button"
                          title="Quitar inquilino"
                          onClick={() => quitarInquilino(d)}
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