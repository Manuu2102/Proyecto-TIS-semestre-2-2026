"use client";

import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import {
  BuildingIcon,
  ShieldIcon,
  SettingsIcon,
  CheckIcon,
} from "../../../components/Icons";

type EstadoRespaldo = "Exitoso" | "Fallido";

type Respaldo = {
  id: number;
  fecha: string;
  tipo: "Automático" | "Manual";
  tamano: string;
  estado: EstadoRespaldo;
  detalle: string;
};

// Simula lo que vendrá de /respaldos en el backend (historial de ejecuciones).
const initialRespaldos: Respaldo[] = [
  { id: 1, fecha: "24/09/2026 · 03:00", tipo: "Automático", tamano: "128 MB", estado: "Exitoso", detalle: "Respaldo completo de la base de datos" },
  { id: 2, fecha: "23/09/2026 · 03:00", tipo: "Automático", tamano: "127 MB", estado: "Exitoso", detalle: "Respaldo completo de la base de datos" },
  { id: 3, fecha: "22/09/2026 · 03:00", tipo: "Automático", tamano: "0 MB", estado: "Fallido", detalle: "Error de conexión con el almacenamiento en la nube" },
  { id: 4, fecha: "21/09/2026 · 03:00", tipo: "Automático", tamano: "126 MB", estado: "Exitoso", detalle: "Respaldo completo de la base de datos" },
];

export default function RespaldoPage() {
  const [respaldos, setRespaldos] = useState<Respaldo[]>(initialRespaldos);
  const [ejecutando, setEjecutando] = useState(false);

  const ultimo = respaldos[0];
  const exitosos = respaldos.filter((r) => r.estado === "Exitoso").length;
  const fallidos = respaldos.filter((r) => r.estado === "Fallido").length;

  // CA-01/CA-05/CA-06 de HU-57: ejecuta un respaldo y registra si salió bien o mal.
  function ejecutarRespaldoManual() {
    setEjecutando(true);

    setTimeout(() => {
      const exito = Math.random() > 0.15;

      const nuevo: Respaldo = {
        id: Date.now(),
        fecha: new Date()
          .toLocaleString("es-BO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(",", " ·"),
        tipo: "Manual",
        tamano: exito ? "129 MB" : "0 MB",
        estado: exito ? "Exitoso" : "Fallido",
        detalle: exito
          ? "Respaldo completo de la base de datos"
          : "Error de conexión con el almacenamiento en la nube",
      };

      setRespaldos((actuales) => [nuevo, ...actuales]);
      setEjecutando(false);

      alert(
        exito
          ? "Respaldo completado correctamente."
          : "El respaldo falló. Revisa el detalle en el historial."
      );
    }, 1200);
  }

  return (
    <DashboardLayout active="respaldo">
      <div className="page-header">
        <div>
          <p className="eyebrow"> INFRAESTRUCTURA</p>
          <h1>Nube y respaldos</h1>
          <p>
            Supervisa el almacenamiento en la nube y el historial de
            respaldos automáticos del sistema.
          </p>
        </div>
      </div>

      {/* HU-56: información almacenada en la nube */}
      <section className="backup-hero">
        <div className="backup-copy">
          <p className="eyebrow">HU-56 · ALMACENAMIENTO</p>
          <h2>Tu información está segura en la nube</h2>
          <p>
            Los datos del edificio se almacenan en una infraestructura
            accesible mediante Internet, disponible para los usuarios
            autorizados desde cualquier dispositivo.
          </p>

          <div className="backup-actions">
            <span className="cloud-status">
              <CheckIcon size={14} /> Conectado a la nube
            </span>

            <button
              className="btn btn-secondary"
              onClick={ejecutarRespaldoManual}
              disabled={ejecutando}
            >
              {ejecutando ? "Ejecutando respaldo..." : "Ejecutar respaldo manual"}
            </button>
          </div>
        </div>

        <div className="backup-orbit">
          <div className="orbit-center">
            <BuildingIcon size={26} />
          </div>
          <div className="orbit-node n1"><ShieldIcon size={16} /></div>
          <div className="orbit-node n2"><SettingsIcon size={16} /></div>
          <div className="orbit-node n3"><CheckIcon size={16} /></div>
        </div>
      </section>

      {/* Métricas rápidas (CA-03 de HU-57: verificar cuándo fue el último respaldo) */}
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <CheckIcon size={20} />
          </div>
          <div>
            <span>Último respaldo</span>
            <strong>{ultimo.fecha}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft">
            <ShieldIcon size={20} />
          </div>
          <div>
            <span>Respaldos exitosos</span>
            <strong>{exitosos}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon attention">
            <SettingsIcon size={20} />
          </div>
          <div>
            <span>Respaldos fallidos</span>
            <strong>{fallidos}</strong>
          </div>
        </div>
      </div>

      {/* HU-57: política de respaldos (frecuencia, ubicación, verificación) */}
      <section className="backup-grid">
        <div className="panel backup-card">
          <SettingsIcon size={22} />
          <h3>Frecuencia configurada</h3>
          <strong>Diaria · 03:00 AM</strong>
          <p>
            El sistema ejecuta un respaldo automático de la base de datos
            todos los días a esta hora, sin intervención manual.
          </p>
        </div>

        <div className="panel backup-card">
          <BuildingIcon size={22} />
          <h3>Ubicación de almacenamiento</h3>
          <strong>Separada del servidor principal</strong>
          <p>
            Los respaldos se guardan en una ubicación distinta a la de la
            base de datos activa, para reducir el riesgo de pérdida ante
            una falla.
          </p>
        </div>

        <div className="panel backup-card">
          <ShieldIcon size={22} />
          <h3>Verificación</h3>
          <strong>Automática tras cada respaldo</strong>
          <p>
            Cada respaldo se valida al finalizar. Si algo falla, queda
            registrado en el historial con el motivo del error.
          </p>
        </div>
      </section>

      {/* Historial de respaldos */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Historial de respaldos</h3>
            <p>Registro de los últimos respaldos automáticos y manuales.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Tamaño</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {respaldos.map((r) => (
                <tr key={r.id}>
                  <td>{r.fecha}</td>
                  <td>{r.tipo}</td>
                  <td>{r.tamano}</td>
                  <td>
                    <span
                      className={
                        r.estado === "Exitoso"
                          ? "status status-success"
                          : "status status-attention"
                      }
                    >
                      <span />
                      {r.estado}
                    </span>
                  </td>
                  <td>{r.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="demo-note">
        <strong>Nota:</strong> esta vista es una simulación en frontend.
        Falta conectar con el backend real (endpoint de respaldos /
        configuración de Supabase) para que el historial y el botón
        Ejecutar respaldo manual - reflejen datos reales.
      </div>
    </DashboardLayout>
  );
}