"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuario || !password) {
      setError("Completa usuario y contraseña.");
      return;
    }

    if (usuario !== "admin@edificio.com" || password !== "12345678") {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    setError("");
    sessionStorage.setItem("sesionActiva", "true");
    sessionStorage.setItem("nombreUsuario", "Rodrigo Quispe");
    sessionStorage.setItem("rolUsuario", "Administrador");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EDEBE3] px-4 py-10">
      <div className="w-full max-w-[900px] flex flex-col sm:flex-row rounded-2xl overflow-hidden border border-[#D3D1C7] shadow-lg">
        <div className="w-full sm:w-[42%] bg-[#C13333] p-8 sm:p-10 flex flex-row sm:flex-col justify-between items-center sm:items-start text-[#FAECE7] gap-4 sm:gap-0">
          <div className="flex flex-col items-center sm:items-start sm:flex-1">
            <div className="w-12 h-12 rounded-xl bg-[#FFE6D9] flex items-center justify-center mb-0 sm:mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="#712B13" strokeWidth="2" className="w-6 h-6">
                <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 20v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="hidden sm:block text-xl font-bold mt-4 mb-2">
              Edificio Central
            </h1>
            <p className="hidden sm:block text-sm leading-relaxed text-[#F0997B]">
              Panel administrativo para la gestión de copropietarios,
              expensas y personal.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:mt-auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F0997B" strokeWidth="2" className="w-4 h-4">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span className="text-xs text-[#F0997B]">Conexión segura</span>
          </div>
        </div>

        <div className="flex-1 bg-[#F5F1EA] p-6 sm:p-9">
          <h2 className="text-lg font-bold text-[#2C2C2A] mb-1">
            Iniciar sesión
          </h2>
          <p className="text-sm text-[#5F5E5A] mb-6">
            Ingresa tus credenciales de administrador.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="text-xs font-semibold text-[#2C2C2A] block mb-1">
              Usuario o correo
            </label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="admin@edificio.com"
              className="w-full h-10 rounded-md px-3 mb-4 bg-white border border-[#D3D1C7] text-sm font-semibold text-[#2C2C2A] outline-none focus:border-[#C13333]"
            />

            <label className="text-xs font-semibold text-[#2C2C2A] block mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 rounded-md px-3 mb-2 bg-white border border-[#D3D1C7] text-sm font-semibold text-[#2C2C2A] outline-none focus:border-[#C13333]"
            />

            {error && <p className="text-xs text-[#A32D2D] mb-2">{error}</p>}

            <label className="flex items-center gap-2 text-xs text-[#5F5E5A] mt-3 mb-5">
              <input type="checkbox" className="w-4 h-4" />
              Recordarme
            </label>

            <button
              type="submit"
              className="w-full h-11 rounded-md bg-[#C13333] text-[#FAECE7] font-bold"
            >
              Ingresar
            </button>
          </form>

          <div className="border-t border-[#D3D1C7] mt-6 pt-4">
            <p className="text-xs text-[#888780] mb-2">
              Rol asignado tras verificación
            </p>
            <div className="mb-4">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#FFE6D9] text-[#712B13]">
                Administrador
              </span>
            </div>

            <div className="flex items-start gap-2 bg-white/60 rounded-md p-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" strokeWidth="2" className="w-4 h-4 mt-0.5 shrink-0">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <p className="text-xs text-[#5F5E5A]">
                Rutas como /dashboard permanecen bloqueadas hasta validar la
                sesión.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}