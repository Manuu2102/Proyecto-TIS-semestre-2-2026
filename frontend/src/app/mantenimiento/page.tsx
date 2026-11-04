"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { api, apiDelete, apiPost } from "../../../lib/api";

type EstadoReloj = {
  horaSimulada: string;
  horaReal: string;
  desfaseMinutos: number;
  instanteSimuladoMs: number;
  revision?: { actualizadas: number };
};

// Atajos para adelantar la hora interna
const ATAJOS = ["1h", "1d", "7d", "30d"];

// "03/11/2026 23:45:10" en hora de La Paz
const formatoLaPaz = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// Si el backend responde 404, el reloj simulado está apagado
function textoError(e: unknown) {
  const texto = e instanceof Error ? e.message : "Error";
  return /not found|404/i.test(texto)
    ? "El reloj simulado está desactivado. Ponga RELOJ_SIMULADO=true en el .env del backend y reinícielo."
    : texto;
}

export default function MantenimientoPage() {
  const [reloj, setReloj] = useState<EstadoReloj | null>(null);
  const [fecha, setFecha] = useState("");
  const [avanzar, setAvanzar] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  // Reloj local: avanza cada segundo; la hora interna = ahora local + diferencia con el backend
  const [ahoraLocal, setAhoraLocal] = useState(() => Date.now());
  const [diferenciaMs, setDiferenciaMs] = useState(0);
  const [borrando, setBorrando] = useState(false);
  const [mensajeBorrado, setMensajeBorrado] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  // Borra deudas, pagos, extras y movimientos de fondos (/dev/expensas/datos)
  async function borrarDatos() {
    if (
      !window.confirm(
        "Se borrarán TODAS las deudas, pagos, extras y movimientos de fondos de expensas. Esto no se puede deshacer. ¿Continuar?"
      )
    ) {
      return;
    }
    setBorrando(true);
    setMensajeBorrado(null);
    try {
      const r = await api<Record<string, number>>("/dev/expensas/datos", {
        method: "DELETE",
        body: JSON.stringify({ confirmar: "BORRAR" }),
      });
      setMensajeBorrado({
        tipo: "success",
        texto: `Datos borrados: ${r.pago_expensa} deudas, ${r.factura_pago_expensa} pagos, ${r.pago_expensa_extra} extras y ${r.movimiento_fondo} movimientos de fondos.`,
      });
    } catch (e) {
      setMensajeBorrado({ tipo: "error", texto: textoError(e) });
    } finally {
      setBorrando(false);
    }
  }

  function recibir(r: EstadoReloj) {
    setReloj(r);
    setDiferenciaMs(Number.isFinite(r.instanteSimuladoMs) ? r.instanteSimuladoMs - Date.now() : 0);
  }

  useEffect(() => {
    const id = setInterval(() => setAhoraLocal(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reloj de pruebas del backend (/dev/reloj). Si RELOJ_SIMULADO no está activo responde 404.
  async function ejecutar(accion: () => Promise<EstadoReloj>, exito?: string) {
    setCargando(true);
    setMensaje(null);
    try {
      const r = await accion();
      recibir(r);
      if (exito) {
        const extra = r.revision ? ` Moras revisadas: ${r.revision.actualizadas} deudas actualizadas.` : "";
        setMensaje({ tipo: "success", texto: exito + extra });
      }
    } catch (e) {
      setMensaje({ tipo: "error", texto: textoError(e) });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    api<EstadoReloj>("/dev/reloj")
      .then(recibir)
      .catch((e) => setMensaje({ tipo: "error", texto: textoError(e) }));
  }, []);

  return (
    <DashboardLayout active="mantenimiento">
      <div className="page-header">
        <div>
          <p className="eyebrow">OPERACIONES</p>
          <h1>Ajustes</h1>
          <p>Herramientas de mantenimiento y pruebas del sistema.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Reloj interno del sistema (pruebas)</h3>
            <p>Cambia la fecha y hora que usan las expensas y la revisión de moras. Solo para pruebas.</p>
          </div>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {mensaje && <div className={`alert alert-${mensaje.tipo}`}>{mensaje.texto}</div>}

          {reloj && (
            <div className="form-grid">
              <div className="field">
                Hora interna (La Paz)
                <strong style={{ fontSize: 20 }}>{formatoLaPaz.format(ahoraLocal + diferenciaMs)}</strong>
              </div>
              <div className="field">
                Hora real (La Paz)
                <strong style={{ fontSize: 20 }}>{formatoLaPaz.format(ahoraLocal)}</strong>
                {reloj.desfaseMinutos !== 0 && (
                  <small>Desfase: {reloj.desfaseMinutos} minutos</small>
                )}
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              Fijar fecha y hora
              <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <button
                className="btn btn-primary"
                disabled={cargando || !fecha}
                onClick={() => ejecutar(() => apiPost<EstadoReloj>("/dev/reloj", { fecha }), "Hora fijada.")}
              >
                Fijar hora
              </button>
            </div>

            <div className="field">
              Adelantar (ej. 3d, 2h, 30m; negativo para atrasar)
              <input value={avanzar} placeholder="3d" onChange={(e) => setAvanzar(e.target.value)} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  disabled={cargando || !avanzar.trim()}
                  onClick={() =>
                    ejecutar(() => apiPost<EstadoReloj>("/dev/reloj", { avanzar: avanzar.trim() }), "Hora adelantada.")
                  }
                >
                  Adelantar
                </button>
                {ATAJOS.map((a) => (
                  <button
                    key={a}
                    className="btn btn-secondary"
                    disabled={cargando}
                    onClick={() => ejecutar(() => apiPost<EstadoReloj>("/dev/reloj", { avanzar: a }), `Adelantado ${a}.`)}
                  >
                    +{a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              disabled={cargando}
              onClick={() => ejecutar(() => apiPost<EstadoReloj>("/dev/reloj/ejecutar"), "Revisión ejecutada.")}
            >
              Revisar moras ahora
            </button>
            <button
              className="btn btn-secondary"
              disabled={cargando}
              onClick={() => ejecutar(() => apiDelete<EstadoReloj>("/dev/reloj"), "Volvió a la hora real.")}
            >
              Volver a la hora real
            </button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Borrar datos de expensas (pruebas)</h3>
            <p>
              Borra deudas, pagos, extras y movimientos de fondos. No borra expensas, tarifas,
              departamentos ni la regla de mora.
            </p>
          </div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {mensajeBorrado && <div className={`alert alert-${mensajeBorrado.tipo}`}>{mensajeBorrado.texto}</div>}
          <div>
            <button className="btn btn-primary" disabled={borrando} onClick={borrarDatos}>
              {borrando ? "Borrando…" : "Borrar datos de prueba"}
            </button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
