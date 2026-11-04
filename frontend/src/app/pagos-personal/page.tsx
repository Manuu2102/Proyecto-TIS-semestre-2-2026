"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { CheckIcon, FileIcon, PlusIcon, SearchIcon, WalletIcon } from "../../../components/Icons";
import { fechaCorta, formatoBs, hoyISO, normalizar, soloDecimal } from "../../../lib/formato";
import {
  COMPROBANTE_MAX_MB, conceptoSueldo, limiteAnticipo, listarEmpleados,
  listarMovimientosPago, registrarMovimientoPago,
} from "../../../lib/personal";
import type {
  Comprobante, Empleado, EstadoMovimiento, MetodoPago, MovimientoPago,
  NuevoMovimientoPago, TipoMovimiento,
} from "../../../lib/personal";

const POR_PAGINA = 8;

type Filtro = "Todos" | TipoMovimiento;
const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "Todos", etiqueta: "Todos" },
  { valor: "Pago", etiqueta: "Pagos" },
  { valor: "Anticipo", etiqueta: "Anticipos" },
];

const claseEstado: Record<EstadoMovimiento, string> = {
  "Pagado": "status status-success",
  "Por descontar": "status status-attention",
  "Descontado": "status status-neutral",
};

export default function PagosPersonalPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoPago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [formTipo, setFormTipo] = useState<TipoMovimiento | null>(null);
  const [verComprobante, setVerComprobante] = useState<Comprobante | null>(null);

  async function recargar() {
    const [emps, movs] = await Promise.all([listarEmpleados(), listarMovimientosPago()]);
    setEmpleados(emps);
    setMovimientos(movs);
  }

  useEffect(() => {
    let vigente = true;
    Promise.all([listarEmpleados(), listarMovimientosPago()])
      .then(([emps, movs]) => {
        if (!vigente) return;
        setEmpleados(emps);
        setMovimientos(movs);
      })
      .catch((e: Error) => vigente && setError(e.message || "No se pudieron cargar los pagos."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(""), 4500);
    return () => clearTimeout(t);
  }, [mensaje]);

  const empleadoPorId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados]);

  // Más recientes primero
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return movimientos
      .filter((m) => filtro === "Todos" || m.tipo === filtro)
      .filter((m) => !q || normalizar(empleadoPorId.get(m.empleadoId)?.nombre ?? "").includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }, [movimientos, filtro, busqueda, empleadoPorId]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Tarjetas del panel principal (se recalculan solas al registrar algo)
  const mesActual = hoyISO().slice(0, 7);
  const pagadoEsteMes = movimientos
    .filter((m) => m.tipo === "Pago" && m.fecha.startsWith(mesActual))
    .reduce((total, m) => total + m.monto, 0);
  const anticiposPorDescontar = movimientos
    .filter((m) => m.tipo === "Anticipo" && m.estado === "Por descontar")
    .reduce((total, m) => total + m.monto, 0);

  /** Devuelve el mensaje de error si falla; null si todo salió bien. */
  async function registrar(datos: NuevoMovimientoPago): Promise<string | null> {
    try {
      await registrarMovimientoPago(datos);
      await recargar();
      // Se limpian filtros para que el nuevo registro se vea en el historial
      setFiltro("Todos");
      setBusqueda("");
      setPagina(1);
      setFormTipo(null);
      setMensaje(datos.tipo === "Pago" ? "Pago realizado con éxito." : "Pago anticipado realizado con éxito.");
      return null;
    } catch (e) {
      return (e as Error).message || "No se pudo registrar el movimiento.";
    }
  }

  return (
    <DashboardLayout active="pagos-personal">
      <div className="page-header">
        <div>
          <p className="eyebrow">PERSONAL</p>
          <h1>Pagos a empleados</h1>
          <p>Registra sueldos y anticipos, y consulta el historial de remuneraciones.</p>
        </div>
        <div className="personal-actions">
          <button className="btn btn-secondary" onClick={() => setFormTipo("Anticipo")} disabled={cargando}>
            <PlusIcon size={17} />
            Registrar pago anticipado
          </button>
          <button className="btn btn-primary" onClick={() => setFormTipo("Pago")} disabled={cargando}>
            <PlusIcon size={17} />
            Registrar pago
          </button>
        </div>
      </div>

      {mensaje && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>{mensaje}</div>}
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><WalletIcon size={20} /></div>
          <div><span>Sueldos pagados este mes</span><strong>{cargando ? "…" : formatoBs(pagadoEsteMes)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon attention"><CheckIcon size={20} /></div>
          <div><span>Anticipos por descontar</span><strong>{cargando ? "…" : formatoBs(anticiposPorDescontar)}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><FileIcon size={20} /></div>
          <div><span>Movimientos registrados</span><strong>{cargando ? "…" : movimientos.length}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Historial de pagos</h3>
            <p>{filtrados.length} {filtrados.length === 1 ? "registro encontrado" : "registros encontrados"}</p>
          </div>
        </div>

        <div className="pp-filtros">
          <div className="role-tabs" role="tablist" aria-label="Filtrar por tipo">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="tab"
                aria-selected={filtro === f.valor}
                className={`role-tab ${filtro === f.valor ? "active" : ""}`}
                onClick={() => { setFiltro(f.valor); setPagina(1); }}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar por nombre del empleado..."
              aria-label="Buscar por nombre del empleado"
            />
          </div>
        </div>

        {cargando ? (
          <div className="state-box">Cargando pagos…</div>
        ) : filtrados.length === 0 ? (
          <div className="state-box">No hay registros que coincidan con los filtros o la búsqueda realizada.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((m) => {
                    const emp = empleadoPorId.get(m.empleadoId);
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{emp?.nombre ?? "Empleado eliminado"}</strong>
                          <small>{emp?.cargo ?? "—"}</small>
                        </td>
                        <td>{m.concepto}</td>
                        <td><span className="tag">{m.tipo}</span></td>
                        <td className="money">{formatoBs(m.monto)}</td>
                        <td>{fechaCorta(m.fecha)}</td>
                        <td>{m.metodo}</td>
                        <td><span className={claseEstado[m.estado]}><span />{m.estado}</span></td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => setVerComprobante(m.comprobante)}>
                            <FileIcon size={14} />
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{(paginaActual - 1) * POR_PAGINA + visibles.length} de {filtrados.length}
              </span>
              {totalPaginas > 1 && (
                <div className="pagination-pages">
                  <button className="page-btn" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
                    Anterior
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      className={`page-btn ${n === paginaActual ? "active" : ""}`}
                      aria-current={n === paginaActual ? "page" : undefined}
                      onClick={() => setPagina(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button className="page-btn" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Modal
        open={formTipo !== null}
        title={formTipo === "Anticipo" ? "Registrar pago anticipado" : "Registrar pago"}
        onClose={() => setFormTipo(null)}
      >
        {formTipo && (
          <PagoFormulario
            tipo={formTipo}
            empleados={empleados.filter((e) => e.activo)}
            movimientos={movimientos}
            onGuardar={registrar}
            onCancel={() => setFormTipo(null)}
          />
        )}
      </Modal>

      <Modal open={verComprobante !== null} title="Comprobante de pago" onClose={() => setVerComprobante(null)}>
        {verComprobante && (
          <div className="modal-form">
            <p className="field-hint" style={{ marginTop: 0 }}>{verComprobante.nombre}</p>
            {verComprobante.tipo.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={verComprobante.url} alt={`Comprobante ${verComprobante.nombre}`} style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
            ) : (
              <iframe src={verComprobante.url} title={`Comprobante ${verComprobante.nombre}`} style={{ width: "100%", height: "65vh", border: "1px solid var(--border)", borderRadius: 10 }} />
            )}
            <div className="modal-actions">
              <a className="btn btn-secondary" href={verComprobante.url} target="_blank" rel="noopener noreferrer">
                Abrir en otra pestaña
              </a>
              <button type="button" className="btn btn-primary" onClick={() => setVerComprobante(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

// =====================================================================
// Formulario de pago / anticipo (con pantalla de confirmación)
// =====================================================================

type Valores = { empleadoId: string; monto: string; fecha: string; metodo: MetodoPago | "" };
type Errores = Partial<Record<"empleadoId" | "monto" | "fecha" | "metodo" | "archivo", string>>;

function PagoFormulario({
  tipo,
  empleados,
  movimientos,
  onGuardar,
  onCancel,
}: {
  tipo: TipoMovimiento;
  empleados: Empleado[];
  movimientos: MovimientoPago[];
  onGuardar: (datos: NuevoMovimientoPago) => Promise<string | null>;
  onCancel: () => void;
}) {
  const esAnticipo = tipo === "Anticipo";
  const [hoy] = useState(hoyISO);
  const [f, setF] = useState<Valores>({ empleadoId: "", monto: "", fecha: hoy, metodo: "" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [paso, setPaso] = useState<"datos" | "confirmar">("datos");
  const [guardando, setGuardando] = useState(false);

  const empleado = empleados.find((e) => String(e.id) === f.empleadoId);
  const limite = empleado ? limiteAnticipo(empleado.sueldo) : 0;
  const pendientes = empleado
    ? movimientos.filter((m) => m.empleadoId === empleado.id && m.tipo === "Anticipo" && m.estado === "Por descontar")
    : [];
  const totalPendiente = pendientes.reduce((t, m) => t + m.monto, 0);

  function cambiar(campo: keyof Valores, valor: string) {
    setF((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: undefined }));
    setErrorGeneral("");
  }

  function elegirEmpleado(id: string) {
    const emp = empleados.find((e) => String(e.id) === id);
    // En un pago de sueldo se propone el sueldo mensual; en un anticipo el monto se deja vacío
    setF((actual) => ({ ...actual, empleadoId: id, monto: emp && !esAnticipo ? String(emp.sueldo) : "" }));
    setErrores((actual) => ({ ...actual, empleadoId: undefined, monto: undefined }));
    setErrorGeneral("");
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    setErrorGeneral("");
    if (!elegido) return;
    if (!(elegido.type.startsWith("image/") || elegido.type === "application/pdf")) {
      setArchivo(null);
      setErrores((a) => ({ ...a, archivo: "El comprobante debe ser una imagen o un PDF." }));
    } else if (elegido.size > COMPROBANTE_MAX_MB * 1024 * 1024) {
      setArchivo(null);
      setErrores((a) => ({ ...a, archivo: `El archivo supera los ${COMPROBANTE_MAX_MB} MB.` }));
    } else {
      setArchivo(elegido);
      setErrores((a) => ({ ...a, archivo: undefined }));
    }
  }

  function validar(): Errores {
    const e: Errores = {};
    if (!empleado) e.empleadoId = "Selecciona al empleado.";

    const monto = Number(f.monto);
    if (!f.monto.trim()) e.monto = "El monto es obligatorio.";
    else if (!Number.isFinite(monto) || monto <= 0) e.monto = "El monto debe ser mayor a 0.";
    else if (esAnticipo && empleado && Math.round(monto * 100) > Math.round(limite * 100))
      e.monto = `No puede superar el 50% del sueldo mensual (${formatoBs(limite)}).`;

    if (!f.fecha) e.fecha = "La fecha es obligatoria.";
    else if (f.fecha > hoy) e.fecha = "La fecha no puede ser futura.";

    if (!f.metodo) e.metodo = "Selecciona el método de pago.";
    if (!archivo) e.archivo = errores.archivo ?? "El comprobante de pago es obligatorio.";
    return e;
  }

  function continuar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const encontrados = validar();
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErrorGeneral("Completa los datos obligatorios antes de continuar.");
      return;
    }
    setErrorGeneral("");
    setPaso("confirmar");
  }

  async function confirmar() {
    if (!empleado || !archivo || !f.metodo) return;
    setGuardando(true);
    const falla = await onGuardar({
      empleadoId: empleado.id,
      tipo,
      monto: Number(f.monto),
      fecha: f.fecha,
      metodo: f.metodo,
      archivo,
    });
    setGuardando(false);
    if (falla) setErrorGeneral(falla);
  }

  // ---------- Pantalla de confirmación ----------
  if (paso === "confirmar" && empleado && archivo) {
    return (
      <div className="modal-form">
        <div className="confirm-body" style={{ padding: 0 }}>
          {esAnticipo ? "Vas a registrar el siguiente anticipo." : "Vas a registrar el siguiente pago."} Revisa los datos antes de confirmar.
          <div className="confirm-box">
            <div><span>Empleado</span><strong>{empleado.nombre}</strong></div>
            <div><span>Cargo</span><strong>{empleado.cargo}</strong></div>
            <div><span>Concepto</span><strong>{esAnticipo ? "Anticipo de sueldo" : conceptoSueldo(f.fecha)}</strong></div>
            <div><span>Fecha</span><strong>{fechaCorta(f.fecha)}</strong></div>
            <div><span>Método de pago</span><strong>{f.metodo}</strong></div>
            <div><span>Comprobante</span><strong>{archivo.name}</strong></div>
            <div><span>{esAnticipo ? "Monto del anticipo" : "Monto a pagar"}</span><span>{formatoBs(Number(f.monto))}</span></div>
          </div>
        </div>

        {errorGeneral && <div className="alert alert-error" role="alert" style={{ marginTop: 14 }}>{errorGeneral}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" style={{ marginRight: "auto" }} onClick={() => setPaso("datos")} disabled={guardando}>
            Volver a editar
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Formulario ----------
  return (
    <form onSubmit={continuar} className="modal-form" noValidate>
      <div className="form-grid">
        <Campo label="Empleado" error={errores.empleadoId} className="span-2">
          <select value={f.empleadoId} onChange={(e) => elegirEmpleado(e.target.value)}>
            <option value="">{empleados.length === 0 ? "No hay empleados activos" : "Selecciona un empleado"}</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre} — {e.cargo}</option>
            ))}
          </select>
        </Campo>

        {empleado && (
          <>
            <Campo label="Sueldo mensual registrado" required={false}>
              <input value={formatoBs(empleado.sueldo)} disabled readOnly />
            </Campo>

            {esAnticipo ? (
              <Campo label="Monto máximo del anticipo (50%)" required={false}>
                <input value={formatoBs(limite)} disabled readOnly />
              </Campo>
            ) : (
              <Campo label="Concepto" required={false}>
                <input value={conceptoSueldo(f.fecha || hoy)} disabled readOnly />
              </Campo>
            )}

            {!esAnticipo && (
              <div className="span-2">
                {pendientes.length > 0 ? (
                  <div className="alert alert-warning">
                    Este empleado tiene {pendientes.length} {pendientes.length === 1 ? "anticipo pendiente" : "anticipos pendientes"} de descuento por un total de <strong>{formatoBs(totalPendiente)}</strong>.
                  </div>
                ) : (
                  <div className="alert alert-info">Este empleado no tiene anticipos pendientes de descuento.</div>
                )}
              </div>
            )}
          </>
        )}

        <Campo label={esAnticipo ? "Monto del anticipo (Bs)" : "Monto del pago (Bs)"} error={errores.monto} hint={esAnticipo && empleado ? `Máximo permitido: ${formatoBs(limite)}` : undefined}>
          <input inputMode="decimal" value={f.monto} onChange={(e) => cambiar("monto", soloDecimal(e.target.value))} placeholder="Ej. 1500.00" autoComplete="off" />
        </Campo>

        <Campo label="Fecha" error={errores.fecha}>
          <input type="date" value={f.fecha} max={hoy} onChange={(e) => cambiar("fecha", e.target.value)} />
        </Campo>

        <Campo label="Método de pago" error={errores.metodo} className="span-2">
          <select value={f.metodo} onChange={(e) => cambiar("metodo", e.target.value)}>
            <option value="">Selecciona un método</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </Campo>

        <div className={`field span-2 ${errores.archivo ? "has-error" : ""}`}>
          <span>Comprobante de pago <b>*</b></span>
          <label className={`dropzone ${errores.archivo ? "has-error" : ""}`}>
            <input type="file" accept="image/*,application/pdf" onChange={elegirArchivo} style={{ display: "none" }} />
            {archivo ? "Cambiar archivo" : "Haz clic para adjuntar el comprobante"}
            <small>Obligatorio · imagen o PDF · máximo {COMPROBANTE_MAX_MB} MB</small>
          </label>
          {archivo && (
            <div className="file-list">
              <div className="file-item">
                <FileIcon size={15} />
                <span>{archivo.name}</span>
                <small>{(archivo.size / 1024).toFixed(0)} KB</small>
              </div>
            </div>
          )}
          {errores.archivo && <span className="field-error">{errores.archivo}</span>}
        </div>
      </div>

      {errorGeneral && <div className="alert alert-error" role="alert">{errorGeneral}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Continuar</button>
      </div>
    </form>
  );
}

function Campo({
  label,
  error,
  hint,
  required = true,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "has-error" : ""} ${className}`}>
      <span>{label} {required && <b>*</b>}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}