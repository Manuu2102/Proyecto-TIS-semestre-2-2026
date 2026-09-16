"use client";
import { DashboardLayout } from "../../components/DashboardLayout";
import { WrenchIcon } from "../../components/Icons";

export default function MantenimientoPage() {
  return (
    <DashboardLayout active="mantenimiento">
      <div className="page-header">
        <div>
          <p className="eyebrow">OPERACIONES</p>
          <h1>Mantenimiento</h1>
          <p>
            Controla solicitudes, tareas y trabajos de mantenimiento del
            edificio.
          </p>
        </div>
        <button className="btn btn-primary">Registrar solicitud</button>
      </div>
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <WrenchIcon size={20} />
          </div>
          <div>
            <span>Solicitudes abiertas</span>
            <strong>8</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft">
            <WrenchIcon size={20} />
          </div>
          <div>
            <span>En progreso</span>
            <strong>3</strong>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention">
            <WrenchIcon size={20} />
          </div>
          <div>
            <span>Urgentes</span>
            <strong>1</strong>
          </div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Solicitudes de mantenimiento</h3>
            <p>Seguimiento de trabajos del edificio</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Solicitud</th>
                <th>Ubicación</th>
                <th>Responsable</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Revisión de ascensor</strong>
                  <small>Preventivo</small>
                </td>
                <td>Área común</td>
                <td>Servicio técnico</td>
                <td>
                  <span className="status status-attention">
                    <span />
                    En progreso
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Reparación de iluminación</strong>
                  <small>Correctivo</small>
                </td>
                <td>Garaje</td>
                <td>Mantenimiento</td>
                <td>
                  <span className="status status-success">
                    <span />
                    Programado
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
