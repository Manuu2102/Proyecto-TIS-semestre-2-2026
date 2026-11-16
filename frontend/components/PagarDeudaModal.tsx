"use client";

import { useEffect, useState } from "react";
import { MUTED, bs, cargarQrApi, enviarComprobanteApi, type PagoAbierto } from "../lib/mi-cuenta";

// El backend todavía no guarda el método en la petición: solo se usa para mostrar el QR
type Metodo = "qr" | "transferencia";
const METODOS: { valor: Metodo; texto: string }[] = [
  { valor: "qr", texto: "Pago con QR" },
  { valor: "transferencia", texto: "Transferencia bancaria" },
];

const FILA_RESUMEN = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  fontSize: 13,
  color: "#6F6762",
} as const;

/**
 * Modal de pago: resumen, método y foto del comprobante.
 * Montarlo con `key={pago.idDeuda}` para que empiece limpio cada vez.
 */
export function PagarDeudaModal({
  pago,
  saldoFavor,
  onClose,
  onEnviado,
}: {
  pago: PagoAbierto;
  saldoFavor: number;
  onClose: () => void;
  onEnviado: (mensaje: string) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [errorQr, setErrorQr] = useState("");
  const [metodo, setMetodo] = useState<Metodo | "">("");
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const bloqueado = Boolean(pago.bloqueo);
  const neto = Math.max(pago.monto + pago.mora - saldoFavor, 0);

  // El QR se pide al abrir y se libera al cerrar
  useEffect(() => {
    let url: string | null = null;
    cargarQrApi()
      .then((u) => {
        url = u;
        setQrUrl(u);
      })
      .catch((e) => setErrorQr(e instanceof Error ? e.message : "No se pudo cargar el QR."));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  function cerrar() {
    if (!enviando) onClose();
  }

  // Cerrar con Escape
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enviando) onClose();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [enviando, onClose]);

  async function enviar() {
    if (!foto || !metodo || bloqueado || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
    try {
      await enviarComprobanteApi(pago.idDeuda, foto);
      onEnviado(`Comprobante de ${pago.nombre} enviado. El administrador lo revisará.`);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar el comprobante.");
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
      <section className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="pago-titulo" style={{ padding: "24px 22px 22px" }}>
        <h2 id="pago-titulo" style={{ margin: "0 0 6px", fontSize: 17 }}>{pago.titulo}</h2>
        <p style={{ ...MUTED, fontSize: 12, margin: "0 0 18px" }}>{pago.subtitulo}</p>

        {/* Resumen del monto */}
        <div style={{ border: "1px solid #EFE7E1", borderRadius: 10, padding: "6px 16px" }}>
          <div style={FILA_RESUMEN}>
            <span>{pago.etiquetaMonto}</span>
            <strong className="money">{bs(pago.monto)}</strong>
          </div>
          <div style={FILA_RESUMEN}>
            <span>
              Saldo de mora <small style={{ fontSize: 10 }}>(se aplica si no pagas a tiempo)</small>
            </span>
            <strong className="money">{bs(pago.mora)}</strong>
          </div>
          <div style={FILA_RESUMEN}>
            <span>Saldo a favor aplicado</span>
            <strong className="money">{bs(saldoFavor)}</strong>
          </div>
          <div style={{ ...FILA_RESUMEN, borderTop: "1px solid #EFE7E1", marginTop: 6, paddingTop: 16, color: "#2E2927" }}>
            <strong>Neto a pagar</strong>
            <strong className="money" style={{ color: "#B03030", fontSize: 15 }}>{bs(neto)}</strong>
          </div>
        </div>

        {pago.bloqueo && (
          <div className="alert alert-error" style={{ marginTop: 14, fontWeight: 600, fontSize: 12, lineHeight: 1.5 }}>
            {pago.bloqueo}
          </div>
        )}

        <label className="field" style={{ marginTop: 16, fontSize: 12 }}>
          <span>Método de pago</span>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as Metodo | "")}
            disabled={enviando || bloqueado}
            style={{ minHeight: 40, borderColor: metodo ? undefined : "#D9534F" }}
          >
            <option value="">Selecciona un método</option>
            {METODOS.map((m) => (
              <option key={m.valor} value={m.valor}>{m.texto}</option>
            ))}
          </select>
        </label>

        {metodo === "qr" && (
          <div style={{ display: "grid", placeItems: "center", padding: 12, marginTop: 12, border: "1px dashed #E6DDD6", borderRadius: 10 }}>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR de cobro del edificio" style={{ width: 200, height: 200, objectFit: "contain" }} />
            ) : errorQr ? (
              <p className="field-error">{errorQr}</p>
            ) : (
              <p style={MUTED}>Cargando QR…</p>
            )}
          </div>
        )}

        <label className="field" style={{ marginTop: 14, fontSize: 12 }}>
          <span>Comprobante de pago</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            disabled={enviando || bloqueado}
            style={{ minHeight: 40, padding: "8px 10px", background: "#FFFBF9", borderStyle: "dashed" }}
          />
          {/* El backend solo acepta PNG, JPG o WEBP de hasta 5 MB */}
          <span className="field-hint">Sube una foto del pago (PNG, JPG o WEBP, hasta 5 MB).</span>
        </label>

        {errorEnvio && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorEnvio}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={cerrar} disabled={enviando}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={!foto || !metodo || bloqueado || enviando}>
            {enviando ? "Enviando…" : "Enviar pago"}
          </button>
        </div>
      </section>
    </div>
  );
}
