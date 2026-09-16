"use client";

import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { UsersIcon, BuildingIcon } from "../../components/Icons";

const people = [
  "María Fernanda Rojas",
  "Carlos Andrés Pérez",
  "Sofía Valentina Cruz",
];

export default function Asociaciones() {
  const [dept, setDept] = useState("A-101");
  const [owner, setOwner] = useState(people[0]);
  const [tenant, setTenant] = useState("Ana Lucía Vargas");
  const [saved, setSaved] = useState(false);

  return (
    <DashboardLayout active="asociaciones">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-01 · RELACIONES</p>

          <h1>Asociar ocupantes</h1>

          <p>
            Relaciona propietarios e inquilinos existentes con cada
            departamento.
          </p>
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

              <select value={dept} onChange={(e) => setDept(e.target.value)}>
                {["A-101", "A-202", "B-301", "B-402"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Propietario</span>

              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {people.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Inquilino</span>

              <select
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
              >
                <option value="Ana Lucía Vargas">Ana Lucía Vargas</option>

                <option value="Diego Mauricio Salazar">
                  Diego Mauricio Salazar
                </option>

                <option value="Sin inquilino">Sin inquilino</option>
              </select>
            </label>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSaved(true)}
            >
              Guardar asociación
            </button>

            {saved && (
              <div className="alert alert-success">
                Asociación guardada correctamente.
              </div>
            )}
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

              <b>{owner}</b>

              <span>Propietario</span>
            </div>

            <div>
              <UsersIcon size={18} />

              <b>{tenant}</b>

              <span>Inquilino</span>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
