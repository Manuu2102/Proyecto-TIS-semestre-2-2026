"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { HomeIcon } from "../../../components/Icons";

type Ocupante = {
  id: string;
  nombre: string;
  rol: string;
  periodo: string;
  actual: boolean;
};

type DepartamentoOption = {
  id: string;      // id real (para el endpoint)
  codigo: string;  // "A-101" para mostrar
};

type DepartamentoAPI = {
  id: string | number;
  numeroCompleto: string;
};

type UsuarioHistorial = {
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string | null;
};

type HistorialItemAPI = {
  id: string;
  estatus: boolean;
  fecha_ocupacion: string;
  fecha_fin_ocupacion?: string | null;
  rol?: string;
  usuario?: UsuarioHistorial;
};

type DepartamentosResponse = {
  departamentos: DepartamentoAPI[];
};

type HistorialResponse = {
  historial?: HistorialItemAPI[];
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

// Formatea una fecha "2024-03-15" → "15/03/2024"
const fechaDe = (fecha: string | null | undefined) => {
  if (!fecha) return "";
  const [anio, mes, dia] = String(fecha).slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
};

// Formatea el período: "15/03/2024 — 02/07/2025" o "Desde 15/03/2024"
const formatearPeriodo = (inicio: string, fin: string | null, actual: boolean) => {
  const desde = fechaDe(inicio);
  const hasta = fechaDe(fin);

  if (actual) {
    // Una ocupación activa puede tener una fecha de fin prevista (p. ej. un contrato)
    return hasta ? `Desde ${desde} · hasta ${hasta} (previsto)` : `Desde ${desde}`;
  }
  return `${desde} — ${hasta || "sin fecha de salida"}`;
};

export default function Historial() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string>("");
  const [historial, setHistorial] = useState<Ocupante[]>([]);
  const [cargandoDeptos, setCargandoDeptos] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [sinHistorial, setSinHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState("");

  // 1. Cargar todos los departamentos al montar
  useEffect(() => {
    const cargar = async () => {
      try {
        setCargandoDeptos(true);
        const res = await fetch(`${API_URL}/departamentos`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: DepartamentosResponse = await res.json();

        const opts: DepartamentoOption[] = data.departamentos.map((d) => ({
          id: String(d.id),
          codigo: d.numeroCompleto,
        }));

        setDepartamentos(opts);
        if (opts.length > 0) {
          setDepartamentoSeleccionado(opts[0].id);
        }
      } catch (e) {
        console.error("Error cargando departamentos:", e);
      } finally {
        setCargandoDeptos(false);
      }
    };
    cargar();
  }, []);

  // 2. Cargar historial cuando cambia el departamento seleccionado
  useEffect(() => {
    if (!departamentoSeleccionado) return;

    // Si se cambia de departamento antes de que llegue la respuesta, se descarta
    let vigente = true;

    const cargarHistorial = async () => {
      try {
        setCargandoHistorial(true);
        setSinHistorial(false);
        setErrorHistorial("");

        const res = await fetch(
          `${API_URL}/ocupaciones/departamento/${departamentoSeleccionado}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HistorialResponse = await res.json();
        if (!vigente) return;

        // Si no hay historial, el backend devuelve { message, historial: [] }
        const items = data.historial ?? [];

        if (items.length === 0) {
          setHistorial([]);
          setSinHistorial(true);
          return;
        }

        // Adaptar al formato del front
        const adaptados: Ocupante[] = items.map((h) => {
          const esActual = h.estatus === true;
          const nombre = `${h.usuario?.nombres ?? ""} ${h.usuario?.apellido_paterno ?? ""} ${h.usuario?.apellido_materno ?? ""}`.replace(/\s+/g, " ").trim();

          return {
            id: h.id,
            nombre: nombre || "Sin nombre",
            rol: h.rol ?? "Ocupante",
            periodo: formatearPeriodo(
              h.fecha_ocupacion,
              h.fecha_fin_ocupacion ?? null,
              esActual
            ),
            actual: esActual,
          };
        });

        setHistorial(adaptados);
      } catch (e) {
        if (!vigente) return;
        console.error("Error cargando historial:", e);
        setHistorial([]);
        setErrorHistorial("No se pudo cargar el historial. Intenta de nuevo.");
      } finally {
        if (vigente) setCargandoHistorial(false);
      }
    };

    cargarHistorial();
    return () => {
      vigente = false;
    };
  }, [departamentoSeleccionado]);

  const codigoSeleccionado = useMemo(() => {
    const d = departamentos.find((x) => x.id === departamentoSeleccionado);
    return d?.codigo ?? "";
  }, [departamentos, departamentoSeleccionado]);

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
            value={departamentoSeleccionado}
            onChange={(e) => setDepartamentoSeleccionado(e.target.value)}
            disabled={cargandoDeptos || departamentos.length === 0}
          >
            {cargandoDeptos && <option>Cargando...</option>}
            {!cargandoDeptos && departamentos.length === 0 && (
              <option>No hay departamentos</option>
            )}
            {!cargandoDeptos &&
              departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.codigo}
                </option>
              ))}
          </select>
        </label>
      </div>

      <section className="panel">
        {cargandoHistorial && (
          <div className="empty-state">Cargando historial...</div>
        )}

        {!cargandoHistorial && errorHistorial && (
          <div className="empty-state">{errorHistorial}</div>
        )}

        {!cargandoHistorial && sinHistorial && (
          <div className="empty-state">
            No existen registros de ocupantes para el departamento{" "}
            {codigoSeleccionado}.
          </div>
        )}

        {!cargandoHistorial && !sinHistorial && historial.length > 0 && (
          <div className="history-list">
            {historial.map((o) => (
              <div className="history-item" key={o.id}>
                <div
                  className={
                    o.actual ? "history-marker current" : "history-marker"
                  }
                >
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