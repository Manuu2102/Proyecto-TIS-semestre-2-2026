"use client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { PagarDeudaModal } from "../../../components/PagarDeudaModal";
import {
  ESTADOS,
  MUTED,
  bs,
  cargarDeudasApi,
  cargarExtrasApi,
  cargarSaldoFavorApi,
  detalleExtra,
  fechaLarga,
  pagoDeExtra,
  siguienteDeuda,
  type Deuda,
  type Extra,
  type PagoAbierto,
} from "../../../lib/mi-cuenta";

// Extras del copropietario: cargos de la administración que se pagan aparte de la expensa
export default function MisExtrasPage() {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [saldoFavor, setSaldoFavor] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pago, setPago] = useState<PagoAbierto | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([cargarExtrasApi(), cargarDeudasApi(), cargarSaldoFavorApi()])
      .then(([e, d, s]) => {
        setExtras(e);
        setDeudas(d);
        setSaldoFavor(s);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar tus extras."))
      .finally(() => setCargando(false));
  }, [version]);

  // Del más reciente al más antiguo
  const filas = [...extras].sort((a, b) => b.emitido.localeCompare(a.emitido));
  const siguiente = siguienteDeuda(deudas);
  const variosDeptos = new Set(extras.map((x) => x.departamento)).size > 1;

  // El extra se paga con la deuda en la que está
  function abrirPago(extra: Extra) {
    const deuda = deudas.find((d) => d.id === extra.idDeuda);
    if (!deuda) {
      setError("Esta deuda ya no está pendiente. Recarga la página.");
      return;
    }
    setPago(pagoDeExtra(extra, deuda, siguiente));
  }

  return (
    <DashboardLayout active="mis-extras">
      <div className="page-header">
        <div>
          <h1>Extras</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {aviso && <div className="alert alert-success" style={{ marginBottom: 16 }}>{aviso}</div>}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Extras a pagar</h3>
            <p>Cargos generados por la administración. Se pagan aparte de la expensa mensual.</p>
          </div>
        </div>

        {cargando ? (
          <div className="empty-state">Cargando…</div>
        ) : filas.length === 0 ? (
          <div className="empty-state">No tienes extras registrados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Emitido</th>
                  <th>Vence</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((x) => {
                  const estado = ESTADOS[x.estado];
                  const pagable = x.estado === "pendiente" || x.estado === "vencida";
                  return (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.concepto}</strong>
                        <small>{detalleExtra(x)}{variosDeptos ? ` · Dpto. ${x.departamento}` : ""}</small>
                      </td>
                      <td>{fechaLarga(x.emitido)}</td>
                      <td>{fechaLarga(x.vence)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="money" style={{ fontWeight: 500 }}>{bs(x.monto)}</span>
                      </td>
                      <td>
                        <span className={estado.clase}>{estado.texto}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {pagable ? (
                          <button className="btn btn-primary btn-sm" onClick={() => abrirPago(x)}>Pagar</button>
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
