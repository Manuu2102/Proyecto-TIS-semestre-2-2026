"use client";
import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { WalletIcon, CheckIcon, CreditCardIcon } from "../../../components/Icons";

type Movimiento = {
  periodo: string; // "2026-07"
  concepto: string;
  monto: number;
  pagado: boolean;
  fechaPago: string | null;
  pagoAnticipado: boolean;
};

const REGLA_MORA = { porcentaje: 2, diasGracia: 5 }; // misma regla configurada en /pagos
const HOY = new Date("2026-09-25");

const movimientosPorDepto: Record<string, Movimiento[]> = {
  "A-101": [
    { periodo: "2026-07", concepto: "Expensa mensual", monto: 1280, pagado: true, fechaPago: "2026-07-05", pagoAnticipado: false },
    { periodo: "2026-08", concepto: "Expensa mensual", monto: 1280, pagado: true, fechaPago: "2026-07-28", pagoAnticipado: true },
    { periodo: "2026-09", concepto: "Expensa mensual", monto: 1280, pagado: true, fechaPago: "2026-09-03", pagoAnticipado: false },
  ],
  "A-202": [
    { periodo: "2026-07", concepto: "Expensa mensual", monto: 1280, pagado: true, fechaPago: "2026-07-09", pagoAnticipado: false },
    { periodo: "2026-08", concepto: "Expensa mensual", monto: 1280, pagado: true, fechaPago: "2026-08-07", pagoAnticipado: false },
    { periodo: "2026-09", concepto: "Expensa mensual", monto: 1280, pagado: false, fechaPago: null, pagoAnticipado: false },
  ],
  "B-301": [
    { periodo: "2026-08", concepto: "Expensa mensual", monto: 1280, pagado: false, fechaPago: null, pagoAnticipado: false },
    { periodo: "2026-09", concepto: "Expensa mensual", monto: 1280, pagado: false, fechaPago: null, pagoAnticipado: false },
  ],
  "B-402": [],
};

const DEPARTAMENTOS = Object.keys(movimientosPorDepto);

function diasDeAtraso(periodo: string) {
  const vencimiento = new Date(`${periodo}-10`);
  vencimiento.setDate(vencimiento.getDate() + REGLA_MORA.diasGracia);
  const diff = Math.floor((HOY.getTime() - vencimiento.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export default function EstadoCuentaPage() {
  const [depto, setDepto] = useState(DEPARTAMENTOS[0]);

  const filas = useMemo(() => {
    return (movimientosPorDepto[depto] ?? []).map((m) => {
      const atraso = m.pagado ? 0 : diasDeAtraso(m.periodo);
      const mora = atraso > 0 ? (m.monto * REGLA_MORA.porcentaje) / 100 : 0;
      return { ...m, atraso, mora };
    });
  }, [depto]);

  const totalPagado = filas.filter((f) => f.pagado).reduce((s, f) => s + f.monto, 0);
  const totalMora = filas.reduce((s, f) => s + f.mora, 0);
  const saldoActual = filas.filter((f) => !f.pagado).reduce((s, f) => s + f.monto + f.mora, 0);
  const anticipos = filas.filter((f) => f.pagoAnticipado).length;

  return (
    <DashboardLayout active="estado-cuenta">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · CONSULTA</p>
          <h1>Estado de cuenta</h1>
          <p>Consulta expensas, pagos, anticipos, mora y saldo de un departamento.</p>
        </div>
      </div>

      <div className="history-selector">
        <label className="field">
          <span>Seleccionar departamento</span>
          <select value={depto} onChange={(e) => setDepto(e.target.value)}>
            {DEPARTAMENTOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon attention"><WalletIcon size={20} /></div>
          <div><span>Saldo actual</span><strong>Bs. {saldoActual.toFixed(2)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Total pagado</span><strong>Bs. {totalPagado.toFixed(2)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CreditCardIcon size={20} /></div>
          <div><span>Pagos anticipados</span><strong>{anticipos}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Movimientos de {depto}</h3>
            <p>Mora total acumulada: Bs. {totalMora.toFixed(2)}</p>
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="empty-state">
            No existen expensas registradas para el departamento {depto}.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Mora</th>
                  <th>Fecha de pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.periodo}>
                    <td style={{ textTransform: "capitalize" }}>
                      {new Date(`${f.periodo}-01`).toLocaleDateString("es-BO", { month: "long", year: "numeric" })}
                    </td>
                    <td>{f.concepto}</td>
                    <td>Bs. {f.monto.toFixed(2)}</td>
                    <td>{f.mora > 0 ? `Bs. ${f.mora.toFixed(2)}` : "—"}</td>
                    <td>{f.fechaPago ?? "—"}</td>
                    <td>
                      {f.pagado ? (
                        <span className="status status-success">
                          <span />
                          {f.pagoAnticipado ? "Pagado (anticipado)" : "Pagado"}
                        </span>
                      ) : f.atraso > 0 ? (
                        <span className="status status-attention"><span />En mora</span>
                      ) : (
                        <span className="status status-warning"><span />Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}