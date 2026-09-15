"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const sesionActiva = sessionStorage.getItem("sesionActiva");

    if (!sesionActiva) {
      router.replace("/login");
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("sesionActiva");
    sessionStorage.removeItem("nombreUsuario");
    sessionStorage.removeItem("rolUsuario");

    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-white">
      <h1 className="hidden sm:block text-xl font-bold mt-4 mb-2 text-gray-500">
        hola admin
      </h1>
      <button
        onClick={handleLogout}
        className="m-4 px-4 py-2 rounded-md bg-red-600 text-white text-sm"
      >
        Cerrar sesión
      </button>
    </div>
  );
}