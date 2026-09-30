"use client";
import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { HomeIcon } from "../../../components/Icons";

type Ocupante = { nombre: string; rol: string; periodo: string; actual: boolean };

// Mismos departamentos que ya usa "asociaciones" para mantener consistencia.
const data: Record<string, Ocupante[]> = {
  "A-101": [
    { nombre: "María Fernanda Rojas", rol: "Propietaria", periodo: "Actual · 2026", actual: true },
    { nombre: "Ana Lucía Vargas", rol: "Inquilina", periodo: "Actual · 2026", actual: true },
    { nombre: "Luis Alberto Rojas", rol: "Propietario anterior", periodo: "2019—2025", actual: false },
    { nombre: "Carla Méndez", rol: "Inquilina anterior", periodo: "2017—2019", actual: false },
  ],
  "A-202": [
    { nombre: "Carlos Andrés Pérez", rol: "Propietario", periodo: "Actual · 2025—", actual: true },
    { nombre: "Diego Salazar", rol: "Inquilino anterior", periodo: "2022—2025", actual: false },
  ],
  "B-301": [
    { nombre: "Sofía Valentina Cruz", rol: "Propietaria", periodo: "Actual · 2026", actual: true },
    { nombre: "Diego Mauricio Salazar", rol: "Inquilino", periodo: "Actual · 2026", actual: true },
  ],
  "B-402": [],
};

const DEPARTAMENTOS = Object.keys(data);

export default function Historial() {
  const [d, setD] = useState(DEPARTAMENTOS[0]);
  const historial = data[d] ?? [];

  return (
    <DashboardLayout active="ocupantes">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-01 · TRAZABILIDAD</p>
          <h1>Historial de ocupantes</h1>
          <p>Consulta quién ocupó cada departamento y durante qué período.</p>
        </div>
      </div>

      <div className="history-selector">
        <label className="field">
          <span>Seleccionar departamento</span>
          <select value={d} onChange={(e) => setD(e.target.value)}>
            {DEPARTAMENTOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="panel">
        {historial.length === 0 ? (
          <div className="empty-state">
            No existen registros de ocupantes para el departamento {d}.
          </div>
        ) : (
          <div className="history-list">
            {historial.map((o, i) => (
              <div className="history-item" key={i}>
                <div className={o.actual ? "history-marker current" : "history-marker"}>
                  <HomeIcon size={16} />
                </div>
                <div>
                  <strong>{o.nombre}</strong>
                  <span>{o.rol}</span>
                  <p>{o.periodo}</p>
                </div>
                {o.actual && (
                  <span className="status status-success">
                    <span />
                    Actual
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}