"use client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { CreditCardIcon } from "../../../components/Icons";
import { PagarDeudaModal } from "../../../components/PagarDeudaModal";
import {
  ESTADOS,
  MUTED,
  bs,
  cargarDeudasApi,
  cargarExpensasPagadasApi,
  cargarSaldoFavorApi,
  fechaLarga,
  nombrePeriodo,
  pagoDeExpensa,
  siguienteDeuda,
  type Deuda,
  type ExpensaPagada,
  type PagoAbierto,
} from "../../../lib/mi-cuenta";

type Fila = ({ tipo: "deuda" } & Deuda) | ({ tipo: "pagada" } & ExpensaPagada);

// Expensas del copropietario: la del mes y el historial de pagos
export default function MisExpensasPage() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [pagadas, setPagadas] = useState<ExpensaPagada[]>([]);
  const [saldoFavor, setSaldoFavor] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pago, setPago] = useState<PagoAbierto | null>(null);

  // Al cambiar `version` se vuelven a pedir los datos (después de enviar un comprobante)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([cargarDeudasApi(), cargarExpensasPagadasApi(), cargarSaldoFavorApi()])
      .then(([d, p, s]) => {
        setDeudas(d);
        setPagadas(p);
        setSaldoFavor(s);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar tus expensas."))
      .finally(() => setCargando(false));
  }, [version]);

  const siguiente = siguienteDeuda(deudas);
  // La tarjeta superior muestra la expensa del mes más reciente
  const actual = deudas.length > 0 ? deudas[deudas.length - 1] : null;
  const variosDeptos = new Set([...deudas, ...pagadas].map((d) => d.departamento)).size > 1;

  // Historial: de la más reciente a la más antigua
  const filas: Fila[] = [
    ...deudas.map((d) => ({ tipo: "deuda" as const, ...d })),
    ...pagadas.map((p) => ({ tipo: "pagada" as const, ...p })),
  ].sort((a, b) => b.vence.localeCompare(a.vence));

  const abrirPago = (deuda: Deuda) => setPago(pagoDeExpensa(deuda, siguiente, variosDeptos));

  return (
    <DashboardLayout active="mis-expensas">
      <div className="page-header">
        <div>
          <h1>Expensas</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {aviso && <div className="alert alert-success" style={{ marginBottom: 16 }}>{aviso}</div>}

      {/* Expensa del mes */}
      <section
        className="panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          padding: "22px 20px",
          marginBottom: 16,
          background: "linear-gradient(90deg, #FFF3F1 0%, #FFFFFF 60%)",
        }}
      >
        {cargando ? (
          <p style={MUTED}>Cargando…</p>
        ) : actual ? (
          <>
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>
                {nombrePeriodo(actual.periodo)}
                {variosDeptos && <span style={{ ...MUTED, marginLeft: 8 }}>Dpto. {actual.departamento}</span>}
              </h2>
              <p style={{ ...MUTED, margin: 0 }}>Vence el {fechaLarga(actual.vence)}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ ...MUTED, margin: "0 0 4px" }}>Monto de la expensa</p>
                <strong className="money" style={{ fontSize: 24 }}>{bs(actual.monto)}</strong>
              </div>
              <button className="btn btn-primary" onClick={() => abrirPago(actual)} disabled={actual.estado === "en_revision"}>
                <CreditCardIcon size={17} />
                Pagar
              </button>
            </div>
          </>
        ) : (
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Estás al día</h2>
            <p style={{ ...MUTED, margin: 0 }}>No tienes expensas pendientes.</p>
          </div>
        )}
      </section>

      {/* Historial */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Historial de pagos de expensas</h3>
            <p>Las expensas se pagan en orden, de la más antigua a la más reciente.</p>
          </div>
        </div>

        {!cargando && filas.length === 0 ? (
          <div className="empty-state">Todavía no tienes expensas registradas.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th>Vence</th>
                  <th>Pagado el</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const estado = ESTADOS[f.tipo === "pagada" ? "pagada" : f.estado];
                  return (
                    <tr key={`${f.tipo}-${f.id}`}>
                      <td>
                        <strong>{nombrePeriodo(f.periodo)}</strong>
                        {variosDeptos && <small>Dpto. {f.departamento}</small>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="money" style={{ fontWeight: 500 }}>{bs(f.monto)}</span>
                        {f.mora > 0 && <small style={{ display: "block", ...MUTED, fontSize: 10 }}>+ mora {bs(f.mora)}</small>}
                      </td>
                      <td>{fechaLarga(f.vence)}</td>
                      <td>{f.tipo === "pagada" ? fechaLarga(f.pagadoEl) : "—"}</td>
                      <td>{f.tipo === "pagada" ? f.metodo : "—"}</td>
                      <td>
                        <span className={estado.clase}>{estado.texto}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {f.tipo === "deuda" && f.estado !== "en_revision" ? (
                          <button className="btn btn-primary btn-sm" onClick={() => abrirPago(f)}>Pagar</button>
                        ) : (
                          <span style={MUTED}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pago && (
        <PagarDeudaModal
          key={pago.idDeuda}
          pago={pago}
          saldoFavor={saldoFavor}
          onClose={() => setPago(null)}
          onEnviado={(mensaje) => {
            setAviso(mensaje);
            setPago(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </DashboardLayout>
  );
}
