"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("");
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const sesionActiva = sessionStorage.getItem("sesionActiva");
    if (!sesionActiva) {
      router.replace("/login");
      return;
    }
    setNombre(sessionStorage.getItem("nombreUsuario") || "");
    setRol(sessionStorage.getItem("rolUsuario") || "");
    setVerificando(false);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("sesionActiva");
    sessionStorage.removeItem("nombreUsuario");
    sessionStorage.removeItem("rolUsuario");
    router.replace("/login");
  };

  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (verificando) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#EDEBE3]">
        <p className="text-sm text-[#5F5E5A]">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#EDEBE3]">
      <header className="w-full bg-white border-b border-[#D3D1C7] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FFE6D9] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#712B13" strokeWidth="2" className="w-4 h-4">
              <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 20v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-bold text-sm text-[#2C2C2A] hidden sm:inline">
            Edificio Central
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-8 h-8 rounded-full bg-[#FFE6D9] text-[#712B13] text-xs font-bold flex items-center justify-center">
            {iniciales || "RQ"}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-[#2C2C2A]">
              {nombre || "Cargando..."}
            </p>
            <p className="text-[11px] text-[#888780]">Rol {rol || "-"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-2 rounded-md bg-[#C13333] text-[#FAECE7]"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-[#D3D1C7] rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#EAF3DE] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3A6B1F" strokeWidth="2" className="w-5 h-5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#2C2C2A]">
              Acceso Concedido
            </h1>
          </div>
          <p className="text-sm text-[#5F5E5A] leading-relaxed">
            Sesión validada correctamente. Estás viendo únicamente las
            funcionalidades habilitadas para tu rol. Al cerrar sesión, este
            acceso queda invalidado de inmediato.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["Copropietarios", "Gestión Documental", "Finanzas"].map((modulo) => (
            <div key={modulo} className="bg-white border border-[#D3D1C7] rounded-xl p-4 opacity-60">
              <p className="text-sm font-semibold text-[#2C2C2A] mb-1">{modulo}</p>
              <p className="text-xs text-[#888780]">Disponible próximamente</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}