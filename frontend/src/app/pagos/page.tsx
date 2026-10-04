"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  CreditCardIcon,
  SettingsIcon,
  WalletIcon,
  CheckIcon,
  PlusIcon,
} from "../../../components/Icons";

type ExpensaDepto = {
  departamento: string;
  periodo: string;
  monto: number;
  pagado: boolean;
  fechaPago: string | null;
  pagoAnticipado: boolean;
  anticipoAplicado: number;
};

type ExpensaDeptoCalculada = ExpensaDepto & {
  atraso: number;
  mora: number;
  saldo: number;
};

type ReglaMora = {
  porcentaje: number;
  diasGracia: number;
};

type FiltroEstado = "Todos" | "Pendientes" | "En mora" | "Pagados";

// Anticipo real, independiente de una expensa ya generada.
// Se guarda aparte y se aplica al período futuro que corresponda.
type Anticipo = {
  id: number;
  departamento: string;
  monto: number;
  periodoAplicado: string;
  fechaRegistro: string;
};

const PERIODOS = ["2026-07", "2026-08", "2026-09"];

const DEPARTAMENTOS = ["A-101", "A-202", "B-301", "B-402"];

const expensasPorPeriodoInicial: Record<string, ExpensaDepto[]> = {
  "2026-07": [
    {
      departamento: "A-101",
      periodo: "2026-07",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-07-05",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "A-202",
      periodo: "2026-07",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-07-09",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-301",
      periodo: "2026-07",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-07-08",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-402",
      periodo: "2026-07",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-06-30",
      pagoAnticipado: true,
      anticipoAplicado: 0,
    },
  ],

  "2026-08": [
    {
      departamento: "A-101",
      periodo: "2026-08",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-07-28",
      pagoAnticipado: true,
      anticipoAplicado: 0,
    },
    {
      departamento: "A-202",
      periodo: "2026-08",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-08-07",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-301",
      periodo: "2026-08",
      monto: 1280,
      pagado: false,
      fechaPago: null,
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-402",
      periodo: "2026-08",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-08-04",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
  ],

  "2026-09": [
    {
      departamento: "A-101",
      periodo: "2026-09",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-09-03",
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "A-202",
      periodo: "2026-09",
      monto: 1280,
      pagado: false,
      fechaPago: null,
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-301",
      periodo: "2026-09",
      monto: 1280,
      pagado: false,
      fechaPago: null,
      pagoAnticipado: false,
      anticipoAplicado: 0,
    },
    {
      departamento: "B-402",
      periodo: "2026-09",
      monto: 1280,
      pagado: true,
      fechaPago: "2026-08-28",
      pagoAnticipado: true,
      anticipoAplicado: 0,
    },
  ],
};

// Se utiliza la fecha real del sistema para calcular automáticamente la mora.
const HOY = new Date();

function diasDeAtraso(periodo: string, diasGracia: number) {
  const vencimiento = new Date(`${periodo}-10`);

  vencimiento.setDate(vencimiento.getDate() + diasGracia);

  const diff = Math.floor(
    (HOY.getTime() - vencimiento.getTime()) / 86400000
  );

  return diff > 0 ? diff : 0;
}

function nombrePeriodo(periodo: string) {
  return new Date(`${periodo}-01`).toLocaleDateString("es-BO", {
    month: "long",
    year: "numeric",
  });
}

// Calcula el período siguiente al período actual.
function periodoSiguiente(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);

  const fecha = new Date(anio, mes, 1);

  const anioSig = fecha.getFullYear();
  const mesSig = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${anioSig}-${mesSig}`;
}

export default function PagosPage() {
  const [datos, setDatos] = useState(expensasPorPeriodoInicial);

  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);

  const [periodoActivo, setPeriodoActivo] = useState(
    PERIODOS[PERIODOS.length - 1]
  );

  const [busqueda, setBusqueda] = useState("");

  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstado>("Todos");

  const [regla, setRegla] = useState<ReglaMora>({
    porcentaje: 2,
    diasGracia: 5,
  });

  const [modalRegla, setModalRegla] = useState(false);

  const [draftPorcentaje, setDraftPorcentaje] = useState(
    String(regla.porcentaje)
  );

  const [draftDiasGracia, setDraftDiasGracia] = useState(
    String(regla.diasGracia)
  );

  const [errorRegla, setErrorRegla] = useState("");

  const [modalPago, setModalPago] = useState(false);

  // CORRECCIÓN:
  // Ahora el estado reconoce que el objeto contiene
  // atraso, mora y saldo calculados.
  const [pagoDepto, setPagoDepto] =
    useState<ExpensaDeptoCalculada | null>(null);

  const [metodoPago, setMetodoPago] = useState("Transferencia");

  const [fechaPago, setFechaPago] = useState("");

  const [errorPago, setErrorPago] = useState("");

  const [mensajePago, setMensajePago] = useState("");

  // Modal para registrar anticipo.
  const [modalAnticipo, setModalAnticipo] = useState(false);

  const [anticipoDepto, setAnticipoDepto] = useState(
    DEPARTAMENTOS[0]
  );

  const [anticipoMonto, setAnticipoMonto] = useState("");

  const [errorAnticipo, setErrorAnticipo] = useState("");

  const filasBase = useMemo<ExpensaDeptoCalculada[]>(() => {
    return (datos[periodoActivo] ?? []).map((e) => {
      const atraso = e.pagado
        ? 0
        : diasDeAtraso(e.periodo, regla.diasGracia);

      const mora =
        atraso > 0
          ? (e.monto * regla.porcentaje) / 100
          : 0;

      const saldo = e.pagado
        ? 0
        : Math.max(
            0,
            e.monto + mora - e.anticipoAplicado
          );

      return {
        ...e,
        atraso,
        mora,
        saldo,
      };
    });
  }, [datos, periodoActivo, regla]);

  const filas = useMemo(() => {
    return filasBase.filter((f) => {
      const coincideBusqueda =
        f.departamento
          .toLowerCase()
          .includes(busqueda.toLowerCase());

      const coincideEstado =
        filtroEstado === "Todos" ||
        (filtroEstado === "Pagados" && f.pagado) ||
        (filtroEstado === "En mora" &&
          !f.pagado &&
          f.atraso > 0) ||
        (filtroEstado === "Pendientes" &&
          !f.pagado &&
          f.atraso === 0);

      return coincideBusqueda && coincideEstado;
    });
  }, [filasBase, busqueda, filtroEstado]);

  const totalPendiente = filasBase.reduce(
    (sum, f) => sum + f.saldo,
    0
  );

  const morosos = filasBase.filter(
    (f) => f.atraso > 0
  ).length;

  // Anticipos aplicados al período actual.
  const anticiposDeEstePeriodo = anticipos.filter(
    (a) => a.periodoAplicado === periodoActivo
  );

  function abrirModalRegla() {
    setDraftPorcentaje(String(regla.porcentaje));
    setDraftDiasGracia(String(regla.diasGracia));
    setErrorRegla("");
    setModalRegla(true);
  }

  function guardarRegla() {
    const p = Number(draftPorcentaje);
    const d = Number(draftDiasGracia);

    if (isNaN(p) || p < 0 || p > 100) {
      setErrorRegla(
        "El porcentaje de mora debe estar entre 0 y 100."
      );
      return;
    }

    if (isNaN(d) || d < 0) {
      setErrorRegla(
        "Los días de gracia deben ser 0 o más."
      );
      return;
    }

    setRegla({
      porcentaje: p,
      diasGracia: d,
    });

    setModalRegla(false);
  }

  // CORRECCIÓN:
  // recibe ExpensaDeptoCalculada porque el objeto viene de filasBase.
  function abrirModalPago(depto: ExpensaDeptoCalculada) {
    setPagoDepto(depto);

    setMetodoPago("Transferencia");

    setFechaPago(
      HOY.toISOString().slice(0, 10)
    );

    setErrorPago("");

    setMensajePago("");

    setModalPago(true);
  }

  function registrarPago() {
    if (!pagoDepto) return;

    if (!fechaPago) {
      setErrorPago(
        "Debes indicar la fecha en que se realizó el pago."
      );
      return;
    }

    setErrorPago("");

    const esAnticipado =
      pagoDepto.atraso === 0 &&
      fechaPago < `${periodoActivo}-10`;

    setDatos((prev) => ({
      ...prev,

      [periodoActivo]: prev[periodoActivo].map(
        (e) =>
          e.departamento === pagoDepto.departamento
            ? {
                ...e,
                pagado: true,
                fechaPago,
                pagoAnticipado: esAnticipado,
              }
            : e
      ),
    }));

    setMensajePago(
      `Pago de ${pagoDepto.departamento} registrado correctamente (${metodoPago}).`
    );

    setTimeout(
      () => setModalPago(false),
      900
    );
  }

  function abrirModalAnticipo() {
    setAnticipoDepto(DEPARTAMENTOS[0]);

    setAnticipoMonto("");

    setErrorAnticipo("");

    setModalAnticipo(true);
  }

  function registrarAnticipo() {
    const monto = Number(anticipoMonto);

    if (!anticipoDepto) {
      setErrorAnticipo(
        "Selecciona un departamento."
      );
      return;
    }

    if (
      !anticipoMonto ||
      isNaN(monto) ||
      monto <= 0
    ) {
      setErrorAnticipo(
        "Ingresa un monto válido, mayor a 0."
      );
      return;
    }

    const destino = periodoSiguiente(
      periodoActivo
    );

    const nuevo: Anticipo = {
      id: Date.now(),
      departamento: anticipoDepto,
      monto,
      periodoAplicado: destino,
      fechaRegistro:
        HOY.toISOString().slice(0, 10),
    };

    setAnticipos((prev) => [
      nuevo,
      ...prev,
    ]);

    // Si la expensa del período futuro ya existe,
    // se aplica inmediatamente.
    setDatos((prev) => {
      if (!prev[destino]) return prev;

      return {
        ...prev,

        [destino]: prev[destino].map(
          (e) =>
            e.departamento === anticipoDepto
              ? {
                  ...e,
                  anticipoAplicado:
                    e.anticipoAplicado +
                    monto,
                }
              : e
        ),
      };
    });

    setModalAnticipo(false);
  }

  return (
    <DashboardLayout active="pagos">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            EP-02 · PAGOS
          </p>

          <h1>Pagos y mora</h1>

          <p>
            Registra pagos de expensas, consulta
            saldos pendientes y gestiona la mora.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={abrirModalAnticipo}
          >
            <PlusIcon size={16} />
            Registrar anticipo
          </button>

          <button
            className="btn btn-secondary"
            onClick={abrirModalRegla}
          >
            <SettingsIcon size={16} />
            Reglas de mora
          </button>
        </div>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon attention">
            <WalletIcon size={20} />
          </div>

          <div>
            <span>
              Saldo pendiente (
              {nombrePeriodo(periodoActivo)})
            </span>

            <strong>
              Bs. {totalPendiente.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <CreditCardIcon size={20} />
          </div>

          <div>
            <span>Mora aplicada</span>

            <strong>
              {regla.porcentaje}%
            </strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft">
            <CheckIcon size={20} />
          </div>

          <div>
            <span>
              Departamentos morosos
            </span>

            <strong>{morosos}</strong>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>
              Expensas por periodo
            </h3>

            <p>
              Mora calculada automáticamente
              tras {regla.diasGracia} días de
              gracia, al {regla.porcentaje}%.
            </p>
          </div>

          <select
            value={periodoActivo}
            onChange={(e) =>
              setPeriodoActivo(e.target.value)
            }
            style={{
              textTransform: "capitalize",
            }}
          >
            {PERIODOS.map((p) => (
              <option
                key={p}
                value={p}
                style={{
                  textTransform: "capitalize",
                }}
              >
                {nombrePeriodo(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="doc-filters">
          {(
            [
              "Todos",
              "Pendientes",
              "En mora",
              "Pagados",
            ] as FiltroEstado[]
          ).map((f) => (
            <button
              key={f}
              className={`filter-chip ${
                filtroEstado === f
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setFiltroEstado(f)
              }
            >
              {f}
            </button>
          ))}

          <input
            placeholder="Buscar departamento…"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            style={{
              marginLeft: "auto",
              maxWidth: 220,
            }}
          />
        </div>

        {filas.length === 0 ? (
          <div className="empty-state">
            No se encontraron departamentos
            con esos filtros.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Monto expensa</th>
                  <th>Mora</th>
                  <th>
                    Anticipo aplicado
                  </th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.departamento}
                  >
                    <td>
                      <span className="tag">
                        {f.departamento}
                      </span>
                    </td>

                    <td>
                      Bs. {f.monto.toFixed(2)}
                    </td>

                    <td>
                      {f.mora > 0
                        ? `Bs. ${f.mora.toFixed(
                            2
                          )} (${f.atraso} días)`
                        : "—"}
                    </td>

                    <td>
                      {f.anticipoAplicado >
                      0
                        ? `Bs. ${f.anticipoAplicado.toFixed(
                            2
                          )}`
                        : "—"}
                    </td>

                    <td>
                      <strong>
                        Bs. {f.saldo.toFixed(2)}
                      </strong>
                    </td>

                    <td>
                      {f.pagado ? (
                        <span className="status status-success">
                          <span />
                          {f.pagoAnticipado
                            ? "Pagado (anticipado)"
                            : "Pagado"}
                        </span>
                      ) : f.atraso > 0 ? (
                        <span className="status status-attention">
                          <span />
                          En mora
                        </span>
                      ) : (
                        <span className="status status-warning">
                          <span />
                          Pendiente
                        </span>
                      )}
                    </td>

                    <td>
                      {!f.pagado && (
                        <button
                          className="btn btn-secondary"
                          onClick={() =>
                            abrirModalPago(f)
                          }
                        >
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {anticiposDeEstePeriodo.length >
        0 && (
        <section
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-toolbar">
            <div>
              <h3>
                Anticipos aplicados a{" "}
                {nombrePeriodo(
                  periodoActivo
                )}
              </h3>

              <p>
                Pagos adelantados que se
                descuentan del saldo de este
                período.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th>Monto</th>
                  <th>
                    Fecha de registro
                  </th>
                </tr>
              </thead>

              <tbody>
                {anticiposDeEstePeriodo.map(
                  (a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="tag">
                          {a.departamento}
                        </span>
                      </td>

                      <td>
                        Bs.{" "}
                        {a.monto.toFixed(2)}
                      </td>

                      <td>
                        {a.fechaRegistro}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={modalRegla}
        title="Configurar reglas de mora"
        onClose={() =>
          setModalRegla(false)
        }
      >
        <div className="modal-form">
          <label className="field">
            <span>
              Porcentaje de mora (%)
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draftPorcentaje}
              onChange={(e) =>
                setDraftPorcentaje(
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Días de gracia antes de
              aplicar mora
            </span>

            <input
              type="number"
              min="0"
              value={draftDiasGracia}
              onChange={(e) =>
                setDraftDiasGracia(
                  e.target.value
                )
              }
            />
          </label>

          {errorRegla && (
            <div className="alert alert-error">
              {errorRegla}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={guardarRegla}
          >
            Guardar reglas
          </button>
        </div>
      </Modal>

      <Modal
        open={modalPago}
        title={`Registrar pago · ${
          pagoDepto?.departamento ?? ""
        }`}
        onClose={() =>
          setModalPago(false)
        }
      >
        <div className="modal-form">
          <p
            style={{
              fontSize: 12,
              color: "#6b625c",
            }}
          >
            Saldo a pagar:{" "}
            <strong>
              Bs.{" "}
              {pagoDepto
                ? (
                    filasBase.find(
                      (f) =>
                        f.departamento ===
                        pagoDepto.departamento
                    )?.saldo ?? 0
                  ).toFixed(2)
                : "0.00"}
            </strong>
          </p>

          <label className="field">
            <span>
              Método de pago
            </span>

            <select
              value={metodoPago}
              onChange={(e) =>
                setMetodoPago(
                  e.target.value
                )
              }
            >
              <option>
                Transferencia
              </option>

              <option>Efectivo</option>

              <option>QR</option>
            </select>
          </label>

          <label className="field">
            <span>
              Fecha de pago
            </span>

            <input
              type="date"
              value={fechaPago}
              onChange={(e) =>
                setFechaPago(
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Comprobante (opcional)
            </span>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </label>

          {errorPago && (
            <div className="alert alert-error">
              {errorPago}
            </div>
          )}

          {mensajePago && (
            <div className="alert alert-success">
              {mensajePago}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={registrarPago}
          >
            Confirmar pago
          </button>
        </div>
      </Modal>

      <Modal
        open={modalAnticipo}
        title="Registrar pago anticipado"
        onClose={() =>
          setModalAnticipo(false)
        }
      >
        <div className="modal-form">
          <label className="field">
            <span>
              Departamento
            </span>

            <select
              value={anticipoDepto}
              onChange={(e) =>
                setAnticipoDepto(
                  e.target.value
                )
              }
            >
              {DEPARTAMENTOS.map(
                (d) => (
                  <option
                    key={d}
                  >
                    {d}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Monto (Bs.)
            </span>

            <input
              type="number"
              min="1"
              value={anticipoMonto}
              onChange={(e) =>
                setAnticipoMonto(
                  e.target.value
                )
              }
              placeholder="Ej. 1280"
            />
          </label>

          <p
            style={{
              fontSize: 11,
              color: "#9a918b",
            }}
          >
            Este anticipo se aplicará al
            período de{" "}
            {nombrePeriodo(
              periodoSiguiente(
                periodoActivo
              )
            )}
            , exista o no todavía la
            expensa generada.
          </p>

          {errorAnticipo && (
            <div className="alert alert-error">
              {errorAnticipo}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={registrarAnticipo}
          >
            Registrar anticipo
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}