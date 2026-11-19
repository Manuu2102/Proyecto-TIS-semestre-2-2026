"use client";
import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { EyeIcon, EyeOffIcon } from "../../../components/Icons";
import { apiPost } from "../../../lib/api";

type RespuestaCodigo = {
  message: string;
  correo: string;
  vence_en_minutos: number;
  reenviar_en_segundos: number;
};

// BACKEND: POST /auth/cambiar-contrasena/codigo { actual } → envía un código al correo
const solicitarCodigoApi = (actual: string) =>
  apiPost<RespuestaCodigo>("/auth/cambiar-contrasena/codigo", { actual });

// BACKEND: POST /auth/cambiar-contrasena { codigo, nueva }
const cambiarContrasenaApi = (codigo: string, nueva: string) =>
  apiPost<{ message: string }>("/auth/cambiar-contrasena", { codigo, nueva });

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

// Cambio de contraseña del copropietario en dos pasos:
// 1) contraseña actual + nueva → se envía un código al correo
// 2) se escribe el código → se guarda la nueva contraseña
export default function MiContrasenaPage() {
  const [paso, setPaso] = useState<"datos" | "codigo">("datos");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [codigo, setCodigo] = useState("");
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState("");
  const [reenviarEn, setReenviarEn] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Cuenta regresiva para poder pedir otro código
  useEffect(() => {
    if (reenviarEn <= 0) return;
    const t = setTimeout(() => setReenviarEn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenviarEn]);

  // Los errores de cada campo se muestran después del primer intento
  const errores = {
    actual: actual === "" ? "Escribe tu contraseña actual." : "",
    nueva:
      nueva.length < MINIMO
        ? `Debe tener al menos ${MINIMO} caracteres.`
        : nueva.length > 72
          ? "No puede tener más de 72 caracteres."
          : nueva === actual
            ? "Debe ser distinta de la actual."
            : "",
    confirmar: confirmar !== nueva ? "Las contraseñas no coinciden." : "",
    codigo: /^\d{6}$/.test(codigo) ? "" : "Escribe los 6 dígitos del código.",
  };
  const datosValidos = !errores.actual && !errores.nueva && !errores.confirmar;

  async function pedirCodigo() {
    setCargando(true);
    setError("");
    try {
      const r = await solicitarCodigoApi(actual);
      setCorreo(r.correo);
      setAviso(r.message);
      setReenviarEn(r.reenviar_en_segundos ?? 60);
      setCodigo("");
      setEnviado(false);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarDatos(e: FormEvent) {
    e.preventDefault();
    setEnviado(true);
    setExito("");
    if (!datosValidos || cargando) return;
    await pedirCodigo();
  }

  async function confirmarCodigo(e: FormEvent) {
    e.preventDefault();
    setEnviado(true);
    setError("");
    if (errores.codigo || cargando) return;
    setCargando(true);
    try {
      const r = await cambiarContrasenaApi(codigo, nueva);
      setExito(r.message || "Contraseña actualizada correctamente.");
      setActual("");
      setNueva("");
      setConfirmar("");
      setCodigo("");
      setAviso("");
      setEnviado(false);
      setPaso("datos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  function volver() {
    setPaso("datos");
    setCodigo("");
    setError("");
    setAviso("");
    setEnviado(false);
  }

  return (
    <DashboardLayout active="mi-contrasena">
      <div className="page-header">
        <div>
          <h1>Cambiar contraseña</h1>
          <p>
            {paso === "datos"
              ? "Te enviaremos un código a tu correo para confirmar que eres tú."
              : "Revisa tu correo y escribe el código que te enviamos."}
          </p>
        </div>
      </div>

      <section className="panel" style={{ maxWidth: 520 }}>
        {paso === "datos" ? (
          <form onSubmit={enviarDatos} className="modal-form" noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {exito && <div className="alert alert-success">{exito}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <CampoContrasena
              etiqueta="Contraseña actual"
              valor={actual}
              onChange={setActual}
              error={enviado ? errores.actual : undefined}
              autoComplete="current-password"
              disabled={cargando}
            />
            <CampoContrasena
              etiqueta="Nueva contraseña"
              valor={nueva}
              onChange={setNueva}
              error={enviado ? errores.nueva : undefined}
              autoComplete="new-password"
              disabled={cargando}
            />
            <CampoContrasena
              etiqueta="Repite la nueva contraseña"
              valor={confirmar}
              onChange={setConfirmar}
              error={enviado ? errores.confirmar : undefined}
              autoComplete="new-password"
              disabled={cargando}
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={cargando}>
                {cargando ? "Enviando código…" : "Enviar código"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="modal-form" noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {aviso && <div className="alert alert-info">{aviso}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <label className={`field${enviado && errores.codigo ? " has-error" : ""}`}>
              <span>Código de verificación</span>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                autoFocus
                disabled={cargando}
                style={{ fontSize: 22, letterSpacing: 10, textAlign: "center", fontWeight: 700 }}
              />
              {enviado && errores.codigo && <span className="field-error">{errores.codigo}</span>}
              <small style={{ color: "#9a918b", fontWeight: 400 }}>
                Enviado a {correo}. Si no lo ves, revisa la carpeta de spam.
              </small>
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={pedirCodigo}
                disabled={cargando || reenviarEn > 0}
              >
                {reenviarEn > 0 ? `Reenviar código (${reenviarEn} s)` : "Reenviar código"}
              </button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={volver} disabled={cargando}>
                  Volver
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando ? "Guardando…" : "Cambiar contraseña"}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </DashboardLayout>
  );
}
