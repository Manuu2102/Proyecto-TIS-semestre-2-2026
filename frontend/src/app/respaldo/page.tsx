"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import {
  BuildingIcon,
  ShieldIcon,
  CheckIcon,
  FileIcon,
} from "../../../components/Icons";
import { api, apiPatch, apiPost } from "@/lib/api";

type BackupConfig = {
  schemaVersion: 1;
  automatico: boolean;
  frecuencia: "diaria" | "semanal";
  hora: string;
  zonaHoraria: "America/La_Paz";
  actualizadoEn: string | null;
  actualizadoPor: string | null;
};

type BackupMetadata = {
  id: string;
  nombreArchivo: string;
  blobName: string;
  formato: "custom";
  esquema: "public";
  creadoEn: string;
  tamanoBytes: number;
  checksumSha256: string;
  origen: "manual" | "automatico";
  creadoPor: string | null;
  validado: boolean;
};

type StorageStatus = {
  proveedor: string;
  cuenta: string | null;
  contenedor: string | null;
  prefijoRespaldos: string;
  prefijoMetadatos: string;
  configurado: boolean;
  conectado: boolean;
  acceso: "privado" | "publico" | "desconocido";
  verificadoEn: string;
};

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
  const [configuracion, setConfiguracion] =
    useState<BackupConfig | null>(null);
  const [configuracionGuardada, setConfiguracionGuardada] =
    useState<Pick<BackupConfig, "automatico" | "frecuencia" | "hora"> | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const hayCambiosPendientes =
  configuracion !== null &&
  configuracionGuardada !== null &&
  (
    configuracion.automatico !== configuracionGuardada.automatico ||
    configuracion.frecuencia !== configuracionGuardada.frecuencia ||
    configuracion.hora !== configuracionGuardada.hora
  );
  const [almacenamiento, setAlmacenamiento] =
    useState<StorageStatus | null>(null);
  const [cargandoAlmacenamiento, setCargandoAlmacenamiento] =
    useState(true);
  const [errorAlmacenamiento, setErrorAlmacenamiento] = useState("");

  // Mensajes de configuración automática
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Mensajes de generación manual
  const [errorRespaldo, setErrorRespaldo] = useState("");
  const [mensajeRespaldo, setMensajeRespaldo] = useState("");

  const [ultimoRespaldo, setUltimoRespaldo] =
    useState<BackupMetadata | null>(null);
  const [historial, setHistorial] = useState<BackupMetadata[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const [proximaEjecucion, setProximaEjecucion] = useState<string | null>(null);
  const [cargandoProxima, setCargandoProxima] = useState(true);
  const [errorProxima, setErrorProxima] = useState("");

  const respaldosExitosos = historial.filter(
    (respaldo) => respaldo.validado
  ).length;
  const respaldosNoValidados = historial.filter(
    (respaldo) => !respaldo.validado
  ).length;

  const ultimoRespaldoValidado = historial.find(
    (respaldo) => respaldo.validado
  );

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleString("es-BO", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/La_Paz",
    });
  }

function formatearTamano(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function cargarHistorial() {
  try {
    const datos = await api<BackupMetadata[]>("/respaldos/historial");

    setHistorial(datos);
    setUltimoRespaldo(datos[0] ?? null);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "No fue posible cargar el historial de respaldos.",
    );
  } finally {
    setCargandoHistorial(false);
  }
}

async function cargarAlmacenamiento() {
  setCargandoAlmacenamiento(true);
  setErrorAlmacenamiento("");

  try {
    const datos = await api<StorageStatus>(
      "/respaldos/almacenamiento",
    );

    setAlmacenamiento(datos);
  } catch (err) {
    setErrorAlmacenamiento(
      err instanceof Error
        ? err.message
        : "No fue posible consultar el almacenamiento de Azure.",
    );
  } finally {
    setCargandoAlmacenamiento(false);
  }
}

async function cargarProximaEjecucion() {
  setCargandoProxima(true);
  setErrorProxima("");

  try {
    const datos = await api<{
      proximaEjecucion: string | null;
    }>("/respaldos/proxima-ejecucion");

    setProximaEjecucion(datos.proximaEjecucion);
  } catch (err) {
    setErrorProxima(
      err instanceof Error
        ? err.message
        : "No fue posible consultar la próxima ejecución.",
    );
  } finally {
    setCargandoProxima(false);
  }
}

async function generarRespaldoManual() {
  if (generando) return;

  setGenerando(true);
  setErrorRespaldo("");
  setMensajeRespaldo("");

  try {
    const respaldo = await apiPost<BackupMetadata>(
      "/respaldos/manual",
    );

    setUltimoRespaldo(respaldo);

    setHistorial((actual) => [
      respaldo,
      ...actual.filter((item) => item.id !== respaldo.id),
    ].slice(0, 5));

    setMensajeRespaldo(
      "El respaldo manual se generó, validó y almacenó correctamente.",
    );
  } catch (err) {
    setErrorRespaldo(
      err instanceof Error
        ? err.message
        : "No fue posible generar el respaldo.",
    );
  } finally {
    setGenerando(false);
  }
}
  
useEffect(() => {
  let activo = true;

  async function cargarConfiguracion() {
    try {
      const datos = await api<BackupConfig>(
        "/respaldos/configuracion",
      );

      if (activo) {
        setConfiguracion(datos);
        setConfiguracionGuardada({
          automatico: datos.automatico,
          frecuencia: datos.frecuencia,
          hora: datos.hora,
        });
      }
    } catch (err) {
      if (activo) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar la configuración.",
        );
      }
    } finally {
      if (activo) {
        setCargando(false);
      }
    }
  }

  const cargaInicial = window.setTimeout(() => {
    void cargarConfiguracion();
    void cargarHistorial();
    void cargarAlmacenamiento();
    void cargarProximaEjecucion();
  }, 0);

  const intervalo = window.setInterval(() => {
    void cargarHistorial();
  }, 15000);

  return () => {
    activo = false;
    window.clearTimeout(cargaInicial);
    window.clearInterval(intervalo);
  };
}, []);

async function guardarConfiguracion() {
  if (!configuracion || guardando) return;

  setGuardando(true);
  setError("");
  setMensaje("");

  try {
    const actualizada = await apiPatch<BackupConfig>(
      "/respaldos/configuracion",
      {
        automatico: configuracion.automatico,
        frecuencia: configuracion.frecuencia,
        hora: configuracion.hora,
      },
    );

    setConfiguracion(actualizada);
    setConfiguracionGuardada({
      automatico: actualizada.automatico,
      frecuencia: actualizada.frecuencia,
      hora: actualizada.hora,
   });
   setMensaje("La configuración se guardó correctamente.");
   await cargarProximaEjecucion();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "No fue posible guardar la configuración.",
    );
  } finally {
    setGuardando(false);
  }
}

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
            <strong>
              {ultimoRespaldo
                ? formatearFecha(ultimoRespaldo.creadoEn)
                : cargandoHistorial
                  ? "Consultando..."
                  : "Sin respaldos"}
            </strong>

             <p style={styles.description}>
               {ultimoRespaldo
                 ? `${formatearTamano(ultimoRespaldo.tamanoBytes)} · ${
                     ultimoRespaldo.origen === "manual" ? "Manual" : "Automático"
                    }`
                 : "No existen respaldos registrados"}
             </p>
          </div>
        </div>

        <div className="metric-card">
  <div className="metric-icon soft">
    <ShieldIcon size={20} />
  </div>

  <div style={{ minWidth: 0 }}>
    <span>Próximo respaldo</span>

    <strong>
      {cargandoProxima
        ? "Consultando..."
        : errorProxima
          ? "No disponible"
          : proximaEjecucion
            ? formatearFecha(proximaEjecucion)
            : "No configurado"}
    </strong>

    <p style={styles.description}>
      {cargandoProxima
        ? "Consultando programación..."
        : errorProxima
          ? "No se pudo consultar la programación"
          : proximaEjecucion
            ? "Próxima ejecución programada"
            : "Respaldos automáticos desactivados"}
    </p>
  </div>
</div>

        <div className="metric-card">
          <div className="metric-icon">
            <FileIcon size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span>Respaldos exitosos</span>

            <strong>
              {cargandoHistorial ? "..." : respaldosExitosos}
            </strong>

            <p style={styles.description}>
              {cargandoHistorial
                ? "Consultando historial..."
                : `${respaldosExitosos} respaldos validados conservados`}
            </p>
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
          <span style={styles.status}>
            <span style={styles.statusDot} />
            Disponible
          </span>
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
            onClick={generarRespaldoManual}
            disabled={generando || cargando}
            style={
              generando || cargando
                ? styles.disabledButton
                : undefined
            }
          >
            {generando ? "Generando respaldo..." : "Ejecutar respaldo"}
          </button>
        </div>

        {errorRespaldo && (
          <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>
            {errorRespaldo}
          </p>
        )}

        {mensajeRespaldo && (
          <p role="status" style={{ color: "#16a34a", marginTop: 16 }}>
            {mensajeRespaldo}
          </p>
        )}
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

  <span
    style={{
      ...styles.status,
      color: configuracion?.automatico ? "#15803d" : "var(--muted, #737373)",
      background: configuracion?.automatico
        ? "rgba(22, 163, 74, 0.10)"
        : "var(--surface-muted, #f3f4f6)",
    }}
  >
    <span
      style={{
        ...styles.statusDot,
        background: configuracion?.automatico ? "#16a34a" : "#9ca3af",
      }}
    />
    {cargando
      ? "Consultando estado..."
      : configuracion?.automatico
        ? "Automatización activa"
        : "Automatización desactivada"}
  </span>
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
                  background: (configuracion?.automatico ?? false)
                    ? "rgba(22, 163, 74, 0.10)"
                    : "var(--surface, #fff)",
                  color: (configuracion?.automatico ?? false) ? "#15803d" : "var(--muted, #737373)",
                }}
              >
                <span
                  style={{
                    ...styles.statusDot,
                    background: (configuracion?.automatico ?? false) ? "#16a34a" : "#9ca3af",
                  }}
                />
                {(configuracion?.automatico ?? false) ? "Activado" : "Desactivado"}
              </span>
            </div>

            <p style={styles.description}>
              {(configuracion?.automatico ?? false)
                ? "Los respaldos automáticos están habilitados y se ejecutarán según la programación guardada."
                : "Los respaldos programados están desactivados en esta vista. Puedes seguir utilizando los respaldos manuales cuando estén disponibles."}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={(configuracion?.automatico ?? false)}
            aria-label="Activar o desactivar respaldos automáticos"
            disabled={cargando || !configuracion || guardando}
            onClick={() =>
              setConfiguracion((actual) =>
                actual ? { ...actual, automatico: !actual.automatico } : actual
              )
            }
            style={{
              ...styles.toggle,
              background: (configuracion?.automatico ?? false) ? "#16a34a" : "#9ca3af",
            }}
          >
            <span
              style={{
                ...styles.toggleKnob,
                background: (configuracion?.automatico ?? false) ? "#fff" : "#fff",
                transform: (configuracion?.automatico ?? false)
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
              value={configuracion?.frecuencia ?? "diaria"}
              disabled={cargando || !configuracion || guardando}
              onChange={(e) =>
                setConfiguracion((actual) =>
                  actual
                    ? {
                        ...actual,
                        frecuencia: e.target.value as "diaria" | "semanal",
                      }
                    : actual
                )
              }
            >
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>

          <div style={styles.field}>
            <label htmlFor="hora-respaldo">Hora de ejecución</label>
            <input
              id="hora-respaldo"
              style={styles.input}
              type="time"
              value={configuracion?.hora ?? ""}
              disabled={cargando || !configuracion || guardando}
              onChange={(e) =>
                setConfiguracion((actual) =>
                  actual
                    ? { ...actual, hora: e.target.value }
                    : actual
               )
              }
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
          La configuración se guarda de forma persistente en el backend.
          Los respaldos automáticos solo se ejecutarán cuando esta opción
          esté activada.
        </p>

      {error && (
        <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>
          {error}
        </p>
      )}

      {mensaje && (
        <p role="status" style={{ color: "#16a34a", marginTop: 16 }}>
          {mensaje}
        </p>
     )}

        <div style={styles.actionRow}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={guardarConfiguracion}
            disabled={
              cargando ||
              guardando ||
              !configuracion ||
              !hayCambiosPendientes
            }
            style={
              cargando || guardando || !configuracion || !hayCambiosPendientes
                ? styles.disabledButton
                : undefined
            }
          >
            {guardando ? "Guardando..." : "Guardar programación"}
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
            <ShieldIcon size={21} />
          </div>

          <h3>Validación de respaldos</h3>

          {cargandoHistorial ? (
            <>
              <p style={styles.description}>
                Consultando los resultados de validación...
              </p>
              <span style={styles.status}>Verificando</span>
            </>
          ) : (
            <>
              <span
                style={{
                  ...styles.status,
                  color: respaldosNoValidados === 0 ? "#15803d" : "#b45309",
                  background:
                    respaldosNoValidados === 0
                      ? "rgba(22, 163, 74, 0.10)"
                      : "rgba(245, 158, 11, 0.10)",
                }}
              >
                <span
                  style={{
                    ...styles.statusDot,
                    background: respaldosNoValidados === 0 ? "#16a34a" : "#d97706",
                  }}
                />
                {respaldosNoValidados === 0
                  ? "Sin respaldos pendientes"
                  : `${respaldosNoValidados} sin validar`}
              </span>

              <div style={{ width: "100%" }}>
                <p style={styles.description}>
                  <strong>Respaldos validados:</strong> {respaldosExitosos}
                </p>

                <p style={styles.description}>
                  <strong>Respaldos no validados:</strong> {respaldosNoValidados}
                </p>

                <p style={styles.description}>
                  <strong>Última validación registrada:</strong>{" "}
                  {ultimoRespaldoValidado
                    ? formatearFecha(ultimoRespaldoValidado.creadoEn)
                    : "Sin registros"}
                </p>

                <p style={styles.description}>
                  Los archivos se comprueban mediante pg_restore --list,
                  verificando su estructura y que contengan entradas.
                </p>
              </div>
            </>
          )}
        </div>

        <div style={styles.card}>
  <div style={styles.icon}>
    <ShieldIcon size={21} />
  </div>

  <h3>Validación de respaldos</h3>

  {cargandoHistorial ? (
    <span style={styles.status}>Consultando resultados...</span>
  ) : (
    <>
      <span
        style={{
          ...styles.status,
          color: respaldosNoValidados === 0 ? "#15803d" : "#b45309",
          background:
            respaldosNoValidados === 0
              ? "rgba(22, 163, 74, 0.10)"
              : "rgba(245, 158, 11, 0.10)",
        }}
      >
        <span
          style={{
            ...styles.statusDot,
            background: respaldosNoValidados === 0 ? "#16a34a" : "#d97706",
          }}
        />
        {respaldosNoValidados === 0
          ? "Respaldos validados"
          : `${respaldosNoValidados} sin validar`}
      </span>

      <div style={{ width: "100%" }}>
        <p style={styles.description}>
          <strong>Validados:</strong> {respaldosExitosos}
        </p>

        <p style={styles.description}>
          <strong>No validados:</strong> {respaldosNoValidados}
        </p>

        <p style={styles.description}>
          <strong>Último respaldo validado:</strong>{" "}
          {ultimoRespaldoValidado
            ? formatearFecha(ultimoRespaldoValidado.creadoEn)
            : "Sin registros"}
        </p>

        <p style={styles.description}>
          Validación estructural mediante pg_restore --list.
        </p>
      </div>
    </>
  )}
</div>

        <div style={styles.card}>
          <div style={styles.icon}>
            <FileIcon size={21} />
          </div>

          <h3>Seguridad y auditoría</h3>

          <span
            style={{
              ...styles.status,
              color: "#15803d",
              background: "rgba(22, 163, 74, 0.10)",
            }}
          >
            <span
              style={{
                ...styles.statusDot,
                background: "#16a34a",
              }}
            />
          Control de acceso activo
        </span>

        <div style={{ width: "100%" }}>
          <p style={styles.description}>
            <strong>Autenticación:</strong> JWT
          </p>

          <p style={styles.description}>
            <strong>Autorización:</strong> rol ADMINISTRADOR
          </p>

          <p style={styles.description}>
            <strong>Protección:</strong> endpoints restringidos mediante
            JwtAuthGuard y RolesGuard.
          </p>

          <p style={styles.description}>
            <strong>Registro de auditoría:</strong> pendiente de implementación.
          </p>
        </div>

        <span style={styles.status}>
          Auditoría pendiente
        </span>
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
          <span style={styles.status}>
            <span style={styles.statusDot} />
            {historial.length} respaldos conservados
          </span>
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
              {cargandoHistorial ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30 }}>
                    Consultando historial...
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: "38px 20px", textAlign: "center" }}>
                      <p>No hay respaldos registrados.</p>
                      <p style={styles.description}>
                        Cuando se genere el primer respaldo, aparecerá aquí.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                historial.map((respaldo) => (
                  <tr key={respaldo.id}>
                    <td>{formatearFecha(respaldo.creadoEn)}</td>
                    <td>
                      {respaldo.origen === "manual" ? "Manual" : "Automático"}
                    </td>
                    <td style={{ wordBreak: "break-word" }}>
                      {respaldo.nombreArchivo}
                    </td>
                    <td>{formatearTamano(respaldo.tamanoBytes)}</td>
                    <td>
                      <span style={{ ...styles.status, color: "#15803d" }}>
                        Exitoso
                      </span>
                    </td>
                    <td>
                      {respaldo.validado ? "Validado" : "No validado"}
                    </td>
                    <td>—</td>
                  </tr>
                ))
             )}
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