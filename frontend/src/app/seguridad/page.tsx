"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import {
  ShieldIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "../../../components/Icons";

const roles = [
  "Administrador",
  "Directorio",
  "Consulta",
  "Copropietario",
  "Inquilino",
];

const perms = [
  "Copropietarios",
  "Departamentos",
  "Documentos",
  "Finanzas",
  "Auditoría",
  "Respaldos",
];

const initial = {
  Administrador: [
    "Copropietarios",
    "Departamentos",
    "Documentos",
    "Finanzas",
    "Auditoría",
    "Respaldos",
  ],
  Directorio: ["Copropietarios", "Departamentos", "Documentos", "Finanzas"],
  Consulta: ["Copropietarios", "Departamentos", "Documentos"],
  Copropietario: ["Departamentos", "Documentos", "Finanzas"],
  Inquilino: ["Departamentos", "Documentos"],
} as Record<string, string[]>;

type RegistroAuditoria = {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string;
  tabla_afectada: string;
  registro_id: string;
  accion: "INSERT" | "UPDATE" | "DELETE";
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  fecha_hora: string;
};

const ACCION_LABEL: Record<string, string> = {
  INSERT: "creó",
  UPDATE: "modificó",
  DELETE: "eliminó",
};

const TABLA_LABEL: Record<string, string> = {
  usuario: "un usuario",
  expensa: "una expensa",
  pago_expensa: "un pago de expensa",
  rol_usuario: "un rol de usuario",
  personal: "un empleado",
  pago_personal: "un pago de personal",
  departamento: "un departamento",
  departamento_usuario: "una asignación de departamento",
  baulera: "una baulera",
  parqueo: "un parqueo",
};

function describirAccion(r: RegistroAuditoria) {
  const accion = ACCION_LABEL[r.accion] ?? r.accion.toLowerCase();
  const tabla = TABLA_LABEL[r.tabla_afectada] ?? r.tabla_afectada;
  return `${accion} ${tabla}`;
}

function formatFecha(iso: string) {
  const fecha = new Date(iso);
  return {
    dia: fecha.toLocaleDateString("es-BO"),
    hora: fecha.toLocaleTimeString("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function SeguridadPage() {
  const [role, setRole] = useState("Administrador");
  const [matrix, setMatrix] = useState(initial);
  const [q, setQ] = useState("");

  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const toggle = (p: string) => {
    setMatrix({
      ...matrix,
      [role]: matrix[role].includes(p)
        ? matrix[role].filter((x) => x !== p)
        : [...matrix[role], p],
    });
  };

  useEffect(() => {
    async function cargarAuditoria() {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("token");
      if (!token) {
        setError("No hay sesión activa.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:3001/auditoria?page=${page}&limit=20`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 403) {
          setError("No tienes permisos de administrador para ver la auditoría.");
          setRegistros([]);
          return;
        }

        if (!response.ok) {
          setError("No se pudo cargar el historial de auditoría.");
          setRegistros([]);
          return;
        }

        const data = await response.json();
        setRegistros(data.data);
        setTotalPages(data.meta.totalPages);
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }

    cargarAuditoria();
  }, [page]);

  const filtered = useMemo(() => {
    return registros.filter((r) =>
      [describirAccion(r), r.usuario_nombre]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [q, registros]);

  return (
    <DashboardLayout active="seguridad">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-09 · CONTROL</p>
          <h1>Seguridad y auditoría</h1>
          <p>
            Administra roles, permisos y trazabilidad de las operaciones del
            sistema.
          </p>
        </div>

        <div className="security-badge">
          <ShieldIcon size={18} />
          Sistema protegido
        </div>
      </div>

      <div className="security-grid">
        <section className="panel">
          <div className="panel-toolbar">
            <div>
              <h3>Roles y permisos</h3>
              <p>Los cambios de permisos quedan registrados automáticamente.</p>
            </div>
          </div>

          <div className="role-tabs">
            {roles.map((r) => (
              <button
                key={r}
                className={r === role ? "role-tab active" : "role-tab"}
                onClick={() => setRole(r)}
              >
                <UsersIcon size={16} />
                {r}
              </button>
            ))}
          </div>

          <div className="permission-list">
            {perms.map((p) => (
              <label className="permission" key={p}>
                <span>
                  <SettingsIcon size={16} />
                  {p}
                </span>
                <input
                  type="checkbox"
                  checked={matrix[role]?.includes(p) ?? false}
                  onChange={() => toggle(p)}
                />
              </label>
            ))}
          </div>

          <div className="notice">
            🔒 El acceso directo por URL también debe respetar estos permisos.
          </div>
        </section>

        <section className="panel audit-panel">
          <div className="panel-toolbar">
            <div>
              <h3>Historial de auditoría</h3>
              <p>Quién hizo cada cambio, cuándo y sobre qué.</p>
            </div>

            <div className="search-box">
              <SearchIcon size={17} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar actividad..."
              />
            </div>
          </div>

          {loading && <p className="timeline-status">Cargando historial...</p>}
          {error && <p className="timeline-status timeline-error">{error}</p>}

          {!loading && !error && (
            <>
              <div className="timeline">
                {filtered.length === 0 && (
                  <p className="timeline-status">No hay actividad registrada.</p>
                )}

                {filtered.map((r) => {
                  const { dia, hora } = formatFecha(r.fecha_hora);
                  return (
                    <div className="timeline-item" key={r.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{describirAccion(r)}</strong>
                        <p>
                          <b>{r.usuario_nombre}</b>
                        </p>
                        <small>
                          {dia} · {hora}
                        </small>

                        {r.accion === "UPDATE" && (
                          <div className="audit-cambios">
                            <p><b>Antes:</b> {JSON.stringify(r.datos_anteriores)}</p>
                            <p><b>Después:</b> {JSON.stringify(r.datos_nuevos)}</p>
                          </div>
                        )}

                        {r.accion === "INSERT" && (
                          <div className="audit-cambios">
                            <p><b>Datos:</b> {JSON.stringify(r.datos_nuevos)}</p>
                          </div>
                        )}

                        {r.accion === "DELETE" && (
                          <div className="audit-cambios">
                            <p><b>Eliminado:</b> {JSON.stringify(r.datos_anteriores)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="audit-summary">
        <div>
          <strong>100%</strong>
          <span>Acciones trazables</span>
        </div>
        <div>
          <strong>5</strong>
          <span>Roles configurables</span>
        </div>
        <div>
          <strong>24/7</strong>
          <span>Registro disponible</span>
        </div>
      </section>
    </DashboardLayout>
  );
}