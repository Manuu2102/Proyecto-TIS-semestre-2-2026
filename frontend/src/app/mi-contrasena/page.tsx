"use client";
import { FormEvent, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EyeIcon, EyeOffIcon } from "../../../components/Icons";
import { apiPost } from "../../../lib/api";

// BACKEND: POST /auth/cambiar-contrasena { actual, nueva }
const cambiarContrasenaApi = (actual: string, nueva: string) =>
  apiPost<{ message: string }>("/auth/cambiar-contrasena", { actual, nueva });

const MINIMO = 6; // mismo mínimo que el login

function CampoContrasena({
  etiqueta,
  valor,
  onChange,
  error,
  autoComplete,
  disabled,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={`field${error ? " has-error" : ""}`}>
      <span>{etiqueta}</span>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: 0, color: "#8A817B", cursor: "pointer", padding: 6, display: "grid",
          }}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// Cambio de contraseña del copropietario
export default function MiContrasenaPage() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Los errores de cada campo se muestran después del primer intento
  const errores = {
    actual: actual === "" ? "Escribe tu contraseña actual." : "",
    nueva:
      nueva.length < MINIMO
        ? `Debe tener al menos ${MINIMO} caracteres.`
        : nueva === actual
          ? "Debe ser distinta de la actual."
          : "",
    confirmar: confirmar !== nueva ? "Las contraseñas no coinciden." : "",
  };
  const valido = !errores.actual && !errores.nueva && !errores.confirmar;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviado(true);
    setError("");
    setExito("");
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      const r = await cambiarContrasenaApi(actual, nueva);
      setExito(r.message || "Contraseña actualizada correctamente.");
      setActual("");
      setNueva("");
      setConfirmar("");
      setEnviado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <DashboardLayout active="mi-contrasena">
      <div className="page-header">
        <div>
          <h1>Cambiar contraseña</h1>
          <p>La próxima vez que inicies sesión usa tu nueva contraseña.</p>
        </div>
      </div>

      <section className="panel" style={{ maxWidth: 520 }}>
        <form onSubmit={guardar} className="modal-form" noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {exito && <div className="alert alert-success">{exito}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <CampoContrasena
            etiqueta="Contraseña actual"
            valor={actual}
            onChange={setActual}
            error={enviado ? errores.actual : undefined}
            autoComplete="current-password"
            disabled={guardando}
          />
          <CampoContrasena
            etiqueta="Nueva contraseña"
            valor={nueva}
            onChange={setNueva}
            error={enviado ? errores.nueva : undefined}
            autoComplete="new-password"
            disabled={guardando}
          />
          <CampoContrasena
            etiqueta="Repite la nueva contraseña"
            valor={confirmar}
            onChange={setConfirmar}
            error={enviado ? errores.confirmar : undefined}
            autoComplete="new-password"
            disabled={guardando}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? "Guardando…" : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </section>
    </DashboardLayout>
  );
}
