"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, ShieldIcon } from "../../components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const user = String(form.get("user") || "").trim();
    const password = String(form.get("password") || "");

    if (!user || !password) {
      setError("Completa tu usuario y contraseña para continuar.");
      return;
    }

    // Demo frontend: password de prueba para validar el flujo de acceso.
    if (password !== "123456") {
      setError("Usuario o Contraseña Incorrectos.");
      return;
    }
    if (remember) localStorage.setItem("edificio_remember", "true");
    router.push("/copropietarios");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual-top">
          <div className="brand brand-light">
            <span className="brand-mark"><BuildingIcon size={22} /></span>
            <span>Edificio <strong>XYZ</strong></span>
          </div>
          <span className="status-pill"><span /> Administración inteligente</span>
        </div>

        <div className="auth-visual-content">
          <p className="eyebrow">SISTEMA INTEGRAL</p>
          <h1>Todo el edificio,<br /><span>en un solo lugar.</span></h1>
          <p className="auth-description">
            Administra copropietarios, departamentos, finanzas y operaciones
            desde una experiencia clara y organizada.
          </p>
        </div>

        <div className="auth-visual-footer">
          <ShieldIcon size={17} />
          <span>Acceso seguro y controlado por roles</span>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand brand">
            <span className="brand-mark"><BuildingIcon size={20} /></span>
            <span>Edificio <strong>XYZ</strong></span>
          </div>

          <div className="form-heading">
            <p className="eyebrow">BIENVENIDO</p>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Usuario o correo electrónico</span>
              <div className="input-wrap">
                <MailIcon size={18} />
                <input name="user" type="text" placeholder="admin@edificio.xyz" autoComplete="username" />
              </div>
            </label>

            <label className="field">
              <span>Contraseña</span>
              <div className="input-wrap">
                <LockIcon size={18} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                />
                <button type="button" className="icon-button" aria-label="Mostrar contraseña"
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </label>

            <div className="form-options">
              <label className="check-label">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span>Recordarme</span>
              </label>
              <button type="button" className="text-button"></button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button className="btn btn-primary btn-large" type="submit">
              Iniciar sesión
            </button>
          </form>

          <p className="form-note">Sistema de administración del Edificio Central</p>
        </div>
      </section>
    </main>
  );
}