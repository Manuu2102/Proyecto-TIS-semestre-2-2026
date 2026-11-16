"use client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { CheckIcon, Icon } from "../../../components/Icons";
import { PagarDeudaModal } from "../../../components/PagarDeudaModal";
import {
  ESTADOS,
  MUTED,
  bs,
  cargarDeudasApi,
  cargarExpensasPagadasApi,
  cargarExtrasApi,
  cargarSaldoFavorApi,
  fechaLarga,
  nombrePeriodo,
  pagoDeExpensa,
  pagoDeExtra,
  siguienteDeuda,
  type Deuda,
  type EstadoDeuda,
  type ExpensaPagada,
  type Extra,
  type PagoAbierto,
} from "../../../lib/mi-cuenta";

type Pendiente = {
  clave: string;
  titulo: string;
  detalle: string;
  total: number;
  estado: EstadoDeuda;
  abrir: () => PagoAbierto;
};

type PagoRealizado = { clave: string; fecha: string; concepto: string; metodo: string; monto: number };

const AlertaIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.2h.01" /></Icon>
);
const FlechaArribaIcon = ({ size = 20 }: { size?: number }) => (
  <Icon size={size}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
);

// Estado de cuenta del copropietario: deudas pendientes, pagos realizados y saldo a favor
export default function MiEstadoCuentaPage() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [pagadas, setPagadas] = useState<ExpensaPagada[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [saldoFavor, setSaldoFavor] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pago, setPago] = useState<PagoAbierto | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([cargarDeudasApi(), cargarExpensasPagadasApi(), cargarExtrasApi(), cargarSaldoFavorApi()])
      .then(([d, p, x, s]) => {
        setDeudas(d);
        setPagadas(p);
        setExtras(x);
        setSaldoFavor(s);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar tu estado de cuenta."))
      .finally(() => setCargando(false));
  }, [version]);

  const siguiente = siguienteDeuda(deudas);
  const variosDeptos = new Set([...deudas, ...pagadas].map((d) => d.departamento)).size > 1;

  // Deudas pendientes, de la más antigua a la más nueva. Los extras ya vienen dentro de cada deuda.
  const pendientes: Pendiente[] = deudas.map((d) => {
    const extrasDeDeuda = extras.filter((x) => x.idDeuda === d.id);
    const soloExtras = extrasDeDeuda.length > 0 && extrasDeDeuda.every((x) => !x.conExpensa);
    const partes = [
      d.mora > 0 ? `Expensa ${bs(d.monto)} + mora ${bs(d.mora)} · vencida el ${fechaLarga(d.vence)}` : `Vence el ${fechaLarga(d.vence)}`,
      !soloExtras && extrasDeDeuda.length > 0 ? `incluye ${extrasDeDeuda.map((x) => x.concepto).join(", ")}` : "",
    ].filter(Boolean);
    return {
      clave: d.id,
      titulo: soloExtras
        ? extrasDeDeuda.map((x) => x.concepto).join(", ")
        : nombrePeriodo(d.periodo) + (variosDeptos ? ` · Dpto. ${d.departamento}` : ""),
      detalle: soloExtras ? `Extra · vence el ${fechaLarga(d.vence)}` : partes.join(" · "),
      total: d.total,
      estado: d.estado,
      abrir: () =>
        soloExtras ? pagoDeExtra(extrasDeDeuda[0], d, siguiente) : pagoDeExpensa(d, siguiente, variosDeptos),
    };
  });

  // Pagos realizados, del más reciente al más antiguo (cada pago de expensa incluye sus extras)
  const pagos: PagoRealizado[] = pagadas
    .filter((p) => p.pagadoEl)
    .map((p) => {
      const extrasPagados = extras.filter((x) => x.idDeuda === p.id);
      const soloExtras = extrasPagados.length > 0 && extrasPagados.every((x) => !x.conExpensa);
      return {
        clave: p.id,
        fecha: p.pagadoEl,
        concepto: soloExtras
          ? `Extra: ${extrasPagados.map((x) => x.concepto).join(", ")}`
          : `Expensa ${nombrePeriodo(p.periodo)}`,
        metodo: p.metodo,
        monto: p.monto + p.mora,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const deudaTotal = pendientes.reduce((t, p) => t + p.total, 0);
  const anio = new Date().getFullYear();
  const pagosDelAnio = pagos.filter((p) => p.fecha.startsWith(String(anio)));
  const pagadoDelAnio = pagosDelAnio.reduce((t, p) => t + p.monto, 0);

  return (
    <DashboardLayout active="mi-estado-cuenta">
      <div className="page-header">
        <div>
          <h1>Estado de cuenta</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {aviso && <div className="alert alert-success" style={{ marginBottom: 16 }}>{aviso}</div>}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><AlertaIcon size={20} /></div>
          <div>
            <span>Deuda total</span>
            <strong>{cargando ? "…" : bs(deudaTotal)}</strong>
            <small style={{ ...MUTED, display: "block" }}>Pendiente de pago</small>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CheckIcon size={20} /></div>
          <div>
            <span>Pagado en {anio}</span>
            <strong>{cargando ? "…" : bs(pagadoDelAnio)}</strong>
            <small style={{ ...MUTED, display: "block" }}>
              {pagosDelAnio.length} {pagosDelAnio.length === 1 ? "pago realizado" : "pagos realizados"}
            </small>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><FlechaArribaIcon size={20} /></div>
          <div>
            <span>Saldo a favor</span>
            <strong>{cargando ? "…" : bs(saldoFavor)}</strong>
            <small style={{ ...MUTED, display: "block" }}>
              {saldoFavor > 0 ? "Se descuenta de tus próximas expensas" : "Sin saldo disponible"}
            </small>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, alignItems: "start", marginBottom: 16 }}>
        {/* Deudas pendientes */}
        <section className="panel">
          <div className="panel-toolbar">
            <div>
              <h3>Deudas pendientes</h3>
              <p>Expensas y extras sin pagar, incluidas las vencidas con mora.</p>
            </div>
          </div>
          {cargando ? (
            <div className="empty-state">Cargando…</div>
          ) : pendientes.length === 0 ? (
            <div className="empty-state">No tienes deudas pendientes.</div>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {pendientes.map((p) => {
                const estado = ESTADOS[p.estado];
                return (
                  <div
                    key={p.clave}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{p.titulo}</strong>
                      <span style={{ ...MUTED, display: "block", marginTop: 4 }}>{p.detalle}</span>
                    </div>
                    <strong className="money" style={{ fontSize: 13 }}>{bs(p.total)}</strong>
                    <span className={estado.clase}>{estado.texto}</span>
                    {p.estado !== "en_revision" && (
                      <button className="btn btn-primary btn-sm" onClick={() => setPago(p.abrir())}>Pagar</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pagos realizados */}
        <section className="panel">
          <div className="panel-toolbar">
            <div>
              <h3>Pagos realizados</h3>
              <p>Registro de todos tus pagos, del más reciente al más antiguo.</p>
            </div>
          </div>
          {cargando ? (
            <div className="empty-state">Cargando…</div>
          ) : pagos.length === 0 ? (
            <div className="empty-state">Todavía no tienes pagos registrados.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Método</th>
                    <th style={{ textAlign: "right" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.clave}>
                      <td>{fechaLarga(p.fecha)}</td>
                      <td><strong>{p.concepto}</strong></td>
                      <td>{p.metodo}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="money" style={{ fontWeight: 500 }}>{bs(p.monto)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ padding: "16px 18px", fontSize: 12, color: "#6F6762" }}>
        <strong style={{ color: "#2E2927" }}>Saldo a favor:</strong> si pagas más de lo que debes, el excedente queda guardado
        como saldo a favor y se descuenta automáticamente de tus próximas expensas.
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
