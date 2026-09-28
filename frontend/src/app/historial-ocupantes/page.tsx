"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { HomeIcon } from "../../../components/Icons";
import { api } from "../../../lib/api";

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

export default function Historial() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [deptSeleccionado, setDeptSeleccionado] = useState<number | null>(null);
  const [historial, setHistorial] = useState<Ocupacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Cargar departamentos
  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true);
        const data = await api<any>("/departamentos");
        setDepartamentos(data.departamentos || []);
        if (data.departamentos.length > 0) {
          setDeptSeleccionado(data.departamentos[0].id);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  // Cargar historial del depto seleccionado
  useEffect(() => {
    if (!deptSeleccionado) return;
    async function cargarHistorial() {
      try {
        setCargandoHistorial(true);
        const data = await api<any>(`/ocupaciones/departamento/${deptSeleccionado}`);
        setHistorial(data.historial || []);
      } catch (err: any) {
        console.error(err);
        setHistorial([]);
      } finally {
        setCargandoHistorial(false);
      }
    }
    cargarHistorial();
  }, [deptSeleccionado]);

  const deptActual = departamentos.find((d) => d.id === deptSeleccionado);

  function formatearPeriodo(o: Ocupacion) {
    const inicio = new Date(o.fecha_ocupacion).toLocaleDateString();
    if (o.fecha_fin_ocupacion) {
      const fin = new Date(o.fecha_fin_ocupacion).toLocaleDateString();
      return `${inicio} — ${fin}`;
    }
    return `Desde ${inicio}`;
  }

  if (cargando) {
    return (
      <DashboardLayout active="ocupantes">
        <div className="page-header"><h1>Cargando...</h1></div>
      </DashboardLayout>
    );
  }

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
      </div>

      <section className="panel">
        {cargandoHistorial ? (
          <div className="empty-state">Cargando historial...</div>
        ) : historial.length === 0 ? (
          <div className="empty-state">
            No existen registros de ocupantes para el departamento
            {deptActual ? ` #${deptActual.numero}` : ""}.
          </div>
        ) : (
          <div className="history-list">
            {historial.map((o, i) => (
              <div className="history-item" key={i}>
                <div className={o.estatus ? "history-marker current" : "history-marker"}>
                  <HomeIcon size={16} />
                </div>
                <div>
                  <strong>
                    {o.usuario?.nombres} {o.usuario?.apellido_paterno} {o.usuario?.apellido_materno || ""}
                  </strong>
                  <span>{o.usuario?.email}</span>
                  <p>{formatearPeriodo(o)}</p>
                </div>
                {o.estatus && (
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