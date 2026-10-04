"use client";
import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { PlusIcon, FileIcon, WalletIcon, CheckIcon } from "../../../components/Icons";

type Tipo = "Ingreso" | "Gasto";

const CATEGORIAS_INGRESO = ["Donación", "Multa", "Alquiler de áreas comunes", "Otro ingreso"];
const CATEGORIAS_GASTO = ["Mantenimiento", "Servicios básicos", "Limpieza", "Seguridad", "Otro gasto"];

type Movimiento = {
  id: number;
  tipo: Tipo;
  categoria: string;
  monto: number;
  descripcion: string;
  fecha: string;
  comprobante: string | null; // nombre del archivo adjunto
};

const initialMovimientos: Movimiento[] = [
  { id: 1, tipo: "Gasto", categoria: "Mantenimiento", monto: 450, descripcion: "Reparación de bomba de agua", fecha: "2026-09-10", comprobante: "factura_bomba.pdf" },
  { id: 2, tipo: "Ingreso", categoria: "Alquiler de áreas comunes", monto: 300, descripcion: "Alquiler salón de eventos", fecha: "2026-09-14", comprobante: null },
  { id: 3, tipo: "Gasto", categoria: "Servicios básicos", monto: 620, descripcion: "Electricidad áreas comunes", fecha: "2026-09-18", comprobante: "recibo_luz.jpg" },
];

export default function IngresosEgresosPage() {
  const [movimientos, setMovimientos] = useState(initialMovimientos);
  const [filtroTipo, setFiltroTipo] = useState<"Todos" | Tipo>("Todos");
  const [busqueda, setBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("Ingreso");
  const [categoria, setCategoria] = useState(CATEGORIAS_INGRESO[0]);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [error, setError] = useState("");

  const categoriasDisponibles = tipo === "Ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;

  const filtrados = useMemo(() => {
    return movimientos.filter(
      (m) =>
        (filtroTipo === "Todos" || m.tipo === filtroTipo) &&
        `${m.categoria} ${m.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [movimientos, filtroTipo, busqueda]);

  const totalIngresos = movimientos.filter((m) => m.tipo === "Ingreso").reduce((s, m) => s + m.monto, 0);
  const totalGastos = movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0);

  function abrirModal(t: Tipo) {
    setTipo(t);
    setCategoria(t === "Ingreso" ? CATEGORIAS_INGRESO[0] : CATEGORIAS_GASTO[0]);
    setMonto("");
    setDescripcion("");
    setComprobante(null);
    setError("");
    setModalOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setComprobante(null);
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension || "")) {
      setError("Formato no permitido. Selecciona un archivo PDF, JPG o PNG.");
      setComprobante(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El comprobante no debe superar los 5 MB.");
      setComprobante(null);
      return;
    }
    setError("");
    setComprobante(file);
  }

  function guardarMovimiento() {
    const montoNum = Number(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Ingresa un monto válido, mayor a 0.");
      return;
    }
    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    setMovimientos((prev) => [
      {
        id: Date.now(),
        tipo,
        categoria,
        monto: montoNum,
        descripcion: descripcion.trim(),
        fecha: new Date().toISOString().slice(0, 10),
        comprobante: comprobante ? comprobante.name : null,
      },
      ...prev,
    ]);
    setModalOpen(false);
  }

  return (
    <DashboardLayout active="ingresos-egresos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-03 · FINANZAS</p>
          <h1>Ingresos y egresos</h1>
          <p>Registra ingresos extraordinarios y gastos del edificio, clasificados por categoría.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => abrirModal("Ingreso")}>
            <PlusIcon size={16} /> Nuevo ingreso
          </button>
          <button className="btn btn-primary" onClick={() => abrirModal("Gasto")}>
            <PlusIcon size={16} /> Nuevo gasto
          </button>
        </div>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon soft"><WalletIcon size={20} /></div>
          <div><span>Total ingresos extraordinarios</span><strong>Bs. {totalIngresos.toFixed(2)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention"><WalletIcon size={20} /></div>
          <div><span>Total gastos</span><strong>Bs. {totalGastos.toFixed(2)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CheckIcon size={20} /></div>
          <div><span>Movimientos registrados</span><strong>{movimientos.length}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Historial de movimientos</h3>
            <p>Consulta y filtra los ingresos y gastos registrados.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as "Todos" | Tipo)}>
              <option value="Todos">Todos</option>
              <option value="Ingreso">Ingresos</option>
              <option value="Gasto">Gastos</option>
            </select>
            <input
              placeholder="Buscar por categoría o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">No se encontraron movimientos con esos filtros.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td>
                      <span className={`status ${m.tipo === "Ingreso" ? "status-success" : "status-attention"}`}>
                        <span />
                        {m.tipo}
                      </span>
                    </td>
                    <td><span className="tag">{m.categoria}</span></td>
                    <td>{m.descripcion}</td>
                    <td>Bs. {m.monto.toFixed(2)}</td>
                    <td>
                      {m.comprobante ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <FileIcon size={14} /> {m.comprobante}
                        </span>
                      ) : (
                        <span style={{ color: "#9a918b" }}>Sin adjunto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modalOpen} title={`Registrar ${tipo.toLowerCase()}`} onClose={() => setModalOpen(false)}>
        <div className="modal-form">
          <label className="field">
            <span>Tipo de movimiento</span>
            <select value={tipo} onChange={(e) => { const t = e.target.value as Tipo; setTipo(t); setCategoria(t === "Ingreso" ? CATEGORIAS_INGRESO[0] : CATEGORIAS_GASTO[0]); }}>
              <option value="Ingreso">Ingreso extraordinario</option>
              <option value="Gasto">Gasto</option>
            </select>
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categoriasDisponibles.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Monto (Bs.)</span>
            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </label>
          <label className="field">
            <span>Descripción</span>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Reparación de bomba de agua" />
          </label>
          <label className="field">
            <span>Comprobante (opcional)</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
            {comprobante && <small>{comprobante.name}</small>}
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" onClick={guardarMovimiento}>
            Registrar {tipo.toLowerCase()}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}