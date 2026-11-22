"use client";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { PlusIcon, FileIcon, WalletIcon, CheckIcon } from "../../../components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

type Tipo = "Ingreso" | "Gasto";

type Metodo = "efectivo" | "transferencia" | "deposito";

type CategoriaAPI = {
  id: string;
  nombre: string;
  tipo: "ingreso" | "gasto";
  activa: boolean;
};

type IngresoAPI = {
  id: string;
  fecha: string;
  monto: string;
  id_categoria: string;
  descripcion: string | null;
  metodo: string;
  anulado: boolean;
  comprobante_nombre: string | null;
  categoria?: { id: number; nombre: string; tipo: string };
};

type GastoAPI = {
  id: string;
  fecha: string;
  monto: string;
  id_categoria: string;
  proveedor: string | null;
  descripcion: string | null;
  metodo: string;
  anulado: boolean;
  comprobante_nombre: string | null;
  categoria?: { id: number; nombre: string; tipo: string };
};

type Movimiento = {
  id: string;
  tipo: Tipo;
  categoria: string;
  monto: number;
  descripcion: string;
  proveedor: string;
  fecha: string;
  comprobante: string | null;
  anulado: boolean;
};

type RespuestaAPI = { message?: string | string[] };

// Mismos límites que valida el backend (lib/validacion.ts)
const MAX_TEXTO = 255;
const MONTO_REGEX = /^\d+(\.\d{1,2})?$/;

const formatearFecha = (fecha: string) => {
  try {
    return new Date(fecha).toISOString().slice(0, 10);
  } catch {
    return fecha;
  }
};

/** Lee la respuesta aunque no sea JSON (por ejemplo, un 500 con HTML). */
async function leerRespuesta(res: Response): Promise<RespuestaAPI> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

const mensajeDe = (data: RespuestaAPI, porDefecto: string) =>
  (Array.isArray(data.message) ? data.message.join(" ") : data.message) || porDefecto;

const NOTA: React.CSSProperties = { color: "#9a918b", fontWeight: 400 };

export default function IngresosEgresosPage() {
  const [ingresos, setIngresos] = useState<IngresoAPI[]>([]);
  const [gastos, setGastos] = useState<GastoAPI[]>([]);
  const [categorias, setCategorias] = useState<CategoriaAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [filtroTipo, setFiltroTipo] = useState<"Todos" | Tipo>("Todos");
  const [busqueda, setBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("Ingreso");
  const [idCategoria, setIdCategoria] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.activa && c.tipo === tipo.toLowerCase()),
    [categorias, tipo]
  );

  // Cargar datos al montar
  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        setErrorCarga("");

        const [resIng, resGas, resCat] = await Promise.all([
          fetch(`${API_URL}/ingresos`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`${API_URL}/gastos`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          fetch(`${API_URL}/categorias`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
        ]);

        if (!resIng.ok || !resGas.ok || !resCat.ok) {
          throw new Error("Error cargando datos");
        }

        const dataIng = await resIng.json();
        const dataGas = await resGas.json();
        const dataCat = await resCat.json();

        setIngresos(dataIng.ingresos ?? []);
        setGastos(dataGas.gastos ?? []);
        setCategorias(dataCat.categorias ?? []);
      } catch (e) {
        console.error("Error cargando movimientos:", e);
        setErrorCarga("No se pudieron cargar los movimientos. Revisa la consola.");
      } finally {
        setCargando(false);
      }
    };
    void cargar();
  }, []);

  // Combinar ingresos y gastos en una lista unificada
  const movimientos: Movimiento[] = useMemo(() => {
    const movIng: Movimiento[] = ingresos.map((i) => ({
      id: `i-${i.id}`,
      tipo: "Ingreso",
      categoria: i.categoria?.nombre ?? "Sin categoría",
      monto: Number(i.monto),
      descripcion: i.descripcion ?? "",
      proveedor: "",
      fecha: formatearFecha(i.fecha),
      comprobante: i.comprobante_nombre,
      anulado: i.anulado,
    }));

    const movGas: Movimiento[] = gastos.map((g) => ({
      id: `g-${g.id}`,
      tipo: "Gasto",
      categoria: g.categoria?.nombre ?? "Sin categoría",
      monto: Number(g.monto),
      descripcion: g.descripcion ?? "",
      proveedor: g.proveedor ?? "",
      fecha: formatearFecha(g.fecha),
      comprobante: g.comprobante_nombre,
      anulado: g.anulado,
    }));

    return [...movIng, ...movGas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ingresos, gastos]);

  const filtrados = useMemo(() => {
    return movimientos.filter(
      (m) =>
        (filtroTipo === "Todos" || m.tipo === filtroTipo) &&
        `${m.categoria} ${m.proveedor} ${m.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [movimientos, filtroTipo, busqueda]);

  const totalIngresos = ingresos
    .filter((i) => !i.anulado)
    .reduce((s, i) => s + Number(i.monto), 0);
  const totalGastos = gastos
    .filter((g) => !g.anulado)
    .reduce((s, g) => s + Number(g.monto), 0);

  function abrirModal(t: Tipo) {
    setTipo(t);
    setMonto("");
    setDescripcion("");
    setProveedor("");
    setMetodo("efectivo");
    setComprobante(null);
    setError("");
    setIdCategoria("");
    setAviso("");
    setModalOpen(true);
  }

  function cerrarModal() {
    if (!guardando) setModalOpen(false);
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
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El comprobante no debe superar los 5 MB.");
      setComprobante(null);
      e.target.value = "";
      return;
    }
    setError("");
    setComprobante(file);
  }

  async function guardarMovimiento() {
    setError("");

    const montoTexto = monto.trim();
    if (!idCategoria) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!montoTexto) {
      setError("Ingresa el monto.");
      return;
    }
    if (!MONTO_REGEX.test(montoTexto)) {
      setError("El monto debe ser un número válido con máximo 2 decimales.");
      return;
    }
    const montoNum = Number(montoTexto);
    if (montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    if (descripcion.trim().length > MAX_TEXTO) {
      setError(`La descripción admite como máximo ${MAX_TEXTO} caracteres.`);
      return;
    }
    if (tipo === "Gasto" && proveedor.trim().length > MAX_TEXTO) {
      setError(`El proveedor o beneficiario admite como máximo ${MAX_TEXTO} caracteres.`);
      return;
    }

    try {
      setGuardando(true);

      const formData = new FormData();
      formData.append("monto", montoNum.toFixed(2));
      formData.append("id_categoria", idCategoria);
      if (descripcion.trim()) formData.append("descripcion", descripcion.trim());
      formData.append("metodo", metodo);
      if (tipo === "Gasto" && proveedor.trim()) {
        formData.append("proveedor", proveedor.trim());
      }
      if (comprobante) {
        formData.append("comprobante", comprobante);
      }

      const endpoint = tipo === "Ingreso" ? "/ingresos" : "/gastos";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const data = await leerRespuesta(res);

      if (!res.ok) {
        setError(mensajeDe(data, `No se pudo registrar el ${tipo.toLowerCase()}.`));
        return;
      }

      // Recargar solo el tipo que se acaba de crear
      if (tipo === "Ingreso") {
        const r = await fetch(`${API_URL}/ingresos`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const d = await r.json();
        setIngresos(d.ingresos ?? []);
      } else {
        const r = await fetch(`${API_URL}/gastos`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const d = await r.json();
        setGastos(d.gastos ?? []);
      }

      setModalOpen(false);
      // El backend responde p. ej. "Gasto registrado por Bs 150,00. Caja: movimiento C-0012."
      setAviso(mensajeDe(data, `${tipo} registrado correctamente.`));
    } catch (e) {
      setError(`No se pudo conectar con el servidor: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
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

      {errorCarga && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {errorCarga}
        </div>
      )}

      {aviso && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          {aviso}
        </div>
      )}

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
              placeholder="Buscar por categoría, proveedor o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {cargando ? (
          <div className="empty-state">Cargando movimientos…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No se encontraron movimientos con esos filtros.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Detalle</th>
                  <th>Monto</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} style={m.anulado ? { opacity: 0.6 } : undefined}>
                    <td>{m.fecha}</td>
                    <td>
                      <span
                        className={`status ${
                          m.anulado ? "status-danger" : m.tipo === "Ingreso" ? "status-success" : "status-attention"
                        }`}
                      >
                        <span />
                        {m.anulado ? `${m.tipo} anulado` : m.tipo}
                      </span>
                    </td>
                    <td><span className="tag">{m.categoria}</span></td>
                    <td>
                      {m.proveedor && <strong>{m.proveedor}</strong>}
                      {m.proveedor && m.descripcion && <br />}
                      {m.descripcion}
                      {!m.proveedor && !m.descripcion && <span style={{ color: "#9a918b" }}>—</span>}
                    </td>
                    <td style={m.anulado ? { textDecoration: "line-through" } : undefined}>
                      Bs. {m.monto.toFixed(2)}
                    </td>
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

      <Modal
        open={modalOpen}
        title={tipo === "Ingreso" ? "Registrar ingreso extraordinario" : "Registrar gasto"}
        onClose={cerrarModal}
      >
        <div className="modal-form">
          <div className="form-grid">
            <label className="field">
              <span>Categoría <b>*</b></span>
              <select value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)}>
                <option value="">Selecciona una categoría</option>
                {categoriasFiltradas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {categoriasFiltradas.length === 0 && (
                <small style={NOTA}>No hay categorías activas de tipo {tipo.toLowerCase()}.</small>
              )}
            </label>

            <label className="field">
              <span>Monto (Bs.) <b>*</b></span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
              />
            </label>

            {tipo === "Gasto" && (
              <label className="field">
                <span>Proveedor o beneficiario (opcional)</span>
                <input
                  value={proveedor}
                  maxLength={MAX_TEXTO}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej. Ferretería XYZ"
                />
              </label>
            )}

            <label className="field">
              <span>Método de pago</span>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
              </select>
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Descripción (opcional)</span>
              <input
                value={descripcion}
                maxLength={MAX_TEXTO}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={tipo === "Gasto" ? "Ej. Reparación de bomba de agua" : "Ej. Alquiler del salón de eventos"}
              />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Comprobante (opcional)</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ paddingTop: 12 }} />
              <small style={NOTA}>{comprobante ? comprobante.name : "PDF, JPG o PNG, máximo 5 MB."}</small>
            </label>
          </div>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            {tipo === "Ingreso"
              ? "Se registrará con la fecha de hoy como entrada en caja. La caja debe estar abierta."
              : "Se registrará con la fecha de hoy como salida de caja. La caja debe estar abierta y tener saldo suficiente."}
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={cerrarModal} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={guardarMovimiento} disabled={guardando}>
              {guardando ? "Guardando…" : tipo === "Ingreso" ? "Registrar ingreso" : "Registrar gasto"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
