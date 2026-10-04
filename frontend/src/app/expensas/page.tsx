"use client";
import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { PlusIcon, EditIcon, TrashIcon, WalletIcon, CheckIcon } from "../../../components/Icons";

type Concepto = { id: number; nombre: string; monto: number; activo: boolean };

// Registro real de expensa generada (esto es lo que backend va a reemplazar
// por un POST a /expensas cuando exista el endpoint). Se deja aquí para que
// la pantalla de "Pagos y mora" tenga datos reales con los que trabajar.
type ExpensaGenerada = {
  id: number;
  departamento: string;
  periodo: string;
  monto: number;
  estado: "Pendiente";
  fechaGeneracion: string;
  fechaVencimiento: string;
};

const DEPARTAMENTOS = ["A-101", "A-202", "B-301", "B-402"];

const initialConceptos: Concepto[] = [
  { id: 1, nombre: "Mantenimiento general", monto: 850, activo: true },
  { id: 2, nombre: "Limpieza de áreas comunes", monto: 230, activo: true },
  { id: 3, nombre: "Seguridad", monto: 200, activo: true },
  { id: 4, nombre: "Fondo de reserva", monto: 0, activo: false },
];

function mesActual() {
  const d = new Date();
  return d.toLocaleDateString("es-BO", { month: "long", year: "numeric" });
}

// Fecha de vencimiento: día 10 del mes siguiente al actual.
function fechaVencimientoMesSiguiente() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(10);
  return d.toLocaleDateString("es-BO");
}

export default function ExpensasPage() {
  const [conceptos, setConceptos] = useState(initialConceptos);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Concepto | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");

  // CAMBIO: en vez de un simple booleano, ahora guardamos los registros
  // reales de expensas generadas por período + departamento.
  const [expensasGeneradas, setExpensasGeneradas] = useState<ExpensaGenerada[]>([]);

  const activos = conceptos.filter((c) => c.activo);
  const totalPorDepto = activos.reduce((sum, c) => sum + c.monto, 0);
  const periodo = mesActual();

  // CAMBIO: esto reemplaza al booleano "generado" — ahora se calcula
  // mirando si ya existe un registro para el período actual.
  const yaGeneradoEstePeriodo = expensasGeneradas.some((e) => e.periodo === periodo);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setMonto("");
    setError("");
    setModalOpen(true);
  }

  function abrirEditar(c: Concepto) {
    setEditando(c);
    setNombre(c.nombre);
    setMonto(String(c.monto));
    setError("");
    setModalOpen(true);
  }

  function guardarConcepto() {
    const montoNum = Number(monto);
    if (!nombre.trim()) {
      setError("El nombre del concepto es obligatorio.");
      return;
    }
    if (!monto || isNaN(montoNum) || montoNum < 0) {
      setError("Ingresa un monto válido (mayor o igual a 0).");
      return;
    }

    // CAMBIO: validar nombre duplicado (ignorando mayúsculas/espacios),
    // excluyendo el propio concepto cuando se está editando.
    const duplicado = conceptos.some(
      (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() && c.id !== editando?.id
    );
    if (duplicado) {
      setError("Ya existe un concepto con ese nombre.");
      return;
    }

    if (editando) {
      setConceptos((prev) =>
        prev.map((c) => (c.id === editando.id ? { ...c, nombre: nombre.trim(), monto: montoNum } : c))
      );
    } else {
      setConceptos((prev) => [
        ...prev,
        { id: Date.now(), nombre: nombre.trim(), monto: montoNum, activo: true },
      ]);
    }
    setModalOpen(false);
  }

  function toggleActivo(id: number) {
    setConceptos((prev) => prev.map((c) => (c.id === id ? { ...c, activo: !c.activo } : c)));
  }

  // CAMBIO: ahora pide confirmación antes de eliminar, igual que en
  // copropietarios/departamentos/documentos.
  function eliminarConcepto(id: number) {
    const concepto = conceptos.find((c) => c.id === id);
    if (!concepto) return;
    const confirmar = window.confirm(
      `¿Eliminar el concepto "${concepto.nombre}"? Esto afectará el monto calculado para futuras expensas.`
    );
    if (!confirmar) return;
    setConceptos((prev) => prev.filter((c) => c.id !== id));
  }

  // CAMBIO: ahora valida duplicado de generación, pide confirmación, y
  // crea un registro real por departamento (listo para que backend lo
  // reemplace por un POST a /expensas).
  function generarExpensas() {
    if (yaGeneradoEstePeriodo) {
      alert(`Ya se generaron las expensas de ${periodo}. No se puede generar el mismo período dos veces.`);
      return;
    }

    const confirmar = window.confirm(
      `¿Generar las expensas de ${periodo} para los ${DEPARTAMENTOS.length} departamentos? Se calculará Bs. ${totalPorDepto.toFixed(2)} por unidad según los conceptos activos.`
    );
    if (!confirmar) return;

    const nuevas: ExpensaGenerada[] = DEPARTAMENTOS.map((d, i) => ({
      id: Date.now() + i,
      departamento: d,
      periodo,
      monto: totalPorDepto,
      estado: "Pendiente",
      fechaGeneracion: new Date().toLocaleDateString("es-BO"),
      fechaVencimiento: fechaVencimientoMesSiguiente(),
    }));

    setExpensasGeneradas((prev) => [...prev, ...nuevas]);
    alert(`Expensas de ${periodo} generadas correctamente para ${DEPARTAMENTOS.length} departamentos.`);
  }

  return (
    <DashboardLayout active="expensas">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · EXPENSAS</p>
          <h1>Configuración de expensas</h1>
          <p>Define los conceptos y montos, y genera las expensas mensuales del edificio.</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <PlusIcon size={16} /> Nuevo concepto
        </button>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Conceptos de expensas</h3>
            <p>Solo los conceptos activos se incluyen al generar las expensas mensuales.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong></td>
                  <td>Bs. {c.monto.toFixed(2)}</td>
                  <td>
                    <span className={`status ${c.activo ? "status-success" : "status-attention"}`}>
                      <span />
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="icon-button" title="Editar" onClick={() => abrirEditar(c)}>
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title={c.activo ? "Desactivar" : "Activar"}
                        onClick={() => toggleActivo(c.id)}
                      >
                        <CheckIcon size={16} />
                      </button>
                      <button className="icon-button" title="Eliminar" onClick={() => eliminarConcepto(c.id)}>
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Generar expensas mensuales</h3>
            <p style={{ textTransform: "capitalize" }}>Periodo: {periodo}</p>
          </div>
        </div>

        <div className="metric-row" style={{ padding: "0 20px 20px" }}>
          <div className="metric-card">
            <div className="metric-icon"><WalletIcon size={20} /></div>
            <div><span>Monto por departamento</span><strong>Bs. {totalPorDepto.toFixed(2)}</strong></div>
          </div>
          <div className="metric-card">
            <div className="metric-icon soft"><CheckIcon size={20} /></div>
            <div><span>Departamentos a generar</span><strong>{DEPARTAMENTOS.length}</strong></div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Departamento</th><th>Conceptos incluidos</th><th>Monto total</th></tr>
            </thead>
            <tbody>
              {DEPARTAMENTOS.map((d) => (
                <tr key={d}>
                  <td><span className="tag">{d}</span></td>
                  <td>{activos.length > 0 ? activos.map((c) => c.nombre).join(", ") : "—"}</td>
                  <td>Bs. {totalPorDepto.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "0 20px 20px" }}>
          <button
            className="btn btn-primary"
            onClick={generarExpensas}
            disabled={activos.length === 0 || yaGeneradoEstePeriodo}
          >
            {yaGeneradoEstePeriodo ? "Expensas ya generadas este período" : "Generar expensas del mes"}
          </button>
          {activos.length === 0 && (
            <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
              Activa al menos un concepto para poder generar expensas.
            </p>
          )}
          {yaGeneradoEstePeriodo && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              Expensas de {periodo} generadas correctamente para {DEPARTAMENTOS.length} departamentos.
            </div>
          )}
        </div>
      </section>

      {/* NUEVO: tabla de expensas ya generadas — esto es lo que "Pagos y mora"
          va a necesitar leer para poder mostrar la lista a cobrar. */}
      {expensasGeneradas.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-toolbar">
            <div>
              <h3>Expensas generadas</h3>
              <p>Registros listos para que la pantalla de Pagos y mora los procese.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Departamento</th><th>Período</th><th>Monto</th><th>Vencimiento</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {expensasGeneradas.map((e) => (
                  <tr key={e.id}>
                    <td><span className="tag">{e.departamento}</span></td>
                    <td>{e.periodo}</td>
                    <td>Bs. {e.monto.toFixed(2)}</td>
                    <td>{e.fechaVencimiento}</td>
                    <td>
                      <span className="status status-attention"><span />{e.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal open={modalOpen} title={editando ? "Editar concepto" : "Nuevo concepto"} onClose={() => setModalOpen(false)}>
        <div className="modal-form">
          <label className="field">
            <span>Nombre del concepto</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Mantenimiento general" />
          </label>
          <label className="field">
            <span>Monto (Bs.)</span>
            <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" onClick={guardarConcepto}>
            {editando ? "Guardar cambios" : "Crear concepto"}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}