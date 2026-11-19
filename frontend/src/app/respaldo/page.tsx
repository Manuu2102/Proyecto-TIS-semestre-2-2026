"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import {
  BuildingIcon,
  ShieldIcon,
  CheckIcon,
  FileIcon,
} from "../../../components/Icons";

const styles: Record<string, CSSProperties> = {
  section: {
    marginBottom: 22,
    padding: 24,
    borderRadius: 14,
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 22,
  },
  sectionDescription: {
    color: "var(--muted, #737373)",
    fontSize: 13,
    lineHeight: 1.6,
    marginTop: 6,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: 20,
    background: "var(--surface-muted, #f3f4f6)",
    color: "var(--muted, #737373)",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#9ca3af",
    marginRight: 7,
    flexShrink: 0,
  },
  description: {
    color: "var(--muted, #737373)",
    fontSize: 13,
    lineHeight: 1.65,
    marginTop: 8,
  },
  card: {
    padding: 22,
    borderRadius: 13,
    border: "1px solid var(--border, #e5e7eb)",
    background: "var(--surface, #fff)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface-muted, #f3f4f6)",
    marginBottom: 3,
    flexShrink: 0,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    minWidth: 0,
  },
  input: {
    width: "100%",
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border, #e5e7eb)",
    background: "var(--surface-muted, #f8f9fa)",
    color: "var(--muted, #737373)",
    boxSizing: "border-box",
  },
  actionRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid var(--border, #e5e7eb)",
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
    minHeight: 40,
    padding: "10px 18px",
    borderRadius: 8,
  },
  automationControl: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 18,
    padding: 18,
    marginBottom: 24,
    borderRadius: 11,
    border: "1px solid var(--border, #e5e7eb)",
    background: "var(--surface-muted, #f8f9fa)",
  },
  toggle: {
    position: "relative",
    width: 48,
    height: 27,
    border: "none",
    borderRadius: 20,
    padding: 3,
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.2s ease",
  },
  toggleKnob: {
    display: "block",
    width: 21,
    height: 21,
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s ease",
  },
};

function EstadoPendiente() {
  return (
    <span style={styles.status}>
      <span style={styles.statusDot} />
      Pendiente de integración
    </span>
  );
}

export default function RespaldoPage() {
  const [respaldosAutomaticos, setRespaldosAutomaticos] = useState(false);

  return (
    <DashboardLayout active="respaldo">
      <div className="page-header">
        <div>
          <p className="eyebrow">INFRAESTRUCTURA</p>
          <h1>Respaldo y restauración</h1>
          <p>
            Administra la protección de la base de datos, consulta las
            ejecuciones de respaldo y gestiona los procesos de restauración.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div className="metric-card">
          <div className="metric-icon">
            <CheckIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span>Último respaldo</span>
            <strong>Sin información</strong>
            <p style={styles.description}>Esperando conexión con el backend</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft">
            <ShieldIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span>Próximo respaldo</span>
            <strong>No configurado</strong>
            <p style={styles.description}>Programación pendiente</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <FileIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span>Respaldos exitosos</span>
            <strong>—</strong>
            <p style={styles.description}>Sin datos disponibles</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon attention">
            <ShieldIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span>Respaldos fallidos</span>
            <strong>—</strong>
            <p style={styles.description}>Sin datos disponibles</p>
          </div>
        </div>
      </section>

      {/* Generación manual */}
      <section className="panel" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Generación de respaldo</h3>
            <p style={styles.sectionDescription}>
              Solicita una copia de seguridad de la base de datos cuando el
              servicio esté disponible.
            </p>
          </div>
          <EstadoPendiente />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
            padding: "4px 2px",
          }}
        >
          <div style={{ flex: "1 1 250px", minWidth: 0 }}>
            <strong>Respaldo manual</strong>
            <p style={styles.description}>
              Genera una copia bajo demanda, independientemente de la
              programación automática.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            disabled
            style={styles.disabledButton}
            title="Disponible cuando se integre el servicio de respaldos"
          >
            Ejecutar respaldo
          </button>
        </div>
      </section>

      {/* Programación automática */}
      <section className="panel" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Programación automática</h3>
            <p style={styles.sectionDescription}>
              Define la frecuencia y el horario de ejecución de los respaldos.
            </p>
          </div>
          <EstadoPendiente />
        </div>

        {/* Activación y desactivación */}
        <div style={styles.automationControl}>
          <div style={{ flex: "1 1 250px", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                flexWrap: "wrap",
              }}
            >
              <strong>Respaldos automáticos</strong>
              <span
                style={{
                  ...styles.status,
                  background: respaldosAutomaticos
                    ? "rgba(22, 163, 74, 0.10)"
                    : "var(--surface, #fff)",
                  color: respaldosAutomaticos ? "#15803d" : "var(--muted, #737373)",
                }}
              >
                <span
                  style={{
                    ...styles.statusDot,
                    background: respaldosAutomaticos ? "#16a34a" : "#9ca3af",
                  }}
                />
                {respaldosAutomaticos ? "Activado" : "Desactivado"}
              </span>
            </div>

            <p style={styles.description}>
              {respaldosAutomaticos
                ? "La opción está seleccionada. La ejecución automática estará disponible cuando se integre el backend."
                : "Los respaldos programados están desactivados en esta vista. Puedes seguir utilizando los respaldos manuales cuando estén disponibles."}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={respaldosAutomaticos}
            aria-label="Activar o desactivar respaldos automáticos"
            onClick={() =>
              setRespaldosAutomaticos((estadoActual) => !estadoActual)
            }
            style={{
              ...styles.toggle,
              background: respaldosAutomaticos ? "#16a34a" : "#9ca3af",
            }}
          >
            <span
              style={{
                ...styles.toggleKnob,
                transform: respaldosAutomaticos
                  ? "translateX(21px)"
                  : "translateX(0)",
              }}
            />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
            gap: 20,
          }}
        >
          <div style={styles.field}>
            <label htmlFor="frecuencia-respaldo">Frecuencia</label>
            <select
              id="frecuencia-respaldo"
              style={styles.input}
              disabled
              defaultValue=""
            >
              <option value="">Sin configurar</option>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="personalizada">Personalizada</option>
            </select>
          </div>

          <div style={styles.field}>
            <label htmlFor="hora-respaldo">Hora de ejecución</label>
            <input
              id="hora-respaldo"
              style={styles.input}
              type="time"
              disabled
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="zona-respaldo">Zona horaria</label>
            <input
              id="zona-respaldo"
              style={styles.input}
              type="text"
              value="America/La_Paz"
              disabled
              readOnly
            />
          </div>
        </div>

        <p style={{ ...styles.description, marginTop: 18 }}>
          La activación y la configuración del horario se guardarán de forma
          persistente cuando se implemente la integración con el backend.
          Desactivar esta opción no impedirá generar respaldos manuales.
        </p>

        <div style={styles.actionRow}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            style={styles.disabledButton}
          >
            Guardar programación
          </button>
        </div>
      </section>

      {/* Seguridad y almacenamiento */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div style={styles.card}>
          <div style={styles.icon}>
            <BuildingIcon size={21} />
          </div>
          <h3>Almacenamiento</h3>
          <p style={styles.description}>
            La ubicación y el destino de las copias se mostrarán cuando el
            backend proporcione esta información.
          </p>
          <EstadoPendiente />
        </div>

        <div style={styles.card}>
          <div style={styles.icon}>
            <ShieldIcon size={21} />
          </div>
          <h3>Validación de respaldos</h3>
          <p style={styles.description}>
            Se mostrará el resultado de las comprobaciones realizadas sobre
            cada archivo generado.
          </p>
          <EstadoPendiente />
        </div>

        <div style={styles.card}>
          <div style={styles.icon}>
            <FileIcon size={21} />
          </div>
          <h3>Seguridad y auditoría</h3>
          <p style={styles.description}>
            Las operaciones de generación y restauración deberán contar con
            controles de autorización y registro de auditoría.
          </p>
          <EstadoPendiente />
        </div>
      </section>

      {/* Historial */}
      <section className="panel" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Historial de respaldos</h3>
            <p style={styles.sectionDescription}>
              Consulta las ejecuciones, sus resultados y los archivos
              disponibles.
            </p>
          </div>
          <EstadoPendiente />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th>Estado</th>
                <th>Validación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <div
                    className="empty-state"
                    style={{
                      padding: "38px 20px",
                      textAlign: "center",
                    }}
                  >
                    <p>
                      El historial estará disponible cuando se conecte el
                      servicio de respaldos.
                    </p>
                    <p style={styles.description}>
                      Todavía no se han consultado registros del backend.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Restauración */}
      <section className="panel" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Restauración de base de datos</h3>
            <p style={styles.sectionDescription}>
              Recupera la información utilizando un archivo de respaldo
              previamente generado.
            </p>
          </div>
          <EstadoPendiente />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
            gap: 20,
          }}
        >
          <div style={styles.field}>
            <label htmlFor="archivo-restauracion">Archivo de respaldo</label>
            <input
              id="archivo-restauracion"
              style={styles.input}
              type="file"
              accept=".dump,.backup,.sql"
              disabled
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="confirmacion-restauracion">
              Confirmación de restauración
            </label>
            <input
              id="confirmacion-restauracion"
              style={styles.input}
              type="text"
              placeholder="Funcionalidad no disponible"
              disabled
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            padding: 18,
            borderRadius: 10,
            background: "var(--surface-muted, #f8f9fa)",
            border: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <strong>Importante</strong>
          <p style={styles.description}>
            La restauración puede reemplazar información existente. Antes de
            habilitar esta operación se implementarán controles de autorización,
            confirmación explícita, validación del archivo y registro de
            auditoría.
          </p>
        </div>

        <div style={styles.actionRow}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled
            style={styles.disabledButton}
          >
            Restaurar base de datos
          </button>
        </div>
      </section>
    </DashboardLayout>
  );
}