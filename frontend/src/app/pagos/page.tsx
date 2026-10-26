"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, apiDescargar } from "../../../lib/api";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import {
  PlusIcon,
  WalletIcon,
  CheckIcon,
  CreditCardIcon,
  FileIcon,
  SettingsIcon,
} from "../../../components/Icons";

type Categoria = "A" | "B" | "C";
type EstadoDepto = "Al día" | "Pendiente" | "En mora";
type Frecuencia = "mes" | "dia";

type Departamento = {
  id: string;
  numero: number;
  categoria: Categoria;
  responsable: string;
  tarifa: number;
};

type ReglaMora = {
  diaInicio: number;
  porcentaje: number;
  montoMaximo: number;
  frecuencia: Frecuencia;
};

type Expensa = {
  id: string;
  departamento: number;
  periodo: string;
  monto: number;
  montoRestante: number;
  moraRestante: number;
  moraPagada: number;
  vencida: boolean;
};

type Movimiento = {
  id: string;
  fecha: string;
  departamento: number;
  tipo: "Pago de expensa" | "Pago anticipado registrado";
  monto: number;
  metodo: string;
  referencia: string;
  usuario: string;
};

type Recibo = {
  usuario: string;
  fechaEmision: string;
  horaEmision: string;
  departamento: number;
  periodo: string;
  montoPagado: number;
  descuentoMora: number;
  fechaPago: string;
  metodo: string;
  referencia: string;
};

type Fila = {
  depto: Departamento;
  sinPagar: number;
  adeudado: number;
  mora: number;
  saldoTotal: number;
  estado: EstadoDepto;
};

type Campo =
  | "departamento"
  | "responsable"
  | "categoria"
  | "sinPagar"
  | "adeudado"
  | "mora"
  | "saldoTotal";

const METODOS = ["QR"];

// Se muestra hasta que llega la regla del backend (GET /expensas/mora/regla).
const REGLA_INICIAL: ReglaMora = {
  diaInicio: 1,
  porcentaje: 0,
  montoMaximo: 0,
  frecuencia: "mes",
};

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function bs(n: number) {
  return (
    "Bs. " +
    n.toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function nombrePeriodo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}

function hoyISO() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseMonto(texto: string): number | null {
  const valor = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) return null;

  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}

function readNombre(): string {
  if (typeof window === "undefined") return "Administrador";
  return sessionStorage.getItem("nombreUsuario") || "Administrador";
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function imprimirHtml(titulo: string, cuerpo: string) {
  const ventana = window.open("", "_blank", "width=900,height=700");

  if (!ventana) {
    alert(
      "Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir."
    );
    return;
  }

  ventana.document.write(`
    <html>
      <head>
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f3f3f3; }
          h2 { margin: 0 0 8px; }
          p { margin: 4px 0; }
        </style>
      </head>
      <body>${cuerpo}</body>
    </html>
  `);

  ventana.document.close();
  ventana.focus();
  ventana.print();
}

// ============================================================
// LLAMADAS AL BACKEND
// ============================================================

// Forma de la regla en el backend. El modal actual solo maneja
// porcentaje con tope; el tipo "fijo" existe en el backend pero
// el modal todavía no tiene selector para elegirlo.
type ReglaMoraApi = {
  dia: number;
  tipo: "porcentaje" | "fijo";
  valor: number;
  tope: number | null;
  frecuencia: Frecuencia;
};

const deReglaApi = (regla: ReglaMoraApi): ReglaMora => ({
  diaInicio: regla.dia,
  porcentaje: regla.valor,
  montoMaximo: regla.tope ?? 0,
  frecuencia: regla.frecuencia,
});

type ResumenPagos = {
  departamentos: Departamento[];
  deudas: {
    id: string;
    departamento: number;
    periodo: string;
    monto: number;
    mora: number;
    vencida: boolean;
  }[];
  aFavor: Record<number, number>;
};

// BACKEND: GET /expensas/pagos/resumen y GET /expensas/pagos/historial
async function cargarPagosApi() {
  const [resumen, historial, regla] = await Promise.all([
    api<ResumenPagos>("/expensas/pagos/resumen"),
    api<Movimiento[]>("/expensas/pagos/historial"),
    api<ReglaMoraApi>("/expensas/mora/regla"),
  ]);

  const expensas: Expensa[] = resumen.deudas.map((deuda) => ({
    id: deuda.id,
    departamento: deuda.departamento,
    periodo: deuda.periodo,
    monto: deuda.monto,
    montoRestante: deuda.monto,
    moraRestante: deuda.mora,
    moraPagada: 0,
    vencida: deuda.vencida,
  }));

  return {
    departamentos: resumen.departamentos,
    expensas,
    aFavor: resumen.aFavor,
    historial,
    regla: deReglaApi(regla),
  };
}

function aplicar(expensa: Expensa, monto: number) {
  const aMora = r2(Math.min(monto, expensa.moraRestante));
  const aMonto = r2(
    Math.min(monto - aMora, expensa.montoRestante)
  );

  return {
    aMora,
    aMonto,
    restante: r2(
      expensa.moraRestante -
        aMora +
        expensa.montoRestante -
        aMonto
    ),
  };
}

type PagoEntrada = {
  expensa: Expensa;
  monto: number;
  fecha: string;
  metodo: string;
  referencia: string;
  usuario: string;
};

// BACKEND: POST /expensas/pagos/:id/pagar
// Solo acepta el pago completo (monto + mora); si no, responde con error.
async function registrarPagoApi(pago: PagoEntrada) {
  const factura = await api<{ id: string }>(
    `/expensas/pagos/${pago.expensa.id}/pagar`,
    {
      method: "POST",
      body: JSON.stringify({
        monto: pago.monto,
        fecha: pago.fecha,
        metodo: pago.metodo,
        referencia: pago.referencia || undefined,
      }),
    }
  );

  const { aMora } = aplicar(pago.expensa, pago.monto);
  const ahora = new Date();

  const movimiento: Movimiento = {
    id: `P-${factura.id}`,
    fecha: pago.fecha,
    departamento: pago.expensa.departamento,
    tipo: "Pago de expensa",
    monto: pago.monto,
    metodo: pago.metodo,
    referencia: pago.referencia,
    usuario: pago.usuario,
  };

  const recibo: Recibo = {
    usuario: pago.usuario,
    fechaEmision: fechaCorta(hoyISO()),
    horaEmision: ahora.toLocaleTimeString("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    departamento: pago.expensa.departamento,
    periodo: pago.expensa.periodo,
    montoPagado: pago.monto,
    descuentoMora: aMora,
    fechaPago: pago.fecha,
    metodo: pago.metodo,
    referencia: pago.referencia,
  };

  // El backend deja la deuda pagada por completo
  return {
    montoRestante: 0,
    moraRestante: 0,
    moraPagada: r2(pago.expensa.moraPagada + aMora),
    movimiento,
    recibo,
  };
}

type AnticipoEntrada = {
  idDepartamento: string;
  departamento: number;
  monto: number;
  fecha: string;
  metodo: string;
  referencia: string;
  usuario: string;
};

// BACKEND: POST /expensas/fondos (solo si el departamento está al día)
async function registrarAnticipoApi(anticipo: AnticipoEntrada) {
  await api("/expensas/fondos", {
    method: "POST",
    body: JSON.stringify({
      id_departamento: Number(anticipo.idDepartamento),
      monto: anticipo.monto,
      fecha: anticipo.fecha,
      metodo: anticipo.metodo,
      referencia: anticipo.referencia || undefined,
    }),
  });

  const movimiento: Movimiento = {
    id: `D-${Date.now()}`,
    fecha: anticipo.fecha,
    departamento: anticipo.departamento,
    tipo: "Pago anticipado registrado",
    monto: anticipo.monto,
    metodo: anticipo.metodo,
    referencia: anticipo.referencia,
    usuario: anticipo.usuario,
  };

  return { movimiento };
}

// BACKEND: PUT /expensas/mora/regla
// El backend recalcula la mora de las deudas vencidas con la nueva regla.
async function guardarReglaApi(
  regla: ReglaMora
): Promise<ReglaMora> {
  const guardada = await api<ReglaMoraApi>("/expensas/mora/regla", {
    method: "PUT",
    body: JSON.stringify({
      dia: regla.diaInicio,
      tipo: "porcentaje",
      valor: regla.porcentaje,
      tope: regla.montoMaximo,
      frecuencia: regla.frecuencia,
    }),
  });

  return deReglaApi(guardada);
}

function filaDe(
  depto: Departamento,
  expensas: Expensa[],
  aFavor: number,
  periodo: string
): Fila {
  const pendientes = expensas.filter(
    (expensa) =>
      expensa.departamento === depto.numero &&
      expensa.montoRestante + expensa.moraRestante > 0 &&
      (periodo === "" || expensa.periodo === periodo)
  );

  const adeudado = r2(
    pendientes.reduce((suma, expensa) => suma + expensa.montoRestante, 0)
  );

  const mora = r2(
    pendientes.reduce((suma, expensa) => suma + expensa.moraRestante, 0)
  );

  const estado: EstadoDepto =
    pendientes.length === 0
      ? "Al día"
      : pendientes.some((expensa) => expensa.vencida)
      ? "En mora"
      : "Pendiente";

  return {
    depto,
    sinPagar: pendientes.length,
    adeudado,
    mora,
    saldoTotal: r2(adeudado + mora - aFavor),
    estado,
  };
}

function datosRecibo(recibo: Recibo): [string, string][] {
  return [
    ["Usuario que registró el pago", recibo.usuario],
    ["Fecha de emisión", recibo.fechaEmision],
    ["Hora de emisión", recibo.horaEmision],
    ["Departamento", `Dpto. ${recibo.departamento}`],
    ["Expensa pagada", nombrePeriodo(recibo.periodo)],
    ["Monto pagado", bs(recibo.montoPagado)],
    ["Descontado de la mora", bs(recibo.descuentoMora)],
    ["Fecha de pago", fechaCorta(recibo.fechaPago)],
    ["Método de pago", recibo.metodo],
    ["Referencia", recibo.referencia || "—"],
  ];
}

function valorOrden(fila: Fila, campo: Campo): string | number {
  switch (campo) {
    case "departamento":
      return fila.depto.numero;
    case "responsable":
      return normalizar(fila.depto.responsable);
    case "categoria":
      return fila.depto.categoria;
    case "sinPagar":
      return fila.sinPagar;
    case "adeudado":
      return fila.adeudado;
    case "mora":
      return fila.mora;
    default:
      return fila.saldoTotal;
  }
}

function textoRegla(regla: ReglaMora) {
  const frecuencia =
    regla.frecuencia === "mes"
      ? "por cada mes de atraso"
      : "por cada día de atraso";

  return `sin mora antes del día ${regla.diaInicio}; desde ese día, el menor valor entre ${regla.porcentaje}% de la expensa y ${bs(regla.montoMaximo)}, ${frecuencia}`;
}

const AVISO = {
  background: "#fbf1df",
  color: "#a16d25",
  border: "1px solid #f0dcb4",
};

const FILA = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #F1ECE8",
  fontSize: 13,
} as const;

const ERR = {
  color: "#9F2727",
  fontSize: 11,
  marginTop: 4,
} as const;

const POR_PAGINA = 5;

function BadgeEstado({ estado }: { estado: EstadoDepto }) {
  const clase =
    estado === "Al día"
      ? "status-success"
      : estado === "Pendiente"
      ? "status-warning"
      : "";

  const rojo =
    estado === "En mora"
      ? { color: "#9F2727", background: "#FFE5E1" }
      : undefined;

  return (
    <span className={`status ${clase}`} style={rojo}>
      <i />
      {estado}
    </span>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function PagosPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [expensas, setExpensas] = useState<Expensa[]>([]);
  const [aFavor, setAFavor] = useState<Record<number, number>>({});
  const [historial, setHistorial] = useState<Movimiento[]>([]);
  const [regla, setRegla] = useState<ReglaMora>(REGLA_INICIAL);
  const [exito, setExito] = useState("");
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    cargarPagosApi()
      .then((datos) => {
        setDepartamentos(datos.departamentos);
        setExpensas(datos.expensas);
        setAFavor(datos.aFavor);
        setHistorial(datos.historial);
        setRegla(datos.regla);
      })
      .catch((error) =>
        setErrorCarga(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los pagos."
        )
      );
  }, []);

  const periodos = [...new Set(expensas.map((e) => e.periodo))].sort();

  // Filtros
  const [periodoF, setPeriodoF] = useState("");
  const [categoriaF, setCategoriaF] = useState("");
  const [estadoF, setEstadoF] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{
    campo: Campo;
    dir: "asc" | "desc";
  }>({ campo: "departamento", dir: "asc" });
  const [pagina, setPagina] = useState(1);

  // Configuración de mora
  const [reglaOpen, setReglaOpen] = useState(false);
  const [rDia, setRDia] = useState("");
  const [rPorcentaje, setRPorcentaje] = useState("");
  const [rMaximo, setRMaximo] = useState("");
  const [rFrecuencia, setRFrecuencia] = useState<Frecuencia>("mes");
  const [rIntentado, setRIntentado] = useState(false);
  const [rGuardando, setRGuardando] = useState(false);
  const [rServidor, setRServidor] = useState("");

  // Pago
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoPaso, setPagoPaso] =
    useState<"form" | "preview" | "recibo">("form");
  const [pagoDepto, setPagoDepto] = useState("");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState(METODOS[0]);
  const [pagoRef, setPagoRef] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  const [recibo, setRecibo] = useState<Recibo | null>(null);

  // Anticipo
  const [antOpen, setAntOpen] = useState(false);
  const [antDepto, setAntDepto] = useState("");
  const [antMonto, setAntMonto] = useState("");
  const [antFecha, setAntFecha] = useState("");
  const [antMetodo, setAntMetodo] = useState(METODOS[0]);
  const [antRef, setAntRef] = useState("");
  const [guardandoAnt, setGuardandoAnt] = useState(false);
  const [errorAnt, setErrorAnt] = useState("");

  // Datos derivados
  const pendientesDe = (numero: number) =>
    expensas
      .filter(
        (expensa) =>
          expensa.departamento === numero &&
          expensa.montoRestante + expensa.moraRestante > 0
      )
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

  const deudaDe = (numero: number) =>
    r2(
      expensas
        .filter((expensa) => expensa.departamento === numero)
        .reduce(
          (suma, expensa) =>
            suma + expensa.montoRestante + expensa.moraRestante,
          0
        )
    );

  const filasTodas = departamentos.map((depto) =>
    filaDe(depto, expensas, aFavor[depto.numero] ?? 0, periodoF)
  );

  const q = normalizar(busqueda);

  const filtradas = filasTodas
    .filter(
      (fila) =>
        (categoriaF === "" || fila.depto.categoria === categoriaF) &&
        (estadoF === "" || fila.estado === estadoF) &&
        (q === "" ||
          String(fila.depto.numero).includes(q) ||
          normalizar(fila.depto.responsable).includes(q))
    )
    .sort((a, b) => {
      const x = valorOrden(a, orden.campo);
      const y = valorOrden(b, orden.campo);
      const comparacion =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y));

      return orden.dir === "asc" ? comparacion : -comparacion;
    });

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtradas.length / POR_PAGINA)
  );
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  const sumar = (
    filas: Fila[],
    campo: "adeudado" | "mora" | "saldoTotal"
  ) => r2(filas.reduce((suma, fila) => suma + fila[campo], 0));

  const categoriasPresentes = (["A", "B", "C"] as Categoria[]).filter(
    (categoria) =>
      filtradas.some((fila) => fila.depto.categoria === categoria)
  );

  const filtrosTxt =
    [
      periodoF && `Período: ${nombrePeriodo(periodoF)}`,
      categoriaF && `Categoría: ${categoriaF}`,
      estadoF && `Estado: ${estadoF}`,
      busqueda.trim() && `Búsqueda: "${busqueda.trim()}"`,
    ]
      .filter(Boolean)
      .join(" · ") || "Sin filtros";

  const saldoTxt = (numero: number) =>
    numero < 0 ? (
      <span style={{ color: "#56704F", fontWeight: 600 }}>
        A favor {bs(-numero)}
      </span>
    ) : (
      bs(numero)
    );

  // Validación de regla
  const rDiaNum = Number(rDia);
  const rPorcentajeNum = parseMonto(rPorcentaje);
  const rMaximoNum = parseMonto(rMaximo);

  const errDia =
    rDia.trim() === ""
      ? "El día de inicio es obligatorio."
      : !Number.isInteger(rDiaNum) || rDiaNum < 1 || rDiaNum > 28
      ? "Ingresa un día entero entre 1 y 28."
      : "";

  const errPorcentaje =
    rPorcentaje.trim() === ""
      ? "El porcentaje es obligatorio."
      : rPorcentajeNum === null
      ? "Ingresa un porcentaje mayor a 0 con máximo dos decimales."
      : rPorcentajeNum > 100
      ? "El porcentaje no puede superar el 100%."
      : "";

  const errMaximo =
    rMaximo.trim() === ""
      ? "El límite en bolivianos es obligatorio."
      : rMaximoNum === null
      ? "Ingresa un monto mayor a Bs. 0."
      : "";

  const reglaBorrador: ReglaMora | null =
    !errDia &&
    !errPorcentaje &&
    !errMaximo &&
    rPorcentajeNum !== null &&
    rMaximoNum !== null
      ? {
          diaInicio: rDiaNum,
          porcentaje: rPorcentajeNum,
          montoMaximo: rMaximoNum,
          frecuencia: rFrecuencia,
        }
      : null;

  function abrirRegla() {
    setRDia(String(regla.diaInicio));
    setRPorcentaje(String(regla.porcentaje));
    setRMaximo(String(regla.montoMaximo));
    setRFrecuencia(regla.frecuencia);
    setRIntentado(false);
    setRServidor("");
    setExito("");
    setReglaOpen(true);
  }

  function cerrarRegla() {
    if (rGuardando) return;
    setReglaOpen(false);
  }

  async function guardarRegla() {
    if (rGuardando) return;

    setRIntentado(true);
    if (!reglaBorrador) return;

    setRGuardando(true);
    setRServidor("");

    try {
      const nueva = await guardarReglaApi(reglaBorrador);

      setRegla(nueva);

      // La mora la recalcula el backend: se vuelven a pedir las deudas
      const datos = await cargarPagosApi();
      setExpensas(datos.expensas);

      setReglaOpen(false);
      setExito(`Reglas actualizadas: ${textoRegla(nueva)}.`);
    } catch (error) {
      setRServidor(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la regla. Intenta nuevamente."
      );
    } finally {
      setRGuardando(false);
    }
  }

  // Datos para registrar pago
  const deptoPago =
    departamentos.find(
      (depto) => String(depto.numero) === pagoDepto
    ) ?? null;

  const pendPago = deptoPago
    ? pendientesDe(deptoPago.numero)
    : [];

  const masAntigua = pendPago[0] ?? null;

  const totalAPagar = masAntigua
    ? r2(masAntigua.montoRestante + masAntigua.moraRestante)
    : 0;

  const montoNum = parseMonto(pagoMonto);
  const excesivo = montoNum !== null && montoNum > totalAPagar;

  const mensajeMonto =
    pagoMonto.trim() === ""
      ? ""
      : montoNum === null
      ? "Ingresa un monto mayor a 0 con máximo dos decimales."
      : excesivo
      ? `El monto supera el saldo de la expensa seleccionada (${bs(
          totalAPagar
        )}).`
      : "";

  const pagoValido =
    !!masAntigua &&
    montoNum !== null &&
    !excesivo &&
    pagoFecha !== "";

  const aplicacion =
    masAntigua && montoNum !== null && !excesivo
      ? aplicar(masAntigua, montoNum)
      : null;

  // Datos para anticipo
  const deptoAnt =
    departamentos.find(
      (depto) => String(depto.numero) === antDepto
    ) ?? null;

  const deudaAnt = deptoAnt
    ? deudaDe(deptoAnt.numero)
    : 0;

  const antMontoNum = parseMonto(antMonto);

  const mensajeAntMonto =
    antMonto.trim() !== "" && antMontoNum === null
      ? "Ingresa un monto mayor a 0 con máximo dos decimales."
      : "";

  const anticipoValido =
    !!deptoAnt &&
    deudaAnt === 0 &&
    antMontoNum !== null &&
    antFecha !== "";

  // Acciones generales
  function cambiarFiltro(accion: () => void) {
    accion();
    setPagina(1);
  }

  function limpiarFiltros() {
    setPeriodoF("");
    setCategoriaF("");
    setEstadoF("");
    setBusqueda("");
    setPagina(1);
  }

  function alternarOrden(campo: Campo) {
    setOrden((actual) =>
      actual.campo === campo
        ? {
            campo,
            dir: actual.dir === "asc" ? "desc" : "asc",
          }
        : { campo, dir: "asc" }
    );
  }

  const th = (campo: Campo, texto: string) => (
    <th
      onClick={() => alternarOrden(campo)}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {texto}
      {orden.campo === campo
        ? orden.dir === "asc"
          ? " ▲"
          : " ▼"
        : ""}
    </th>
  );

  function elegirDeptoPago(valor: string) {
    setPagoDepto(valor);
    setErrorPago("");

    const pendientes = valor
      ? pendientesDe(Number(valor))
      : [];

    setPagoMonto(
      pendientes[0]
        ? (
            pendientes[0].montoRestante +
            pendientes[0].moraRestante
          ).toFixed(2)
        : ""
    );
  }

  function abrirPago(numero?: number) {
    setExito("");
    setPagoPaso("form");
    setPagoFecha(hoyISO());
    setPagoMetodo(METODOS[0]);
    setPagoRef("");
    setErrorPago("");
    setRecibo(null);
    setPagoDepto("");
    setPagoMonto("");

    if (numero !== undefined) {
      elegirDeptoPago(String(numero));
    }

    setPagoOpen(true);
  }

  function cerrarPago() {
    if (guardandoPago) return;
    setPagoOpen(false);
  }

  function abrirAnticipo(numero?: number) {
    setExito("");
    setAntDepto(numero !== undefined ? String(numero) : "");
    setAntMonto("");
    setAntFecha(hoyISO());
    setAntMetodo(METODOS[0]);
    setAntRef("");
    setErrorAnt("");
    setAntOpen(true);
  }

  function cerrarAnticipo() {
    if (guardandoAnt) return;
    setAntOpen(false);
  }

  async function registrarPago() {
    if (
      guardandoPago ||
      !masAntigua ||
      montoNum === null ||
      !pagoValido
    ) {
      return;
    }

    const expensa = masAntigua;

    setGuardandoPago(true);
    setErrorPago("");

    try {
      const respuesta = await registrarPagoApi({
        expensa,
        monto: montoNum,
        fecha: pagoFecha,
        metodo: pagoMetodo,
        referencia: pagoRef.trim(),
        usuario: readNombre(),
      });

      setExpensas((anteriores) =>
        anteriores.map((item) =>
          item.id === expensa.id
            ? {
                ...item,
                montoRestante: respuesta.montoRestante,
                moraRestante: respuesta.moraRestante,
                moraPagada: respuesta.moraPagada,
              }
            : item
        )
      );

      setHistorial((anterior) => [
        respuesta.movimiento,
        ...anterior,
      ]);

      setRecibo(respuesta.recibo);
      setPagoPaso("recibo");

      setExito(
        `Pago de ${bs(montoNum)} registrado para el Dpto. ${expensa.departamento}.`
      );
    } catch (error) {
      setErrorPago(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el pago. Intenta nuevamente."
      );
    } finally {
      setGuardandoPago(false);
    }
  }

  async function registrarAnticipo() {
    if (
      guardandoAnt ||
      !deptoAnt ||
      antMontoNum === null ||
      !anticipoValido
    ) {
      return;
    }

    setGuardandoAnt(true);
    setErrorAnt("");

    try {
      const respuesta = await registrarAnticipoApi({
        idDepartamento: deptoAnt.id,
        departamento: deptoAnt.numero,
        monto: antMontoNum,
        fecha: antFecha,
        metodo: antMetodo,
        referencia: antRef.trim(),
        usuario: readNombre(),
      });

      setAFavor((anterior) => ({
        ...anterior,
        [deptoAnt.numero]: r2(
          (anterior[deptoAnt.numero] ?? 0) + antMontoNum
        ),
      }));

      setHistorial((anterior) => [
        respuesta.movimiento,
        ...anterior,
      ]);

      setExito(
        `Pago anticipado de ${bs(antMontoNum)} registrado para el Dpto. ${deptoAnt.numero}.`
      );

      setAntOpen(false);
    } catch (error) {
      setErrorAnt(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el anticipo. Intenta nuevamente."
      );
    } finally {
      setGuardandoAnt(false);
    }
  }

  // El backend genera el PDF y el Excel (.xlsx) con los mismos filtros y orden de la tabla
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);

  async function exportar(formato: "pdf" | "excel") {
    if (exportando) return;
    if (filtradas.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const q = new URLSearchParams({ formato, orden: orden.campo, dir: orden.dir });
    if (periodoF) q.set("periodo", periodoF);
    if (categoriaF) q.set("categoria", categoriaF);
    if (estadoF) q.set("estado", estadoF);
    if (busqueda.trim()) q.set("busqueda", busqueda.trim());

    setExportando(formato);
    try {
      await apiDescargar(`/expensas/pagos/resumen/exportar?${q}`, `saldos-pendientes.${formato === "pdf" ? "pdf" : "xlsx"}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo exportar. Intenta nuevamente.");
    } finally {
      setExportando(null);
    }
  }

  function imprimirRecibo(reciboActual: Recibo) {
    imprimirHtml(
      "Recibo de pago",
      `<h2>Recibo de pago</h2>${datosRecibo(reciboActual)
        .map(
          ([clave, valor]) =>
            `<p><b>${clave}:</b> ${valor}</p>`
        )
        .join("")}`
    );
  }

  function descargarRecibo(reciboActual: Recibo) {
    descargar(
      `recibo-dpto-${reciboActual.departamento}.txt`,
      "RECIBO DE PAGO\r\n\r\n" +
        datosRecibo(reciboActual)
          .map(([clave, valor]) => `${clave}: ${valor}`)
          .join("\r\n"),
      "text/plain;charset=utf-8"
    );
  }

  // Control visual de acceso.
  // La autorización real también debe validarse en el backend.
  if (!esAdmin) {
    return (
      <DashboardLayout active="pagos">
        <div className="panel">
          <div className="empty-state">
            Acceso denegado. Solo el administrador puede ver los saldos pendientes.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const enMora = filasTodas.filter(
    (fila) => fila.estado === "En mora"
  ).length;

  return (
    <DashboardLayout active="pagos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · PAGOS</p>
          <h1>Pagos y mora</h1>
          <p>
            Registra pagos, consulta los saldos pendientes de cada
            departamento y configura la mora.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={abrirRegla}
          >
            <SettingsIcon size={16} /> Reglas de mora
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => abrirAnticipo()}
          >
            <PlusIcon size={16} /> Pago anticipado
          </button>

          <button
            className="btn btn-primary"
            onClick={() => abrirPago()}
          >
            <CreditCardIcon size={16} /> Registrar pago
          </button>
        </div>
      </div>

      {errorCarga && (
        <div
          className="alert alert-error"
          style={{ marginBottom: 16 }}
        >
          {errorCarga}
        </div>
      )}

      {exito && (
        <div
          className="alert alert-success"
          style={{ marginBottom: 16 }}
        >
          {exito}
        </div>
      )}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon attention">
            <WalletIcon size={20} />
          </div>
          <div>
            <span>Monto adeudado</span>
            <strong>{bs(sumar(filasTodas, "adeudado"))}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <CreditCardIcon size={20} />
          </div>
          <div>
            <span>Mora acumulada</span>
            <strong>{bs(sumar(filasTodas, "mora"))}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon soft">
            <CheckIcon size={20} />
          </div>
          <div>
            <span>Departamentos en mora</span>
            <strong>{enMora}</strong>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>
              La búsqueda se aplica junto con los filtros. Ignora
              mayúsculas y tildes.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="modal-form" style={{ paddingTop: 8 }}>
          <div className="form-grid">
            <label className="field">
              <span>Período</span>
              <select
                value={periodoF}
                onChange={(e) =>
                  cambiarFiltro(() => setPeriodoF(e.target.value))
                }
              >
                <option value="">Todos los períodos</option>
                {periodos.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {nombrePeriodo(periodo)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Categoría de departamento</span>
              <select
                value={categoriaF}
                onChange={(e) =>
                  cambiarFiltro(() => setCategoriaF(e.target.value))
                }
              >
                <option value="">Todas</option>
                <option value="A">Categoría A</option>
                <option value="B">Categoría B</option>
                <option value="C">Categoría C</option>
              </select>
            </label>

            <label className="field">
              <span>Estado</span>
              <select
                value={estadoF}
                onChange={(e) =>
                  cambiarFiltro(() => setEstadoF(e.target.value))
                }
              >
                <option value="">Todos</option>
                <option value="Al día">Al día</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En mora">En mora</option>
              </select>
            </label>

            <label className="field">
              <span>Buscar por número o responsable</span>
              <input
                value={busqueda}
                onChange={(e) =>
                  cambiarFiltro(() => setBusqueda(e.target.value))
                }
                placeholder="Ej. 103 o Ana Vargas"
              />
            </label>
          </div>
        </div>
      </section>

      {/* TABLA DE SALDOS */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Saldos pendientes por departamento</h3>
            <p>
              La mora se calcula automáticamente según la regla
              configurada: {textoRegla(regla)}.
            </p>
            <p>Filtros aplicados: {filtrosTxt}</p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary"
              disabled={exportando !== null}
              onClick={() => exportar("pdf")}
            >
              <FileIcon size={16} /> {exportando === "pdf" ? "Generando…" : "Exportar PDF"}
            </button>

            <button
              className="btn btn-secondary"
              disabled={exportando !== null}
              onClick={() => exportar("excel")}
            >
              <FileIcon size={16} /> {exportando === "excel" ? "Generando…" : "Exportar Excel"}
            </button>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="empty-state">
            No se encontraron departamentos con el filtro seleccionado.
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {th("departamento", "Departamento")}
                    {th("responsable", "Propietario o responsable")}
                    {th("categoria", "Categoría")}
                    {th("sinPagar", "Expensas no pagadas")}
                    {th("adeudado", "Monto adeudado")}
                    {th("mora", "Mora acumulada")}
                    {th("saldoTotal", "Saldo total")}
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.map((fila) => (
                    <tr key={fila.depto.numero}>
                      <td>
                        <Link
                          href={`/estado-cuenta?depto=${fila.depto.numero}`}
                          className="tag"
                          title="Ver estado de cuenta"
                        >
                          Dpto. {fila.depto.numero}
                        </Link>
                      </td>

                      <td>{fila.depto.responsable}</td>
                      <td>{fila.depto.categoria}</td>
                      <td>{fila.sinPagar}</td>
                      <td>{bs(fila.adeudado)}</td>
                      <td>
                        {fila.mora > 0 ? bs(fila.mora) : "—"}
                      </td>
                      <td>
                        <strong>{saldoTxt(fila.saldoTotal)}</strong>
                      </td>
                      <td>
                        <BadgeEstado estado={fila.estado} />
                      </td>
                      <td>
                        {pendientesDe(fila.depto.numero).length > 0 ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() => abrirPago(fila.depto.numero)}
                          >
                            Registrar pago
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              abrirAnticipo(fila.depto.numero)
                            }
                          >
                            Pago anticipado
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  {categoriasPresentes.map((categoria) => {
                    const filasCategoria = filtradas.filter(
                      (fila) => fila.depto.categoria === categoria
                    );

                    return (
                      <tr
                        key={categoria}
                        style={{ background: "#faf7f4" }}
                      >
                        <td colSpan={4}>
                          Subtotal categoría {categoria}
                        </td>
                        <td>{bs(sumar(filasCategoria, "adeudado"))}</td>
                        <td>{bs(sumar(filasCategoria, "mora"))}</td>
                        <td>
                          {saldoTxt(
                            sumar(filasCategoria, "saldoTotal")
                          )}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    );
                  })}

                  <tr
                    style={{
                      background: "#fff0eb",
                      fontWeight: 700,
                    }}
                  >
                    <td colSpan={4}>Total adeudado</td>
                    <td>{bs(sumar(filtradas, "adeudado"))}</td>
                    <td>{bs(sumar(filtradas, "mora"))}</td>
                    <td>{saldoTxt(sumar(filtradas, "saldoTotal"))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 20px",
                fontSize: 12,
                color: "#766E69",
              }}
            >
              <span>
                {filtradas.length}{" "}
                {filtradas.length === 1
                  ? "departamento"
                  : "departamentos"}
              </span>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  className="btn btn-secondary"
                  disabled={paginaActual <= 1}
                  onClick={() => setPagina(paginaActual - 1)}
                >
                  Anterior
                </button>

                <span>
                  Página {paginaActual} de {totalPaginas}
                </span>

                <button
                  className="btn btn-secondary"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPagina(paginaActual + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* HISTORIAL */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Historial de pagos registrados</h3>
            <p>
              Pagos de expensas y anticipos, con el usuario que los
              registró.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Departamento</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Referencia</th>
                <th>Registrado por</th>
              </tr>
            </thead>

            <tbody>
              {historial.map((movimiento) => (
                <tr key={movimiento.id}>
                  <td>{fechaCorta(movimiento.fecha)}</td>
                  <td>
                    <span className="tag">
                      Dpto. {movimiento.departamento}
                    </span>
                  </td>
                  <td>{movimiento.tipo}</td>
                  <td>{bs(movimiento.monto)}</td>
                  <td>{movimiento.metodo}</td>
                  <td>{movimiento.referencia || "—"}</td>
                  <td>{movimiento.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================
          MODAL: REGLAS DE MORA
          ====================================================== */}
      <Modal
        open={reglaOpen}
        title="Reglas de mora"
        onClose={cerrarRegla}
      >
        <div className="modal-form">
          <p
            style={{
              fontSize: 12,
              color: "#766E69",
              margin: "0 0 12px",
            }}
          >
            Antes del día de inicio no se cobra mora. Desde ese día
            se calcula automáticamente por día o por mes de atraso,
            aplicando el porcentaje y el límite en bolivianos.
          </p>

          <div className="form-grid">
            <label className="field">
              <span>
                Día de inicio de la mora <b>*</b>
              </span>
              <input
                type="number"
                min="1"
                max="28"
                step="1"
                value={rDia}
                onChange={(e) => setRDia(e.target.value)}
                placeholder="Ej. 10"
              />
              {(rIntentado || rDia !== "") && errDia && (
                <small style={ERR}>{errDia}</small>
              )}
            </label>

            <label className="field">
              <span>
                Frecuencia de cobro <b>*</b>
              </span>
              <select
                value={rFrecuencia}
                onChange={(e) =>
                  setRFrecuencia(e.target.value as Frecuencia)
                }
              >
                <option value="mes">
                  Una vez por cada mes de atraso
                </option>
                <option value="dia">
                  Por cada día de atraso
                </option>
              </select>
            </label>

            <label className="field">
              <span>
                Porcentaje de mora (%) <b>*</b>
              </span>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={rPorcentaje}
                onChange={(e) => setRPorcentaje(e.target.value)}
                placeholder="Ej. 10"
              />
              {(rIntentado || rPorcentaje !== "") &&
                errPorcentaje && (
                  <small style={ERR}>{errPorcentaje}</small>
                )}
            </label>

            <label className="field">
              <span>
                Límite por unidad de atraso (Bs.) <b>*</b>
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={rMaximo}
                onChange={(e) => setRMaximo(e.target.value)}
                placeholder="Ej. 50"
              />
              {(rIntentado || rMaximo !== "") && errMaximo && (
                <small style={ERR}>{errMaximo}</small>
              )}
            </label>
          </div>

          {rServidor && (
            <div
              className="alert alert-error"
              style={{ marginTop: 12 }}
            >
              {rServidor}
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              disabled={rGuardando}
              onClick={cerrarRegla}
            >
              Cancelar
            </button>

            <button
              className="btn btn-primary"
              disabled={rGuardando}
              onClick={guardarRegla}
            >
              {rGuardando ? "Guardando…" : "Guardar reglas"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================
          MODAL: REGISTRAR PAGO
          ====================================================== */}
      <Modal
        open={pagoOpen}
        title={
          pagoPaso === "recibo"
            ? "Recibo de pago"
            : "Registrar pago de expensa"
        }
        onClose={cerrarPago}
      >
        {pagoPaso === "form" && (
          <div className="modal-form">
            <label className="field">
              <span>
                Departamento <b>*</b>
              </span>
              <select
                value={pagoDepto}
                onChange={(e) => elegirDeptoPago(e.target.value)}
              >
                <option value="">Selecciona un departamento</option>
                {departamentos.map((depto) => (
                  <option
                    key={depto.numero}
                    value={String(depto.numero)}
                  >
                    Dpto. {depto.numero} · {depto.responsable}
                  </option>
                ))}
              </select>
            </label>

            {deptoPago && pendPago.length === 0 && (
              <div
                className="alert alert-success"
                style={{ marginTop: 12 }}
              >
                El Dpto. {deptoPago.numero} está al día y no tiene
                expensas pendientes. Puedes registrar un pago
                anticipado.
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setPagoOpen(false);
                      abrirAnticipo(deptoPago.numero);
                    }}
                  >
                    Registrar pago anticipado
                  </button>
                </div>
              </div>
            )}

            {deptoPago && pendPago.length > 0 && masAntigua && (
              <>
                <h3 style={{ fontSize: 13, margin: "16px 0 8px" }}>
                  Expensas pendientes del Dpto. {deptoPago.numero}
                </h3>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Monto</th>
                        <th>Mora</th>
                        <th>Total a pagar</th>
                        <th>Estado</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pendPago.map((expensa) => (
                        <tr key={expensa.id}>
                          <td>{nombrePeriodo(expensa.periodo)}</td>
                          <td>{bs(expensa.montoRestante)}</td>
                          <td>
                            {expensa.moraRestante > 0
                              ? bs(expensa.moraRestante)
                              : "—"}
                          </td>
                          <td>
                            <strong>
                              {bs(
                                expensa.montoRestante +
                                  expensa.moraRestante
                              )}
                            </strong>
                          </td>
                          <td>
                            <BadgeEstado
                              estado={
                                expensa.vencida
                                  ? "En mora"
                                  : "Pendiente"
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p
                  style={{
                    fontSize: 11,
                    color: "#9a918b",
                    margin: "8px 0 14px",
                  }}
                >
                  El pago se aplica a la expensa pendiente más antigua
                  ({nombrePeriodo(masAntigua.periodo)}).
                </p>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Monto pagado (Bs.) <b>*</b>
                    </span>
                    <input
                      value={pagoMonto}
                      inputMode="decimal"
                      onChange={(e) => setPagoMonto(e.target.value)}
                      placeholder="Ej. 400,00"
                    />
                  </label>

                  <label className="field">
                    <span>
                      Fecha de pago <b>*</b>
                    </span>
                    <input
                      type="date"
                      max={hoyISO()}
                      value={pagoFecha}
                      onChange={(e) => setPagoFecha(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span>
                      Método de pago <b>*</b>
                    </span>
                    <select
                      value={pagoMetodo}
                      onChange={(e) => setPagoMetodo(e.target.value)}
                    >
                      {METODOS.map((metodo) => (
                        <option key={metodo} value={metodo}>
                          {metodo}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Referencia</span>
                    <input
                      value={pagoRef}
                      onChange={(e) => setPagoRef(e.target.value)}
                      placeholder="N.º de operación (opcional)"
                    />
                  </label>
                </div>

                {mensajeMonto && (
                  <div
                    className={
                      excesivo ? "alert" : "alert alert-error"
                    }
                    style={
                      excesivo
                        ? { ...AVISO, marginTop: 12 }
                        : { marginTop: 12 }
                    }
                  >
                    {mensajeMonto}
                  </div>
                )}

                {errorPago && (
                  <div
                    className="alert alert-error"
                    style={{ marginTop: 12 }}
                  >
                    {errorPago}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={cerrarPago}
              >
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                disabled={!pagoValido}
                onClick={() => setPagoPaso("preview")}
              >
                Ver vista previa
              </button>
            </div>
          </div>
        )}

        {/* Vista previa del pago */}
        {pagoPaso === "preview" &&
          masAntigua &&
          montoNum !== null &&
          aplicacion && (
            <div className="modal-form">
              <p
                style={{
                  fontSize: 13,
                  margin: "0 0 8px",
                  color: "#766E69",
                }}
              >
                Revisa los datos antes de guardar el pago.
              </p>

              <div style={FILA}>
                <span>Departamento</span>
                <strong>Dpto. {masAntigua.departamento}</strong>
              </div>

              <div style={FILA}>
                <span>Expensa a la que se aplica</span>
                <strong>{nombrePeriodo(masAntigua.periodo)}</strong>
              </div>

              <div style={FILA}>
                <span>Monto pagado</span>
                <strong>{bs(montoNum)}</strong>
              </div>

              <div style={FILA}>
                <span>Se descontará de la mora</span>
                <strong>
                  {masAntigua.moraRestante > 0
                    ? bs(aplicacion.aMora)
                    : "Sin mora"}
                </strong>
              </div>

              <div style={FILA}>
                <span>Aplicado al monto de la expensa</span>
                <strong>{bs(aplicacion.aMonto)}</strong>
              </div>

              <div style={FILA}>
                <span>Saldo restante de esta expensa</span>
                <strong>
                  {aplicacion.restante > 0
                    ? bs(aplicacion.restante)
                    : "Bs. 0,00 (quedará pagada)"}
                </strong>
              </div>

              <div style={FILA}>
                <span>Fecha · Método</span>
                <strong>
                  {fechaCorta(pagoFecha)} · {pagoMetodo}
                </strong>
              </div>

              {errorPago && (
                <div
                  className="alert alert-error"
                  style={{ marginTop: 12 }}
                >
                  {errorPago}
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  disabled={guardandoPago}
                  onClick={() => setPagoPaso("form")}
                >
                  Volver
                </button>

                <button
                  className="btn btn-primary"
                  disabled={guardandoPago}
                  onClick={registrarPago}
                >
                  {guardandoPago ? "Guardando…" : "Registrar pago"}
                </button>
              </div>
            </div>
          )}

        {/* Recibo */}
        {pagoPaso === "recibo" && recibo && (
          <div className="modal-form">
            <div
              className="alert alert-success"
              style={{ marginBottom: 12 }}
            >
              El pago se registró con éxito.
            </div>

            {datosRecibo(recibo).map(([clave, valor]) => (
              <div key={clave} style={FILA}>
                <span>{clave}</span>
                <strong>{valor}</strong>
              </div>
            ))}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => descargarRecibo(recibo)}
              >
                Descargar
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => imprimirRecibo(recibo)}
              >
                Imprimir
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setPagoOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================
          MODAL: PAGO ANTICIPADO
          ====================================================== */}
      <Modal
        open={antOpen}
        title="Registrar pago anticipado"
        onClose={cerrarAnticipo}
      >
        <div className="modal-form">
          <label className="field">
            <span>
              Departamento <b>*</b>
            </span>
            <select
              value={antDepto}
              onChange={(e) => {
                setAntDepto(e.target.value);
                setErrorAnt("");
              }}
            >
              <option value="">Selecciona un departamento</option>
              {departamentos.map((depto) => (
                <option
                  key={depto.numero}
                  value={String(depto.numero)}
                >
                  Dpto. {depto.numero} · {depto.responsable}
                </option>
              ))}
            </select>
          </label>

          {deptoAnt && (
            <div style={{ margin: "12px 0" }}>
              <div style={FILA}>
                <span>Categoría del departamento</span>
                <strong>{deptoAnt.categoria}</strong>
              </div>

              <div style={FILA}>
                <span>Expensa mensual</span>
                <strong>{bs(deptoAnt.tarifa)}</strong>
              </div>

              <div style={FILA}>
                <span>Deuda actual</span>
                <strong>{bs(deudaAnt)}</strong>
              </div>

              <div style={FILA}>
                <span>Saldo a favor actual</span>
                <strong>
                  {bs(aFavor[deptoAnt.numero] ?? 0)}
                </strong>
              </div>
            </div>
          )}

          {deptoAnt && deudaAnt > 0 && (
            <div
              className="alert alert-error"
              style={{ marginBottom: 12 }}
            >
              Este departamento tiene expensas pendientes (
              {bs(deudaAnt)}). El anticipo solo se puede registrar
              cuando no tiene deudas.
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              <span>
                Monto (Bs.) <b>*</b>
              </span>
              <input
                value={antMonto}
                inputMode="decimal"
                onChange={(e) => setAntMonto(e.target.value)}
                placeholder="Ej. 400,00"
              />
            </label>

            <label className="field">
              <span>
                Fecha <b>*</b>
              </span>
              <input
                type="date"
                max={hoyISO()}
                value={antFecha}
                onChange={(e) => setAntFecha(e.target.value)}
              />
            </label>

            <label className="field">
              <span>
                Método de pago <b>*</b>
              </span>
              <select
                value={antMetodo}
                onChange={(e) => setAntMetodo(e.target.value)}
              >
                {METODOS.map((metodo) => (
                  <option key={metodo} value={metodo}>
                    {metodo}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Referencia</span>
              <input
                value={antRef}
                onChange={(e) => setAntRef(e.target.value)}
                placeholder="N.º de operación (opcional)"
              />
            </label>
          </div>

          {mensajeAntMonto && (
            <div
              className="alert alert-error"
              style={{ marginTop: 12 }}
            >
              {mensajeAntMonto}
            </div>
          )}

          {errorAnt && (
            <div
              className="alert alert-error"
              style={{ marginTop: 12 }}
            >
              {errorAnt}
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              disabled={guardandoAnt}
              onClick={cerrarAnticipo}
            >
              Cancelar
            </button>

            <button
              className="btn btn-primary"
              disabled={!anticipoValido || guardandoAnt}
              onClick={registrarAnticipo}
            >
              {guardandoAnt
                ? "Guardando…"
                : "Registrar pago anticipado"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}