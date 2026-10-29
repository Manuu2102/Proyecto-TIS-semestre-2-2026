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

// BACKEND: PUT /expensas/tarifas → cambia el monto de la expensa de la categoría
const actualizarTarifaApi = (categoria: Categoria, monto: number) =>
  pedir<Record<Categoria, Concepto[]>>("/expensas/tarifas", {
    method: "PUT",
    body: JSON.stringify({ categoria, monto }),
  });

// BACKEND: POST /expensas/generar-mes → expensas del mes; 409 si ya estaban generadas
const generarMesApi = (periodo: string) =>
  pedir<Resultado>("/expensas/generar-mes", {
    method: "POST",
    body: JSON.stringify({ periodo }),
  });

// BACKEND: POST /expensas/extras
function registrarExtrasApi(
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

function totalDe(conceptos: Concepto[]) {
  return conceptos.reduce((suma, concepto) => suma + concepto.monto, 0);
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

// Descripción por defecto del formulario de agua
const CONCEPTO_AGUA = "Agua";

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

  const [tarifaCategoriaActiva, setTarifaCategoriaActiva] =
    useState<Categoria>("A");
  // El concepto se puede elegir, pero se ignora: el monto se aplica a la expensa de la categoría
  const [tarifaConcepto, setTarifaConcepto] = useState("");
  const [tarifaMonto, setTarifaMonto] = useState("");
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);

  // Modal independiente para configurar tarifas
  const [tarifasOpen, setTarifasOpen] = useState(false);
  const [errorTarifa, setErrorTarifa] = useState("");

  const [periodoVista, setPeriodoVista] = useState("2026-09");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Modal "Generar expensas" (masivo)
  const [modalOpen, setModalOpen] = useState(false);
  const [paso, setPaso] = useState<"form" | "confirmar">("form");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  // Modal "Registrar agua" (un departamento por vez)
  const [aguaOpen, setAguaOpen] = useState(false);
  const [aguaMes, setAguaMes] = useState("");
  const [aguaAnio, setAguaAnio] = useState("");
  const [extraDepartamento, setExtraDepartamento] = useState("");
  const [extraConcepto, setExtraConcepto] = useState(CONCEPTO_AGUA);
  const [extraMonto, setExtraMonto] = useState("");
  const [aguaGuardando, setAguaGuardando] = useState(false);
  const [aguaError, setAguaError] = useState("");
  const [aguaOk, setAguaOk] = useState("");

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

  // ---------- Generar expensas ----------
  // Solo el mes actual o meses futuros: los meses de años anteriores quedan deshabilitados
  const mesPasado = (numeroMes: number) =>
    anio !== "" &&
    (Number(anio) < anioActual ||
      (Number(anio) === anioActual && numeroMes < mesActual));

  const periodoValido =
    mes !== "" &&
    anio !== "" &&
    Number(anio) >= ANIO_INICIO &&
    Number(anio) <= anioActual &&
    !mesPasado(Number(mes));

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

  const puedeContinuar = periodoValido && faltantes > 0;

  // ---------- Registrar agua ----------
  // Igual que "Generar expensas": solo el mes actual o meses futuros
  const aguaMesPasado = (numeroMes: number) =>
    aguaAnio !== "" &&
    (Number(aguaAnio) < anioActual ||
      (Number(aguaAnio) === anioActual && numeroMes < mesActual));

  const aguaPeriodoValido =
    aguaMes !== "" &&
    aguaAnio !== "" &&
    Number(aguaAnio) >= ANIO_INICIO &&
    Number(aguaAnio) <= anioActual &&
    !aguaMesPasado(Number(aguaMes));

  const aguaPeriodoSel = aguaPeriodoValido
    ? `${aguaAnio}-${aguaMes.padStart(2, "0")}`
    : "";

  const expensasAgua = aguaPeriodoSel
    ? expensas.filter((e) => e.periodo === aguaPeriodoSel)
    : [];

  const importeAgua = Number(extraMonto);
  const importeAguaValido =
    extraMonto.trim() !== "" &&
    Number.isFinite(importeAgua) &&
    importeAgua > 0;

  // El departamento ya tiene un gasto con la misma descripción en ese período
  const yaRegistrado = (numero: number) =>
    expensasAgua.some(
      (e) =>
        e.departamento === numero &&
        e.desglose.some(
          (c) =>
            c.concepto.trim().toLowerCase() ===
            extraConcepto.trim().toLowerCase()
        )
    );

  const puedeRegistrarAgua =
    aguaPeriodoValido &&
    expensasAgua.length > 0 &&
    extraDepartamento !== "" &&
    extraConcepto.trim() !== "" &&
    importeAguaValido &&
    !aguaGuardando;

  const periodos = Array.from(
    new Set(expensas.map((e) => e.periodo))
  ).sort().reverse();

  const lista = expensas.filter((e) => e.periodo === periodoVista);
  const montoTotal = lista.reduce((suma, e) => suma + e.total, 0);
  const pendientes = lista.filter((e) => e.estado === "Pendiente").length;

  function abrirModal() {
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

  function limpiarFormularioAgua() {
    setExtraDepartamento("");
    setExtraConcepto(CONCEPTO_AGUA);
    setExtraMonto("");
  }

  function abrirAgua() {
    limpiarFormularioAgua();
    setAguaMes("");
    setAguaAnio("");
    setAguaError("");
    setAguaOk("");
    setAguaOpen(true);
  }

  function cerrarAgua() {
    if (aguaGuardando) return;

    setAguaOpen(false);
    limpiarFormularioAgua();
    setAguaMes("");
    setAguaAnio("");
    setAguaError("");
    setAguaOk("");
  }

  function cambiarAnio(valor: string) {
    setAnio(valor);

    if (
      valor !== "" &&
      Number(valor) === anioActual &&
      Number(mes) < mesActual
    ) {
      setMes("");
    }

    setError("");
  }

  function cambiarAguaAnio(valor: string) {
    setAguaAnio(valor);

    if (
      valor !== "" &&
      Number(valor) === anioActual &&
      Number(aguaMes) < mesActual
    ) {
      setAguaMes("");
    }

    setExtraDepartamento("");
    setAguaError("");
    setAguaOk("");
  }

  async function actualizarTarifa() {
    const importe = Number(tarifaMonto);

    if (
      tarifaMonto.trim() === "" ||
      !Number.isFinite(importe) ||
      importe <= 0
    ) {
      setErrorTarifa("Introduce un importe válido para actualizar la tarifa.");
      return;
    }

    setGuardandoTarifa(true);
    setErrorTarifa("");
    try {
      setTarifasEditables(await actualizarTarifaApi(tarifaCategoriaActiva, importe));
      setTarifaMonto("");
    } catch (e) {
      setErrorTarifa(
        e instanceof Error ? e.message : "No se pudo actualizar la tarifa."
      );
    } finally {
      setGuardandoTarifa(false);
    }
  }

  // Registra el agua de UN solo departamento (mismo POST /expensas/extras)
  async function registrarAgua() {
    if (!puedeRegistrarAgua) return;

    const numero = Number(extraDepartamento);

    if (yaRegistrado(numero)) {
      setAguaError(
        `El Dpto. ${numero} ya tiene "${extraConcepto.trim()}" registrado en ${nombrePeriodo(aguaPeriodoSel).toLowerCase()}.`
      );
      return;
    }

    const extra: ExtraDepartamento = {
        id: crypto.randomUUID(),
      departamento: numero,
      concepto: extraConcepto.trim(),
      monto: importeAgua,
    };

    setAguaGuardando(true);
    setAguaError("");
    setAguaOk("");

    try {
      const res = await registrarExtrasApi(aguaPeriodoSel, [extra]);

      const generadas = completarTarifas(
        aplicarExtras(res.generadas, [extra]),
        tarifasEditables
      );

      setExpensas((prev) => {
        const ids = new Set(generadas.map((e) => e.id));
        const combinadas = [...prev.filter((e) => !ids.has(e.id)), ...generadas];

        // Si el backend no devolvió la expensa actualizada, se aplica en pantalla
        return combinadas.map((e) =>
          e.periodo === aguaPeriodoSel ? aplicarExtras([e], [extra])[0] : e
        );
      });

      setPeriodoVista(aguaPeriodoSel);
      setAguaOk(
        `Registrado para el Dpto. ${numero}: ${extra.concepto} ${bs(extra.monto)}.`
      );
      limpiarFormularioAgua();
    } catch (e) {
      setAguaError(
        e instanceof Error
          ? e.message
          : "No se pudo registrar el agua. Intenta nuevamente."
      );
    } finally {
      setAguaGuardando(false);
    }
  }

  // Generación masiva: solo tarifas fijas, sin extras
  async function confirmarGeneracion() {
    if (generando || !puedeContinuar) return;

    setGenerando(true);
    setError("");

    try {
      const res = await generarMesApi(periodoSel);

      // (TEMPORAL) conceptos fijos completados en pantalla.
      const generadas = completarTarifas(res.generadas, tarifasEditables);

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
              className="btn btn-secondary"
              onClick={abrirAgua}
              disabled={generando}
            >
              Registrar agua
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
                    guardandoTarifa ||
                    tarifaMonto.trim() === "" ||
                    !Number.isFinite(Number(tarifaMonto)) ||
                    Number(tarifaMonto) <= 0
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

      {/* MODAL: REGISTRAR AGUA (departamento por departamento) */}
      {esAdmin && (
        <Modal open={aguaOpen} title="Registrar agua" onClose={cerrarAgua}>
          <div className="modal-form">
            <div className="form-grid">
              <label className="field">
                <span>Mes <b>*</b></span>
                <select
                  value={aguaMes}
                  onChange={(e) => {
                    setAguaMes(e.target.value);
                    setExtraDepartamento("");
                    setAguaError("");
                    setAguaOk("");
                  }}
                >
                  <option value="">Selecciona un mes</option>
                  {MESES.map((nombre, i) => (
                    <option
                      key={nombre}
                      value={String(i + 1)}
                      disabled={aguaMesPasado(i + 1)}
                    >
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Año <b>*</b></span>
                <select
                  value={aguaAnio}
                  onChange={(e) => cambiarAguaAnio(e.target.value)}
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

            {!aguaPeriodoValido && (
              <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
                Selecciona el mes y el año. No se pueden elegir meses pasados.
              </p>
            )}

            {aguaPeriodoValido && expensasAgua.length === 0 && (
              <div className="alert" style={{ ...AVISO, marginTop: 12 }}>
                Todavía no hay expensas generadas para{" "}
                {nombrePeriodo(aguaPeriodoSel).toLowerCase()}. Primero usa
                &quot;Generar expensas&quot;.
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
                  disabled={!aguaPeriodoValido || expensasAgua.length === 0}
                  onChange={(e) => {
                    setExtraDepartamento(e.target.value);
                    setAguaError("");
                    setAguaOk("");
                  }}
                >
                  <option value="">Selecciona un departamento</option>
                  {ELEGIBLES.filter((d) =>
                    expensasAgua.some((e) => e.departamento === d.numero)
                  ).map((d) => (
                    <option
                      key={`${d.numero}-${d.categoria}`}
                      value={String(d.numero)}
                    >
                      Dpto. {d.numero} · Categoría {d.categoria}
                      {yaRegistrado(d.numero) ? " · ya registrado" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Descripción del gasto <b>*</b></span>
                <input
                  value={extraConcepto}
                  onChange={(e) => {
                    setExtraConcepto(e.target.value);
                    setAguaError("");
                  }}
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
                  onChange={(e) => {
                    setExtraMonto(e.target.value);
                    setAguaError("");
                    setAguaOk("");
                  }}
                  placeholder="Ej. 50"
                />
              </label>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={registrarAgua}
                  disabled={!puedeRegistrarAgua}
                >
                  <PlusIcon size={16} />{" "}
                  {aguaGuardando ? "Guardando…" : "Registrar agua"}
                </button>
              </div>
            </div>

            {aguaOk && (
              <div className="alert alert-success" style={{ marginTop: 12 }}>
                {aguaOk}
              </div>
            )}

            {aguaError && (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                {aguaError}
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

                    // Agua y extras ya registrados en el período (datos reales)
                    const existente = expensasAgua.find(
                      (e) => e.departamento === d.numero
                    );
                    const registrados = existente
                      ? existente.desglose
                          .filter(
                            (c) =>
                              !tarifasEditables[d.categoria].some(
                                (f) => f.concepto === c.concepto
                              )
                          )
                          .reduce((suma, c) => suma + c.monto, 0)
                      : 0;

                    // Lo que se está escribiendo para el departamento elegido
                    const enEdicion =
                      extraDepartamento === String(d.numero) &&
                      importeAguaValido
                        ? importeAgua
                        : 0;

                    const extraTotal = registrados + enEdicion;

                    return (
                      <tr key={`${d.numero}-${d.categoria}`}>
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
              El agua se registra de a un departamento por vez y se suma
              únicamente al departamento seleccionado. Las expensas anteriores
              conservan sus importes.
            </p>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={cerrarAgua}
                disabled={aguaGuardando}
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: GENERAR EXPENSAS (masivo) */}
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
                        disabled={mesPasado(i + 1)}
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
                  elegir meses pasados.
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

              <p style={{ fontSize: 11, color: "#9a918b", marginTop: 8 }}>
                Cada departamento usa el monto fijo de su categoría. El agua se
                registra después, departamento por departamento, con el botón
                &quot;Registrar agua&quot;. Para cambiar las tarifas base usa
                &quot;Configurar tarifas&quot;.
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
                {`Se crearán ${faltantes} ${plural(faltantes, "expensa", "expensas")} nuevas. Las expensas ya existentes no se duplicarán.`}
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