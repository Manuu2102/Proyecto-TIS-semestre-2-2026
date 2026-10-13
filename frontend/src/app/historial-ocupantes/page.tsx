"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { HomeIcon } from "../../../components/Icons";

type Ocupante = {
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
  descripcion?: string;
  numero?: string | number;
  piso?: string | number;
};

type UsuarioHistorial = {
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  rol_usuario?: Array<{ rol?: { nombre_rol?: string } }>;
};

type HistorialItemAPI = {
  estatus: boolean;
  fecha_ocupacion: string;
  fecha_fin_ocupacion?: string | null;
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

// Extrae "[A-101] descripcion" → "A-101"
const parseCodigo = (desc: string) => {
  const match = desc.match(/^\[([^\]]+)\]/);
  return match ? match[1] : "";
};

// Formatea una fecha "2024-03-15" → "2024"
const anioDe = (fecha: string | null | undefined) => {
  if (!fecha) return "";
  return String(fecha).slice(0, 4);
};

// Formatea el período: "2019—2025" o "Actual · 2024—"
const formatearPeriodo = (inicio: string, fin: string | null, actual: boolean) => {
  const anioInicio = anioDe(inicio);
  const anioFin = anioDe(fin);

  if (actual) {
    if (anioFin) return `Actual · ${anioInicio}—${anioFin}`;
    return `Actual · ${anioInicio}—`;
  }
  return `${anioInicio}—${anioFin || "?"}`;
};

export default function Historial() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>([]);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string>("");
  const [historial, setHistorial] = useState<Ocupante[]>([]);
  const [cargandoDeptos, setCargandoDeptos] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [sinHistorial, setSinHistorial] = useState(false);

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

        const opts: DepartamentoOption[] = data.departamentos
          .map((d) => {
            const codigo = parseCodigo(d.descripcion ?? "");
            return {
              id: String(d.id),
              codigo: codigo || `N° ${d.numero ?? ""} · Piso ${d.piso ?? ""}`,
            };
          })
          .filter((o) => o.codigo.length > 0);

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

    const cargarHistorial = async () => {
      try {
        setCargandoHistorial(true);
        setSinHistorial(false);

        const res = await fetch(
          `${API_URL}/ocupaciones/departamento/${departamentoSeleccionado}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HistorialResponse = await res.json();

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
          const nombre = `${h.usuario?.nombres ?? ""} ${h.usuario?.apellido_paterno ?? ""} ${h.usuario?.apellido_materno ?? ""}`.trim();
          const rol = h.usuario?.rol_usuario?.[0]?.rol?.nombre_rol ?? "Ocupante";

          return {
            nombre: nombre || "Sin nombre",
            rol,
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
        console.error("Error cargando historial:", e);
        setHistorial([]);
      } finally {
        setCargandoHistorial(false);
      }
    };

    cargarHistorial();
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

        {!cargandoHistorial && sinHistorial && (
          <div className="empty-state">
            No existen registros de ocupantes para el departamento{" "}
            {codigoSeleccionado}.
          </div>
        )}

        {!cargandoHistorial && !sinHistorial && historial.length > 0 && (
          <div className="history-list">
            {historial.map((o, i) => (
              <div className="history-item" key={i}>
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