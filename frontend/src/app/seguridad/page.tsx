"use client";

import { useMemo, useState } from "react";
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

  Directorio: [
    "Copropietarios",
    "Departamentos",
    "Documentos",
    "Finanzas",
  ],

  Consulta: [
    "Copropietarios",
    "Departamentos",
    "Documentos",
  ],

  Copropietario: [
    "Departamentos",
    "Documentos",
    "Finanzas",
  ],

  Inquilino: [
    "Departamentos",
    "Documentos",
  ],
} as Record<string, string[]>;

const logs = [
  [
    "Administrador",
    "Actualizó copropietario",
    "06/09/2026",
    "21:42",
    "Copropietario #18",
  ],
  [
    "Administrador",
    "Subió documento",
    "06/09/2026",
    "20:15",
    "Acta Asamblea 2026",
  ],
  [
    "Directorio",
    "Consultó documento",
    "06/09/2026",
    "18:31",
    "Reglamento",
  ],
  [
    "Administrador",
    "Asignó rol",
    "05/09/2026",
    "16:08",
    "Usuario #24",
  ],
  [
    "Administrador",
    "Editó departamento",
    "05/09/2026",
    "11:52",
    "B-402",
  ],
];

function readRoleLogs(): string[][] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("edificio_audit_roles");
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(
      (item: {
        usuario?: string;
        accion?: string;
        fecha?: string;
        anterior?: string;
        nuevo?: string;
      }) => [
        "Administrador",
        item.accion || "Cambio de rol",
        item.fecha || "",
        "",
        `${item.usuario || "Usuario"} · ${item.anterior || ""} → ${item.nuevo || ""}`,
      ]
    );
  } catch {
    return [];
  }
}

export default function SeguridadPage() {
  const [role, setRole] = useState("Administrador");
  const [matrix, setMatrix] = useState(initial);
  const [q, setQ] = useState("");
  const [roleLogs] = useState<string[][]>(() => readRoleLogs());

  const toggle = (p: string) => {
    setMatrix({
      ...matrix,
      [role]: matrix[role].includes(p)
        ? matrix[role].filter((x) => x !== p)
        : [...matrix[role], p],
    });
  };

  const filtered = useMemo(() => {
    const allLogs = [...roleLogs, ...logs];
    return allLogs.filter((x) =>
      x.join(" ").toLowerCase().includes(q.toLowerCase())
    );
  }, [q, roleLogs]);

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

              <p>
                Los cambios de permisos quedan registrados automáticamente.
              </p>
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

              <p>
                Usuario · acción · fecha · hora · registro afectado
              </p>
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

          <div className="timeline">
            {filtered.map((l, i) => (
              <div className="timeline-item" key={i}>
                <span className="timeline-dot" />

                <div>
                  <strong>{l[1]}</strong>

                  <p>
                    <b>{l[0]}</b> · {l[4]}
                  </p>

                  <small>
                    {l[2]} · {l[3]}
                  </small>
                </div>
              </div>
            ))}
          </div>
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