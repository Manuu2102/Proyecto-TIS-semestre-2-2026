"use client";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { WalletIcon, CheckIcon } from "../../../components/Icons";

export default function FinanzasPage() {
  return <DashboardLayout active="finanzas">
    <div className="page-header"><div><p className="eyebrow">FINANZAS</p><h1>Expensas y finanzas</h1><p>Consulta saldos, pagos, expensas y movimientos financieros del edificio.</p></div></div>
    <div className="metric-row">
      <div className="metric-card"><div className="metric-icon"><WalletIcon size={20}/></div><div><span>Recaudación del mes</span><strong>Bs. 18.450</strong></div></div>
      <div className="metric-card"><div className="metric-icon soft"><CheckIcon size={20}/></div><div><span>Pagos aprobados</span><strong>28</strong></div></div>
      <div className="metric-card"><div className="metric-icon attention"><WalletIcon size={20}/></div><div><span>Saldo pendiente</span><strong>Bs. 3.280</strong></div></div>
    </div>
    <section className="panel"><div className="panel-toolbar"><div><h3>Movimientos recientes</h3><p>Resumen financiero del edificio</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Concepto</th><th>Departamento</th><th>Monto</th><th>Estado</th></tr></thead>
      <tbody>
        <tr><td><strong>Expensas septiembre 2026</strong><small>Pago mensual</small></td><td><span className="tag">A-101</span></td><td>Bs. 1.280,00</td><td><span className="status status-success"><span/>Aprobado</span></td></tr>
        <tr><td><strong>Expensas septiembre 2026</strong><small>Pago mensual</small></td><td><span className="tag">A-202</span></td><td>Bs. 1.280,00</td><td><span className="status status-attention"><span/>Pendiente</span></td></tr>
      </tbody></table></div>
    </section>
  </DashboardLayout>;
}
