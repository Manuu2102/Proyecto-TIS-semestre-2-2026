"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

function Icon({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const BuildingIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M8 19h1M12 19h1M3 21h18" />
  </Icon>
);
const EyeIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  </Icon>
);
const EyeOffIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="m3 3 18 18" />
    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.1 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8" />
  </Icon>
);
const MailIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
);
const LockIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);
const ShieldIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

type Role = "ADMINISTRADOR" | "COPROPIETARIO" | "INQUILINO" | "DIRECTORIO" | "CONSULTA";

// Prioridad si el backend algún día devuelve más de un rol por usuario.
const ROLE_PRIORITY: Role[] = ["ADMINISTRADOR", "DIRECTORIO", "COPROPIETARIO", "INQUILINO", "CONSULTA"];

function extraerRolPrincipal(roles: string[] | undefined): Role {
  if (!Array.isArray(roles) || roles.length === 0) return "CONSULTA";
  const nombres = roles.map((r) => r.toUpperCase());
  for (const prioridad of ROLE_PRIORITY) {
    if (nombres.includes(prioridad)) return prioridad;
  }
  return "CONSULTA";
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const usuario = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    if (!usuario || !password) {
      setError("Completa tu correo electronico y contraseña para continuar.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: usuario,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Usuario o contraseña incorrectos.");
        return;
      }

      const rolPrincipal = extraerRolPrincipal(data.usuario.roles);

      if (remember) localStorage.setItem("edificio_remember", "true");
      sessionStorage.setItem("sesionActiva", "true");
      sessionStorage.setItem("token", data.access_token);
      sessionStorage.setItem("rolUsuario", rolPrincipal);
      sessionStorage.setItem("nombreUsuario", data.usuario.nombre || usuario);
      // departamentoUsuario: el backend aún no lo devuelve; dashboard/page.tsx
      // usará su default "Sin unidad" hasta que /auth/login incluya ese dato.

      router.push("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles["auth-page"]}>
      <section className={styles["auth-visual"]}>
        <div className={styles["auth-visual-top"]}>
          <div className={`${styles.brand} ${styles["brand-light"]}`}>
            <span className={styles["brand-mark"]}>
              <BuildingIcon size={22} />
            </span>
            <span>
              Edificio <strong>Central</strong>
            </span>
          </div>
          <span className={styles["status-pill"]}>
            <span /> Administración inteligente
          </span>
        </div>

        <div className={styles["auth-visual-content"]}>
          <p className={styles.eyebrow}>SISTEMA INTEGRAL</p>
          <h1>
            Todo el edificio,
            <br />
            <span>en un solo lugar.</span>
          </h1>
          <p className={styles["auth-description"]}>
            Administra copropietarios, departamentos, finanzas y operaciones
            desde una experiencia clara y organizada.
          </p>
        </div>

        <div className={styles["auth-visual-footer"]}>
          <ShieldIcon size={17} />
          <span>Acceso seguro y controlado por roles</span>
        </div>
      </section>

      <section className={styles["auth-form-side"]}>
        <div className={styles["auth-form-wrap"]}>
          <div className={`${styles["mobile-brand"]} ${styles.brand}`}>
            <span className={styles["brand-mark"]}>
              <BuildingIcon size={20} />
            </span>
            <span>
              Edificio <strong>Central</strong>
            </span>
          </div>

          <div className={styles["form-heading"]}>
            <p className={styles.eyebrow}>BIENVENIDO</p>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          <form className={styles["form-stack"]} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Usuario o correo electrónico</span>
              <div className={styles["input-wrap"]}>
                <MailIcon size={18} />
                <input
                  name="email"
                  type="email"
                  placeholder="admin@edificio.com"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className={styles.field}>
              <span>Contraseña</span>
              <div className={styles["input-wrap"]}>
                <LockIcon size={18} />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles["icon-button"]}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </label>

            <div className={styles["form-options"]}>
              <label className={styles["check-label"]}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Recordarme</span>
              </label>
            </div>

            {error && <div className={`${styles.alert} ${styles["alert-error"]}`}>{error}</div>}

            <button
              className={`${styles.btn} ${styles["btn-primary"]} ${styles["btn-large"]}`}
              type="submit"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className={styles["form-note"]}>
            Sistema de administración del Edificio Central
          </p>
        </div>
      </section>
    </main>
  );
}