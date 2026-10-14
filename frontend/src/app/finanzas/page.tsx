"use client";
import { useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { BuildingIcon, CheckIcon, CreditCardIcon, FileIcon, PlusIcon, WalletIcon } from "../../../components/Icons";

// =====================================================================
// DATOS DE EJEMPLO (los reemplaza el backend)
// =====================================================================

// BACKEND: GET /finanzas/resumen?periodo=2026-10
const PERIODO = "Octubre 2026";
const CAJA = { abierta: true, desde: "01/08/2026", saldo: 3120 };

// BACKEND: GET /cuentas-bancarias (solo activas, con su saldo actual)
const CUENTAS = [
  { id: 1, banco: "Banco Nacional de Bolivia", numero: "1000-123456", titular: "Edificio Central", saldo: 15000 },
  { id: 2, banco: "Banco Mercantil Santa Cruz", numero: "4020-998877", titular: "Edificio Central", saldo: 5200 },
];

// BACKEND: GET /finanzas/serie?meses=3  (ingresos = expensas cobradas + extraordinarios; sin movimientos anulados)
const SERIE = [
  { mes: "Ago", ingresos: 3150, egresos: 1200 },
  { mes: "Sep", ingresos: 3350, egresos: 1700 },
  { mes: "Oct", ingresos: 3600, egresos: 450 },
];

// BACKEND: totales de expensas del período (los calcula el servidor)
const EXPENSAS_MES = { generadas: 8, ocupados: 8, pagadas: 3 };
const ADEUDADO = 4000;
const MORA_ACUMULADA = 1750;

// BACKEND: GET /saldos-pendientes?estado=En mora
const EN_MORA = [
  { numero: 103, responsable: "Ana Lucía Vargas", categoria: "A", sinPagar: 3, adeudado: 1200, mora: 800 },
  { numero: 202, responsable: "Diego Mauricio Salazar", categoria: "B", sinPagar: 2, adeudado: 900, mora: 450 },
  { numero: 302, responsable: "Alejandra Guzmán", categoria: "C", sinPagar: 2, adeudado: 1000, mora: 500 },
];

// BACKEND: GET /movimientos-financieros?limite=5
const ULTIMOS = [
  { id: 1, fecha: "2026-10-08", tipo: "Ingreso", categoria: "Otro ingreso", descripcion: "Ingreso registrado por error", metodo: "Efectivo", monto: 250, anulado: true },
  { id: 2, fecha: "2026-10-06", tipo: "Ingreso", categoria: "Donación", descripcion: "Aporte para jardinería", metodo: "Depósito", monto: 500, anulado: false },
  { id: 3, fecha: "2026-09-22", tipo: "Gasto", categoria: "Seguridad", descripcion: "Servicio de vigilancia", metodo: "Transferencia", monto: 900, anulado: false },
  { id: 4, fecha: "2026-09-14", tipo: "Ingreso", categoria: "Multa", descripcion: "Multa por ruido fuera de horario", metodo: "Efectivo", monto: 150, anulado: false },
  { id: 5, fecha: "2026-09-10", tipo: "Gasto", categoria: "Limpieza", descripcion: "Insumos de limpieza", metodo: "Efectivo", monto: 180, anulado: false },
];

// =====================================================================
// Utilidades de presentación
// =====================================================================

type Alerta = { color: string; titulo: string; detalle: string; href: string };

const ALTO = 150;

function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}
function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}

// =====================================================================
// Resumen para administrador (completo) y directorio (solo lectura)
// =====================================================================

function Resumen({ soloLectura }: { soloLectura: boolean }) {
  const totalBancos = CUENTAS.reduce((s, c) => s + c.saldo, 0);
  const actual = SERIE[SERIE.length - 1];
  const balance = actual.ingresos - actual.egresos;
  const maximo = Math.max(...SERIE.flatMap((s) => [s.ingresos, s.egresos]), 1);
  const faltan = EXPENSAS_MES.ocupados - EXPENSAS_MES.generadas;

  const alertas: Alerta[] = [];
  if (EN_MORA.length > 0) {
    alertas.push({
      color: "#C13333",
      titulo: `${EN_MORA.length} ${EN_MORA.length === 1 ? "departamento" : "departamentos"} en mora`,
      detalle: `Dptos. ${EN_MORA.map((d) => d.numero).join(", ")}`,
      href: "/pagos",
    });
  }
  alertas.push(
    faltan > 0
      ? { color: "#D9A441", titulo: `Faltan expensas de ${PERIODO}`, detalle: `${faltan} departamentos sin expensa generada`, href: "/expensas" }
      : { color: "#6E9B61", titulo: `Expensas de ${PERIODO} generadas`, detalle: `${EXPENSAS_MES.generadas} de ${EXPENSAS_MES.ocupados} departamentos`, href: "/expensas" }
  );
  if (!CAJA.abierta) {
    alertas.push({ color: "#D9A441", titulo: "La caja aún no ha sido abierta", detalle: "Registra el monto inicial para empezar a usarla", href: "/caja-bancos" });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS · {PERIODO.toUpperCase()}</p>
          <h1>Resumen financiero</h1>
          <p>{soloLectura ? "Supervisión financiera del edificio (solo lectura)." : "Cómo va el mes y qué necesita tu atención."}</p>
        </div>
        {!soloLectura && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/expensas" className="btn btn-secondary"><PlusIcon size={16} /> Generar expensas</Link>
            <Link href="/pagos" className="btn btn-secondary"><CreditCardIcon size={16} /> Registrar pago</Link>
            <Link href="/ingresos-egresos" className="btn btn-primary"><PlusIcon size={16} /> Nuevo movimiento</Link>
          </div>
        )}
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon"><WalletIcon size={20} /></div>
          <span>Saldo de caja</span>
          <strong>{CAJA.abierta ? bs(CAJA.saldo) : "Sin abrir"}</strong>
          <small>{CAJA.abierta ? `Caja abierta desde ${CAJA.desde}` : "La caja aún no ha sido abierta"}</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><BuildingIcon size={20} /></div>
          <span>Saldo en bancos</span>
          <strong>{bs(totalBancos)}</strong>
          <small>{CUENTAS.length} {CUENTAS.length === 1 ? "cuenta activa" : "cuentas activas"}</small>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <span>Balance de {PERIODO}</span>
          <strong>{bs(balance)}</strong>
          <small>Ingresos {bs(actual.ingresos)} · Egresos {bs(actual.egresos)}</small>
        </div>
        {soloLectura ? (
          <div className="metric-card">
            <div className="metric-icon"><FileIcon size={20} /></div>
            <span>Movimientos recientes</span>
            <strong>{ULTIMOS.length}</strong>
            <small>Ingresos y gastos registrados</small>
          </div>
        ) : (
          <div className="metric-card">
            <div className="metric-icon attention"><CreditCardIcon size={20} /></div>
            <span>Monto adeudado</span>
            <strong>{bs(ADEUDADO)}</strong>
            <small>Mora acumulada {bs(MORA_ACUMULADA)} · calculada automáticamente</small>
          </div>
        )}
      </div>

      <div className="dashboard-bottom" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Ingresos vs egresos</h3>
            <p>Últimos {SERIE.length} meses, sin contar movimientos anulados.</p>
          </div>
          <div style={{ padding: "20px 22px" }}>
            <svg viewBox={`0 0 420 ${ALTO + 30}`} width="100%" role="img" aria-label="Ingresos vs egresos">
              {[0, 0.5, 1].map((t) => (
                <line key={t} x1="0" x2="420" y1={ALTO - ALTO * t} y2={ALTO - ALTO * t} stroke="#F0EAE5" />
              ))}
              {SERIE.map((d, i) => {
                const x = i * 140 + 24;
                const hi = (d.ingresos / maximo) * ALTO;
                const he = (d.egresos / maximo) * ALTO;
                return (
                  <g key={d.mes}>
                    <rect x={x} y={ALTO - hi} width="36" height={hi} rx="4" fill="#C13333" />
                    <rect x={x + 42} y={ALTO - he} width="36" height={he} rx="4" fill="#FFAA82" />
                    <text x={x + 39} y={ALTO + 18} textAnchor="middle" fontSize="11" fill="#9A918B">{d.mes}</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#766E69", marginTop: 6, flexWrap: "wrap" }}>
              <span><b style={{ color: "#C13333" }}>■</b> Ingresos (expensas cobradas + extraordinarios)</span>
              <span><b style={{ color: "#FFAA82" }}>■</b> Egresos</span>
            </div>
          </div>
        </section>

        {soloLectura ? (
          <section className="panel">
            <div className="panel-heading">
              <h3>Cuentas bancarias</h3>
              <p>Saldo actual de cada cuenta del edificio.</p>
            </div>
            <div style={{ padding: "6px 20px 14px" }}>
              {CUENTAS.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #F1ECE8" }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{c.banco}</strong>
                    <small style={{ color: "#766E69", fontSize: 10 }}>Cuenta {c.numero} · {c.titular}</small>
                  </div>
                  <strong>{bs(c.saldo)}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <h3>Requiere atención</h3>
              <p>Alertas del período en curso.</p>
            </div>
            <div style={{ padding: "6px 20px 14px" }}>
              {alertas.map((a) => (
                <Link
                  href={a.href}
                  key={a.titulo}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #F1ECE8" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flex: "none" }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{a.titulo}</strong>
                    <small style={{ color: "#766E69", fontSize: 10 }}>{a.detalle}</small>
                  </div>
                  <b style={{ color: "#B4AAA3" }}>→</b>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* La lista de saldos pendientes es solo para el administrador. */}
      {!soloLectura && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-toolbar">
            <div>
              <h3>Departamentos en mora</h3>
              <p>
                {EXPENSAS_MES.pagadas} de {EXPENSAS_MES.generadas} expensas de {PERIODO} pagadas. El detalle completo está
                en Pagos y mora.
              </p>
            </div>
            <Link href="/pagos" className="btn btn-secondary"><FileIcon size={16} /> Ver saldos pendientes</Link>
          </div>
          {EN_MORA.length === 0 ? (
            <div className="empty-state">No hay departamentos en mora.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Departamento</th><th>Responsable</th><th>Categoría</th><th>Expensas sin pagar</th>
                    <th>Adeudado</th><th>Mora</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {EN_MORA.map((d) => (
                    <tr key={d.numero}>
                      <td><span className="tag">Dpto. {d.numero}</span></td>
                      <td>{d.responsable}</td>
                      <td>{d.categoria}</td>
                      <td>{d.sinPagar}</td>
                      <td>{bs(d.adeudado)}</td>
                      <td>{bs(d.mora)}</td>
                      <td>
                        <span className="status" style={{ color: "#9F2727", background: "#FFE5E1" }}><i />En mora</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Últimos ingresos y gastos</h3>
            <p>Los movimientos anulados se conservan en el historial.</p>
          </div>
          {!soloLectura && (
            <Link href="/ingresos-egresos" className="btn btn-secondary"><FileIcon size={16} /> Ver historial</Link>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Monto</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {ULTIMOS.map((m) => (
                <tr key={m.id} style={m.anulado ? { opacity: 0.55 } : undefined}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td>
                    <span className={`status ${m.tipo === "Ingreso" ? "status-success" : "status-attention"}`}><i />{m.tipo}</span>
                  </td>
                  <td><span className="tag">{m.categoria}</span></td>
                  <td>{m.descripcion}</td>
                  <td>{m.metodo}</td>
                  <td>{bs(m.monto)}</td>
                  <td>{m.anulado ? <span className="tag">Anulado</span> : "Vigente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// =====================================================================
// Copropietario e inquilino: su estado de cuenta llega con la app de copropietarios.
// No se les muestra información financiera de todo el edificio.
// =====================================================================

function SinVistaPropia() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Mis finanzas</h1>
          <p>Aquí verás tu estado de cuenta, tus pagos y tus comprobantes.</p>
        </div>
      </div>
      <div className="panel">
        <div className="empty-state">Tu estado de cuenta estará disponible próximamente.</div>
      </div>
    </>
  );
}

// =====================================================================
// Página
// =====================================================================

export default function FinanzasPage() {
  const [rol] = useState(readRol);

  return (
    <DashboardLayout active="finanzas">
      {rol.startsWith("ADMIN") ? (
        <Resumen soloLectura={false} />
      ) : rol.startsWith("DIRECTORIO") ? (
        <Resumen soloLectura />
      ) : (
        <SinVistaPropia />
      )}
    </DashboardLayout>
  );
}