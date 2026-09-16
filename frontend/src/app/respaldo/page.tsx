"use client";
import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { SettingsIcon, ShieldIcon, FileIcon } from "../../components/Icons";
export default function RespaldoPage() {
  const [enabled, setEnabled] = useState(true),
    [last, setLast] = useState("06/09/2026 · 03:00"),
    [msg, setMsg] = useState("");
  function backup() {
    setLast("06/09/2026 · 22:07");
    setMsg("Respaldo completado correctamente. La operación quedó registrada.");
  }
  return (
    <DashboardLayout active="respaldo">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-10 · CONTINUIDAD</p>
          <h1>Nube y respaldos</h1>
          <p>
            Supervisa la disponibilidad de la información y protege los datos
            del edificio.
          </p>
        </div>
        <span className="cloud-status">
          <i /> Almacenamiento en la nube activo
        </span>
      </div>
      <div className="backup-hero">
        <div className="backup-copy">
          <span className="eyebrow">PROTECCIÓN DE DATOS</span>
          <h2>Tu información, siempre disponible.</h2>
          <p>
            Los datos permanecen accesibles para usuarios autorizados desde
            computador, tablet o celular.
          </p>
          <div className="backup-actions">
            <button className="btn btn-primary" onClick={backup}>
              <ShieldIcon size={17} /> Ejecutar respaldo ahora
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setEnabled(!enabled)}
            >
              {enabled ? "Desactivar automático" : "Activar automático"}
            </button>
          </div>
        </div>
        <div className="backup-orbit">
          <div className="orbit-center">
            <SettingsIcon size={31} />
          </div>
          <div className="orbit-node n1">☁️</div>
          <div className="orbit-node n2">✓</div>
          <div className="orbit-node n3">↻</div>
        </div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="backup-grid">
        <section className="panel backup-card">
          <FileIcon size={22} />
          <h3>Último respaldo</h3>
          <strong>{last}</strong>
          <span className="status status-success">
            <span />
            Completado
          </span>
          <p>Incluye la información necesaria para recuperar el sistema.</p>
        </section>
        <section className="panel backup-card">
          <SettingsIcon size={22} />
          <h3>Frecuencia automática</h3>
          <strong>{enabled ? "Diaria · 03:00" : "Desactivada"}</strong>
          <span
            className={
              enabled ? "status status-success" : "status status-attention"
            }
          >
            <span />
            {enabled ? "Programado" : "Revisión necesaria"}
          </span>
          <p>
            El respaldo se almacena en una ubicación diferente a la información
            principal.
          </p>
        </section>
        <section className="panel backup-card">
          <ShieldIcon size={22} />
          <h3>Disponibilidad</h3>
          <strong>99.9%</strong>
          <span className="status status-success">
            <span />
            Protegida
          </span>
          <p>Acceso autenticado y disponible desde diferentes dispositivos.</p>
        </section>
      </div>
    </DashboardLayout>
  );
}
