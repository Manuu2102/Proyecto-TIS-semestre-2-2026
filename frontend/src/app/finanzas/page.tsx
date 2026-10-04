"use client";
import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { WalletIcon, CheckIcon, SettingsIcon, CreditCardIcon, FileIcon } from "../../../components/Icons";

const accesos: [string, string, string, typeof WalletIcon][] = [
  ["Expensas", "Configurar conceptos, mora y generar expensas mensuales", "/expensas", SettingsIcon],
  ["Pagos y mora", "Registrar pagos, anticipos y consultar saldos", "/pagos", CreditCardIcon],
  ["Estado de cuenta", "Consultar expensas, pagos y saldo por departamento", "/estado-cuenta", FileIcon],
  ["Ingresos y egresos", "Registrar ingresos extraordinarios y gastos del edificio", "/ingresos-egresos", WalletIcon],
];

export default function FinanzasPage() {
  return (
    <DashboardLayout active="finanzas">
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Expensas y finanzas</h1>
          <p>Resumen financiero del edificio y accesos a la gestión de expensas, pagos e ingresos.</p>
        </div>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><WalletIcon size={20} /></div>
          <div><span>Recaudación del mes</span><strong>Bs. 18.450</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Pagos aprobados</span><strong>28</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention"><WalletIcon size={20} /></div>
          <div><span>Saldo pendiente</span><strong>Bs. 3.280</strong></div>
        </div>
      </div>

      <section className="dashboard-modules">
        <div className="section-heading">
          <div>
            <h2>Gestión de expensas</h2>
            <p>Administración de montos, pagos, mora, estado de cuenta e ingresos del edificio.</p>
          </div>
        </div>
        <div className="admin-action-grid">
          {accesos.map(([label, description, href, Icon]) => (
            <Link href={href} className="admin-action-card" key={label}>
              <div className="admin-action-icon"><Icon size={24} /></div>
              <div><strong>{label}</strong><span>{description}</span></div>
              <b>→</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Pagos recientes</h3>
            <p>Últimos pagos de expensas registrados en el edificio.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Concepto</th><th>Departamento</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Expensas septiembre 2026</strong><small>Pago mensual</small></td>
                <td><span className="tag">A-101</span></td>
                <td>Bs. 1.280,00</td>
                <td><span className="status status-success"><span />Aprobado</span></td>
              </tr>
              <tr>
                <td><strong>Expensas septiembre 2026</strong><small>Pago mensual</small></td>
                <td><span className="tag">A-202</span></td>
                <td>Bs. 1.280,00</td>
                <td><span className="status status-attention"><span />Pendiente</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}