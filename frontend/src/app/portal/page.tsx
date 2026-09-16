"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * El portal antiguo provocaba un error de compilación por JSX mal cerrado.
 * La navegación oficial del sistema ahora es /dashboard para TODOS los roles.
 * Conservamos /portal como ruta compatible para enlaces antiguos y la
 * redirigimos de forma segura al dashboard después de validar la sesión
 * (misma sesión que crea app/login/page.tsx en sessionStorage).
 */
export default function PortalRedirect() {
  const router = useRouter();

  useEffect(() => {
    const activa = sessionStorage.getItem("sesionActiva");

    if (!activa) {
      router.replace("/login");
      return;
    }

    router.replace("/dashboard");
  }, [router]);

  return <div className="auth-loading">Cargando tu panel…</div>;
}
