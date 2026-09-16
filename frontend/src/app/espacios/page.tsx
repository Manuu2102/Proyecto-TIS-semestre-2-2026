"use client";
import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { PlusIcon, BuildingIcon } from "../../components/Icons";
const initial = [
  ["P-14", "Parqueo", "A-101", "Asignado"],
  ["P-15", "Parqueo", "A-202", "Asignado"],
  ["B-08", "Baulera", "A-101", "Asignado"],
  ["B-09", "Baulera", "—", "Disponible"],
];
export default function Espacios() {
  const [items, setItems] = useState(initial);
  return (
    <DashboardLayout active="espacios">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-01 · UNIDADES</p>
          <h1>Parqueos y bauleras</h1>
          <p>
            Registra espacios con identificador único y controla su asignación.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() =>
            setItems([
              ["Nuevo-" + (items.length + 1), "Parqueo", "—", "Disponible"],
              ...items,
            ])
          }
        >
          <PlusIcon size={17} /> Registrar espacio
        </button>
      </div>
      <div className="metric-row">
        <Metric t="Espacios" n={items.length} />
        <Metric
          t="Asignados"
          n={items.filter((x) => x[3] === "Asignado").length}
        />
        <Metric
          t="Disponibles"
          n={items.filter((x) => x[3] === "Disponible").length}
        />
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Inventario de espacios</h3>
            <p>Cada espacio solo puede estar asignado a un departamento.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Tipo</th>
                <th>Departamento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={i}>
                  <td>
                    <strong>{x[0]}</strong>
                  </td>
                  <td>{x[1]}</td>
                  <td>
                    <span className="tag">{x[2]}</span>
                  </td>
                  <td>
                    <span
                      className={
                        x[3] === "Asignado"
                          ? "status status-success"
                          : "status status-attention"
                      }
                    >
                      <span />
                      {x[3]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
function Metric({ t, n }: { t: string; n: number }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <BuildingIcon size={20} />
      </div>
      <div>
        <span>{t}</span>
        <strong>{n}</strong>
      </div>
    </div>
  );
}
