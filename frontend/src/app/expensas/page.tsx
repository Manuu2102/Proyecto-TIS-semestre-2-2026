"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  PlusIcon,
  WalletIcon,
  CheckIcon,
  BuildingIcon,
} from "../../../components/Icons";

type Categoria = "A" | "B" | "C";
type Estado = "Pendiente" | "Pagado";

type Concepto = {
  concepto: string;
  monto: number;
};

type Departamento = {
  numero: number;
  categoria: Categoria | null;
  ocupado: boolean;
};

type Expensa = {
  id: string;
  departamento: number;
  categoria: Categoria;
  periodo: string;
  desglose: Concepto[];
  total: number;
  fechaLimite: string;
  estado: Estado;
};

type Omitido = {
  departamento: number;
  motivo: string;
};

type ExtraDepartamento = {
  id: string;
  departamento: number;
  concepto: string;
  monto: number;
};

type Resultado = {
  periodo: string;
  generadas: Expensa[];
  omitidos: Omitido[];
  yaExistian: number;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ANIO_INICIO = 2025;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones?.headers,
    },
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    const mensaje = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join(". ")
      : cuerpo?.message;
    throw new Error(mensaje || "No se pudo completar la operación.");
  }

  return res.json();
}

// BACKEND: GET /expensas/departamentos
const cargarDepartamentosApi = () =>
  pedir<Departamento[]>("/expensas/departamentos");

// BACKEND: GET /expensas/mensuales
const cargarExpensasApi = () => pedir<Expensa[]>("/expensas/mensuales");

// BACKEND: GET /expensas/tarifas → conceptos y montos de cada categoría (tabla expensa)
const cargarTarifasApi = () => pedir<Record<Categoria, Concepto[]>>("/expensas/tarifas");

// BACKEND: POST /expensas/extras
function generarExpensasApi(
  periodo: string,
  extras: ExtraDepartamento[]
): Promise<Resultado> {
  return pedir<Resultado>("/expensas/extras", {
    method: "POST",
    body: JSON.stringify({
      periodo,
      extras: extras.map(({ departamento, concepto, monto }) => ({
        departamento,
        concepto,
        monto,
      })),
    }),
  });
}


// DATOS SIMULADOS: BACKEND GET /expensas/tarifas
const TARIFAS: Record<Categoria, Concepto[]> = {
  A: [
    { concepto: "Mantenimiento general", monto: 180 },
    { concepto: "Limpieza de áreas comunes", monto: 70 },
    { concepto: "Seguridad", monto: 50 },
  ],
  B: [
    { concepto: "Mantenimiento general", monto: 230 },
    { concepto: "Limpieza de áreas comunes", monto: 90 },
    { concepto: "Seguridad", monto: 60 },
  ],
  C: [
    { concepto: "Mantenimiento general", monto: 280 },
    { concepto: "Limpieza de áreas comunes", monto: 100 },
    { concepto: "Seguridad", monto: 70 },
  ],
};

// DATOS SIMULADOS: BACKEND GET /departamentos
const DEPARTAMENTOS: Departamento[] = [
  { numero: 101, categoria: "A", ocupado: true },
  { numero: 102, categoria: "A", ocupado: true },
  { numero: 103, categoria: "A", ocupado: true },
  { numero: 201, categoria: "B", ocupado: true },
  { numero: 202, categoria: "B", ocupado: true },
  { numero: 203, categoria: "B", ocupado: true },
  { numero: 301, categoria: "C", ocupado: true },
  { numero: 302, categoria: "C", ocupado: true },
  { numero: 401, categoria: null, ocupado: true },
  { numero: 402, categoria: "B", ocupado: false },
];

const ELEGIBLES = DEPARTAMENTOS.filter(
  (d): d is Departamento & { categoria: Categoria } =>
    d.ocupado && d.categoria !== null
);

function totalDe(conceptos: Concepto[]) {
  return conceptos.reduce((suma, concepto) => suma + concepto.monto, 0);
}

function ultimoDia(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  const dia = new Date(anio, mes, 0).getDate();

  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function crear(
  numero: number,
  categoria: Categoria,
  periodo: string,
  estado: Estado,
  tarifas: Record<Categoria, Concepto[]>,
  extras: ExtraDepartamento[] = []
): Expensa {
  const desglose = [
    ...tarifas[categoria].map((concepto) => ({ ...concepto })),
    ...extras
      .filter((extra) => extra.departamento === numero)
      .map((extra) => ({
        concepto: extra.concepto,
        monto: extra.monto,
      })),
  ];

  return {
    id: `${periodo}-${numero}`,
    departamento: numero,
    categoria,
    periodo,
    desglose,
    total: totalDe(desglose),
    fechaLimite: ultimoDia(periodo),
    estado,
  };
}

// Suma al desglose y al total los gastos adicionales (agua, extras) que la
// respuesta no haya incluido ya (misma descripción e importe).
function aplicarExtras(
  lista: Expensa[],
  extras: ExtraDepartamento[]
): Expensa[] {
  return lista.map((e) => {
    const faltan = extras.filter(
      (x) =>
        x.departamento === e.departamento &&
        !e.desglose.some(
          (c) => c.concepto === x.concepto && c.monto === x.monto
        )
    );
    if (faltan.length === 0) return e;

    const desglose = [
      ...e.desglose,
      ...faltan.map(({ concepto, monto }) => ({ concepto, monto })),
    ];
    return { ...e, desglose, total: totalDe(desglose) };
  });
}

// TEMPORAL (solo visual, no se envía al backend): si a una expensa le faltan
// los conceptos fijos de su categoría, se anteponen al desglose y se recalcula
// el total. Borrar cuando el backend devuelva las expensas completas.
function completarTarifas(
  lista: Expensa[],
  tarifas: Record<Categoria, Concepto[]>
): Expensa[] {
  return lista.map((e) => {
    const fijos = tarifas[e.categoria];
    if (!fijos) return e;

    const faltan = fijos.filter(
      (f) => !e.desglose.some((c) => c.concepto === f.concepto)
    );
    if (faltan.length === 0) return e;

    const desglose = [...faltan.map((f) => ({ ...f })), ...e.desglose];
    return { ...e, desglose, total: totalDe(desglose) };
  });
}

// DATOS SIMULADOS: BACKEND GET /expensas?periodo=YYYY-MM
const EXPENSAS_INICIALES: Expensa[] = [
  ...ELEGIBLES.map((d) =>
    crear(d.numero, d.categoria, "2026-08", "Pagado", TARIFAS)
  ),
  ...ELEGIBLES.filter((d) => d.numero < 301).map((d) =>
    crear(
      d.numero,
      d.categoria,
      "2026-09",
      [101, 102, 201].includes(d.numero) ? "Pagado" : "Pendiente",
      TARIFAS
    )
  ),
];

// SIMULACIÓN DEL SERVICIO. El backend implementará POST /expensas/generar.

function bs(monto: number) {
  return (
    "Bs. " +
    monto.toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function nombrePeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

function fecha(iso: string) {
  return iso.split("-").reverse().join("/");
}

function plural(numero: number, singular: string, pluralTexto: string) {
  return numero === 1 ? singular : pluralTexto;
}

const ESTADO_CLASE: Record<Estado, string> = {
  Pendiente: "status-warning",
  Pagado: "status-success",
};

const AVISO = {
  background: "#fbf1df",
  color: "#a16d25",
  border: "1px solid #f0dcb4",
};

function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}

export default function ExpensasPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");

  const [expensas, setExpensas] = useState<Expensa[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);

  // Mismo nombre que antes, para no tocar el JSX
  // Igual que el backend: se cobra a todo departamento activo con tipo A, B o C,
  // esté ocupado o no (la expensa la paga el propietario aunque la unidad esté libre)
  const ELEGIBLES = departamentos.filter(
    (d): d is Departamento & { categoria: Categoria } => d.categoria !== null
  );

  // Tarifas editables por categoría.
  const [tarifasEditables, setTarifasEditables] = useState<
    Record<Categoria, Concepto[]>
  >(() => ({
    A: TARIFAS.A.map((c) => ({ ...c })),
    B: TARIFAS.B.map((c) => ({ ...c })),
    C: TARIFAS.C.map((c) => ({ ...c })),
  }));

  // Gastos extraordinarios (agua, extras) para la generación del período seleccionado.
  const [extras, setExtras] = useState<ExtraDepartamento[]>([]);
  const [extraDepartamento, setExtraDepartamento] = useState("");
  const [extraConcepto, setExtraConcepto] = useState("");
  const [extraMonto, setExtraMonto] = useState("");

  const [tarifaCategoriaActiva, setTarifaCategoriaActiva] =
    useState<Categoria>("A");
  const [tarifaConcepto, setTarifaConcepto] = useState("");
  const [tarifaMonto, setTarifaMonto] = useState("");

  // Modal independiente para configurar tarifas
  const [tarifasOpen, setTarifasOpen] = useState(false);
  const [errorTarifa, setErrorTarifa] = useState("");

  const [periodoVista, setPeriodoVista] = useState("2026-09");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [paso, setPaso] = useState<"form" | "confirmar">("form");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Las tarifas reales vienen del backend; se cargan antes que las expensas
    // porque completan su desglose
    const cargar = async () => {
      const tarifas = await cargarTarifasApi();
      setTarifasEditables(tarifas);
      const data = await cargarExpensasApi();
      setExpensas(completarTarifas(data, tarifas));
      const ultimo = Array.from(new Set(data.map((e) => e.periodo)))
        .sort()
        .pop();
      if (ultimo) setPeriodoVista(ultimo);
    };
    cargar().catch(console.error);

    cargarDepartamentosApi().then(setDepartamentos).catch(console.error);
  }, []);

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  const anios = Array.from(
    { length: Math.max(anioActual - ANIO_INICIO + 1, 1) },
    (_, i) => ANIO_INICIO + i
  );

  const mesFuturo = (numeroMes: number) =>
    anio !== "" &&
    Number(anio) === anioActual &&
    numeroMes > mesActual;

  const periodoValido =
    mes !== "" &&
    anio !== "" &&
    Number(anio) >= ANIO_INICIO &&
    Number(anio) <= anioActual &&
    !mesFuturo(Number(mes));

  const periodoSel = periodoValido
    ? `${anio}-${mes.padStart(2, "0")}`
    : "";

  const existentesSel = periodoSel
    ? expensas.filter((e) => e.periodo === periodoSel).length
    : 0;

  // Departamentos elegibles que aún no tienen expensa en el período elegido.
  const faltantes = periodoSel
    ? ELEGIBLES.filter(
        (d) =>
          !expensas.some(
            (e) => e.periodo === periodoSel && e.departamento === d.numero
          )
      ).length
    : 0;

  // Se puede continuar si hay expensas por crear o gastos adicionales por aplicar.
  const puedeContinuar = periodoValido && (faltantes > 0 || extras.length > 0);

  const periodos = Array.from(
    new Set(expensas.map((e) => e.periodo))
  ).sort().reverse();

  const lista = expensas.filter((e) => e.periodo === periodoVista);
  const montoTotal = lista.reduce((suma, e) => suma + e.total, 0);
  const pendientes = lista.filter((e) => e.estado === "Pendiente").length;

  function abrirModal() {
    setExtras([]);
    setExtraDepartamento("");
    setExtraConcepto("");
    setExtraMonto("");
    setPaso("form");
    setMes("");
    setAnio("");
    setError("");
    setModalOpen(true);
  }

  function cerrarModal() {
    if (generando) return;

    setModalOpen(false);
    setPaso("form");
    setMes("");
    setAnio("");
    setError("");
    setExtras([]);
    setExtraDepartamento("");
    setExtraConcepto("");
    setExtraMonto("");
  }

  function abrirTarifas() {
    setTarifaConcepto("");
    setTarifaMonto("");
    setErrorTarifa("");
    setTarifasOpen(true);
  }

  function cerrarTarifas() {
    setTarifasOpen(false);
    setTarifaConcepto("");
    setTarifaMonto("");
    setErrorTarifa("");
  }

  function cambiarAnio(valor: string) {
    setAnio(valor);

    if (
      valor !== "" &&
      Number(valor) === anioActual &&
      Number(mes) > mesActual
    ) {
      setMes("");
    }

    setError("");
  }

  function actualizarTarifa() {
    const importe = Number(tarifaMonto);

    if (
      !tarifaConcepto ||
      tarifaMonto.trim() === "" ||
      !Number.isFinite(importe) ||
      importe < 0
    ) {
      setErrorTarifa("Introduce un importe válido para actualizar la tarifa.");
      return;
    }

    setTarifasEditables((prev) => ({
      ...prev,
      [tarifaCategoriaActiva]: prev[tarifaCategoriaActiva].map((c) =>
        c.concepto === tarifaConcepto ? { ...c, monto: importe } : c
      ),
    }));

    setTarifaConcepto("");
    setTarifaMonto("");
    setErrorTarifa("");
  }

  function agregarExtra() {
    const importe = Number(extraMonto);

    if (
      !extraDepartamento ||
      !extraConcepto.trim() ||
      extraMonto.trim() === "" ||
      !Number.isFinite(importe) ||
      importe <= 0
    ) {
      setError("Completa el departamento, el concepto y un importe mayor que cero.");
      return;
    }

    setExtras((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        departamento: Number(extraDepartamento),
        concepto: extraConcepto.trim(),
        monto: importe,
      },
    ]);

    setExtraDepartamento("");
    setExtraConcepto("");
    setExtraMonto("");
    setError("");
  }

  async function confirmarGeneracion() {
    if (generando || !puedeContinuar) return;

    setGenerando(true);
    setError("");

    try {
      const res = await generarExpensasApi(periodoSel, extras);

      // Agua / extras sumados al desglose, y (TEMPORAL) conceptos fijos de la
      // categoría completados en pantalla. Nada de esto se envía al backend.
      const generadas = completarTarifas(
        aplicarExtras(res.generadas, extras),
        tarifasEditables
      );

      // El backend devuelve las filas actualizadas: se reemplazan, no se agregan
      setExpensas((prev) => {
        const ids = new Set(generadas.map((e) => e.id));
        return [...prev.filter((e) => !ids.has(e.id)), ...generadas];
      });

      setPeriodoVista(periodoSel);
      setResultado({ ...res, generadas });
      setModalOpen(false);
      setPaso("form");
      setMes("");
      setAnio("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron generar las expensas. Intenta nuevamente."
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <DashboardLayout active="expensas">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · EXPENSAS</p>
          <h1>Expensas mensuales</h1>
          <p>Genera las expensas de cada período y consulta las ya emitidas.</p>
        </div>

        {esAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={abrirTarifas}
              disabled={generando}
            >
              Configurar tarifas
            </button>
            <button
              className="btn btn-primary"
              onClick={abrirModal}
              disabled={generando}
            >
              <PlusIcon size={16} /> Generar expensas
            </button>
          </div>
        )}
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon">
            <BuildingIcon size={20} />
          </div>
          <div>
            <span>Expensas del período</span>
            <strong>{lista.length}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft">
            <WalletIcon size={20} />
          </div>
          <div>
            <span>Monto total del período</span>
            <strong>{bs(montoTotal)}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon attention">
            <CheckIcon size={20} />
          </div>
          <div>
            <span>Pendientes de pago</span>
            <strong>{pendientes}</strong>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Expensas de {nombrePeriodo(periodoVista)}</h3>
            <p>Los importes emitidos se conservan para su historial.</p>
          </div>

          {periodos.length > 0 && (
            <select
              value={periodoVista}
              onChange={(e) => setPeriodoVista(e.target.value)}
            >
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {nombrePeriodo(p)}
                </option>
              ))}
            </select>
          )}
        </div>

        {resultado && resultado.periodo === periodoVista && (
          <div
            style={{
              padding: "16px 20px 0",
              display: "grid",
              gap: 10,
            }}
          >
            <div className="alert alert-success">
              Se generaron {resultado.generadas.length}{" "}
              {plural(
                resultado.generadas.length,
                "expensa",
                "expensas"
              )}{" "}
              de {nombrePeriodo(resultado.periodo).toLowerCase()}.
              {resultado.yaExistian > 0 &&
                ` Ya existían ${resultado.yaExistian}; solo se generaron las que faltaban.`}
            </div>

            {resultado.omitidos.length > 0 && (
              <div className="alert" style={AVISO}>
                <strong>
                  {resultado.omitidos.length}{" "}
                  {plural(
                    resultado.omitidos.length,
                    "departamento omitido",
                    "departamentos omitidos"
                  )}
                  :
                </strong>

                {resultado.omitidos.map((o) => (
                  <div key={o.departamento}>
                    Dpto. {o.departamento}: {o.motivo}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {lista.length === 0 ? (
          <div className="empty-state">
            Todavía no se generaron expensas para este período.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Categoría</th>
                  <th>Desglose por concepto</th>
                  <th>Monto total</th>
                  <th>Fecha límite</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="tag">Dpto. {e.departamento}</span>
                    </td>
                    <td>{e.categoria}</td>
                    <td>
                      {e.desglose.map((c, indice) => (
                        <div
                          key={`${c.concepto}-${indice}`}
                          style={{ fontSize: 11, color: "#766E69" }}
                        >
                          {c.concepto}: {bs(c.monto)}
                        </div>
                      ))}
                    </td>
                    <td>
                      <strong>{bs(e.total)}</strong>
                    </td>
                    <td>{fecha(e.fechaLimite)}</td>
                    <td>
                      <span className={`status ${ESTADO_CLASE[e.estado]}`}>
                        <span />
                        {e.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL: CONFIGURAR TARIFAS */}
      {esAdmin && (
        <Modal
          open={tarifasOpen}
          title="Tarifas por categoría"
          onClose={cerrarTarifas}
        >
          <div className="modal-form">
            <div className="form-grid">
              <label className="field">
                <span>Categoría</span>
                <select
                  value={tarifaCategoriaActiva}
                  onChange={(e) => {
                    setTarifaCategoriaActiva(e.target.value as Categoria);
                    setTarifaConcepto("");
                    setErrorTarifa("");
                  }}
                >
                  {(["A", "B", "C"] as Categoria[]).map((cat) => (
                    <option key={cat} value={cat}>
                      Categoría {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Concepto a editar</span>
                <select
                  value={tarifaConcepto}
                  onChange={(e) => setTarifaConcepto(e.target.value)}
                >
                  <option value="">Selecciona un concepto</option>
                  {tarifasEditables[tarifaCategoriaActiva].map((c) => (
                    <option key={c.concepto} value={c.concepto}>
                      {c.concepto}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Nuevo importe (Bs.)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tarifaMonto}
                  onChange={(e) => setTarifaMonto(e.target.value)}
                  placeholder="Ej. 200"
                />
              </label>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={
                    !tarifaConcepto ||
                    tarifaMonto.trim() === "" ||
                    !Number.isFinite(Number(tarifaMonto)) ||
                    Number(tarifaMonto) < 0
                  }
                  onClick={actualizarTarifa}
                >
                  Actualizar tarifa
                </button>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Conceptos</th>
                    <th>Total base</th>
                  </tr>
                </thead>
                <tbody>
                  {(["A", "B", "C"] as Categoria[]).map((cat) => (
                    <tr key={cat}>
                      <td>
                        <span className="tag">Categoría {cat}</span>
                      </td>
                      <td>
                        {tarifasEditables[cat].map((c) => (
                          <div
                            key={c.concepto}
                            style={{ fontSize: 11, color: "#766E69" }}
                          >
                            {c.concepto}: {bs(c.monto)}
                          </div>
                        ))}
                      </td>
                      <td>
                        <strong>{bs(totalDe(tarifasEditables[cat]))}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
              Los cambios de tarifa se aplican a las nuevas expensas que se
              generen. Las expensas anteriores conservan sus importes.
            </p>

            {errorTarifa && (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                {errorTarifa}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cerrarTarifas}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: GENERAR EXPENSAS */}
      {esAdmin && (
        <Modal
          open={modalOpen}
          title="Generar expensas mensuales"
          onClose={cerrarModal}
        >
          {paso === "form" ? (
            <div className="modal-form">
              <div className="form-grid">
                <label className="field">
                  <span>Mes <b>*</b></span>
                  <select
                    value={mes}
                    onChange={(e) => {
                      setMes(e.target.value);
                      setError("");
                    }}
                  >
                    <option value="">Selecciona un mes</option>
                    {MESES.map((nombre, i) => (
                      <option
                        key={nombre}
                        value={String(i + 1)}
                        disabled={mesFuturo(i + 1)}
                      >
                        {nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Año <b>*</b></span>
                  <select
                    value={anio}
                    onChange={(e) => cambiarAnio(e.target.value)}
                  >
                    <option value="">Selecciona un año</option>
                    {anios.map((a) => (
                      <option key={a} value={String(a)}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!periodoValido && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#9a918b",
                    marginTop: 8,
                  }}
                >
                  Selecciona el mes y el año para continuar. No se pueden
                  elegir meses futuros.
                </p>
              )}

              {periodoValido && existentesSel > 0 && (
                <div
                  className="alert"
                  style={{ ...AVISO, marginTop: 12 }}
                >
                  {faltantes > 0
                    ? `Ya existen expensas para este período. Solo se generarán ${faltantes} ${plural(faltantes, "expensa", "expensas")} que faltan.`
                    : "Ya existen expensas para todos los departamentos elegibles de este período."}
                </div>
              )}

              <h3 style={{ fontSize: 13, margin: "20px 0 8px" }}>
                Registro de agua y gastos adicionales
              </h3>

              <div className="form-grid">
                <label className="field">
                  <span>Departamento <b>*</b></span>
                  <select
                    value={extraDepartamento}
                    onChange={(e) => setExtraDepartamento(e.target.value)}
                  >
                    <option value="">Selecciona un departamento</option>
                    {ELEGIBLES.map((d) => (
                      <option key={d.numero} value={String(d.numero)}>
                        Dpto. {d.numero} · Categoría {d.categoria}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Descripción del gasto <b>*</b></span>
                  <input
                    value={extraConcepto}
                    onChange={(e) => setExtraConcepto(e.target.value)}
                    maxLength={100}
                    placeholder="Ej. Agua"
                  />
                </label>

                <label className="field">
                  <span>Importe (Bs.) <b>*</b></span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={extraMonto}
                    onChange={(e) => setExtraMonto(e.target.value)}
                    placeholder="Ej. 50"
                  />
                </label>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={agregarExtra}
                    disabled={
                      !extraDepartamento ||
                      !extraConcepto.trim() ||
                      extraMonto.trim() === "" ||
                      !Number.isFinite(Number(extraMonto)) ||
                      Number(extraMonto) <= 0
                    }
                  >
                    <PlusIcon size={16} /> Añadir gasto
                  </button>
                </div>
              </div>

              {extras.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Departamento</th>
                        <th>Concepto</th>
                        <th>Importe</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extras.map((extra) => (
                        <tr key={extra.id}>
                          <td>Dpto. {extra.departamento}</td>
                          <td>{extra.concepto}</td>
                          <td>{bs(extra.monto)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() =>
                                setExtras((prev) =>
                                  prev.filter((e) => e.id !== extra.id)
                                )
                              }
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 style={{ fontSize: 13, margin: "20px 0 8px" }}>
                Vista previa del total por departamento
              </h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Departamento</th>
                      <th>Categoría</th>
                      <th>Tarifa base</th>
                      <th>Agua y extras</th>
                      <th>Total estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ELEGIBLES.map((d) => {
                      const base = totalDe(tarifasEditables[d.categoria]);
                      const extraTotal = extras
                        .filter((e) => e.departamento === d.numero)
                        .reduce((suma, e) => suma + e.monto, 0);

                      return (
                        <tr key={d.numero}>
                          <td>Dpto. {d.numero}</td>
                          <td>{d.categoria}</td>
                          <td>{bs(base)}</td>
                          <td>{bs(extraTotal)}</td>
                          <td>
                            <strong>{bs(base + extraTotal)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
                Cada departamento usa el monto fijo de su categoría. El agua y
                los gastos adicionales se suman únicamente al departamento
                seleccionado. Las expensas anteriores conservan sus importes.
                Para cambiar las tarifas base usa el botón - Configurar
                tarifas.
              </p>

              {error && (
                <div
                  className="alert alert-error"
                  style={{ marginTop: 12 }}
                >
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setError("");
                    setPaso("confirmar");
                  }}
                  disabled={!puedeContinuar}
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-form">
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                Se generarán las expensas de{" "}
                {nombrePeriodo(periodoSel).toLowerCase()}.
              </p>

              <p style={{ fontSize: 12, color: "#766E69", margin: 0 }}>
                {faltantes > 0
                  ? `Se crearán ${faltantes} ${plural(faltantes, "expensa", "expensas")} nuevas. Las expensas ya existentes no se duplicarán.`
                  : "No hay expensas nuevas por crear; se aplicarán los gastos adicionales indicados."}
              </p>

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setPaso("form");
                    setError("");
                  }}
                  disabled={generando}
                >
                  Volver
                </button>

                <button
                  className="btn btn-primary"
                  onClick={confirmarGeneracion}
                  disabled={generando}
                >
                  {generando ? "Generando…" : "Confirmar generación"}
                </button>
              </div>

              {error && (
                <div
                  className="alert alert-error"
                  style={{ marginTop: 12 }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}