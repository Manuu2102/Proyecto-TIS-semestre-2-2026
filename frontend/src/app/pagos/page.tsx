"use client";
import { useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { PlusIcon, WalletIcon, CheckIcon, CreditCardIcon, FileIcon } from "../../../components/Icons";

type Categoria = "A" | "B" | "C";
type EstadoDepto = "Al día" | "Pendiente" | "En mora";
type Departamento = { numero: number; categoria: Categoria; responsable: string };
type Expensa = {
  id: string;
  departamento: number;
  periodo: string; // "2026-09"
  monto: number; // monto fijo de la categoría (no cambia)
  montoRestante: number; // lo que falta pagar del monto fijo
  moraRestante: number; // lo que falta pagar de la mora
  vencida: boolean;
};
type Movimiento = {
  id: number;
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
type Fila = { depto: Departamento; sinPagar: number; adeudado: number; mora: number; saldoTotal: number; estado: EstadoDepto };
type Campo = "departamento" | "responsable" | "categoria" | "sinPagar" | "adeudado" | "mora" | "saldoTotal";

// =====================================================================
// DATOS DE EJEMPLO (los reemplaza backend)
// =====================================================================

// BACKEND: método(s) de pago permitidos. Por ahora solo QR (el doc dice que se ampliará).
const METODOS = ["QR"];

// BACKEND: GET /expensas/tarifas
const TARIFA: Record<Categoria, number> = { A: 300, B: 380, C: 450 };

// BACKEND: GET /departamentos (ocupados y con categoría)
const DEPARTAMENTOS: Departamento[] = [
  { numero: 101, categoria: "A", responsable: "María Fernanda Rojas" },
  { numero: 102, categoria: "A", responsable: "Carlos Andrés Pérez" },
  { numero: 103, categoria: "A", responsable: "Ana Lucía Vargas" },
  { numero: 201, categoria: "B", responsable: "Sofía Valentina Cruz" },
  { numero: 202, categoria: "B", responsable: "Diego Mauricio Salazar" },
  { numero: 203, categoria: "B", responsable: "Melody Gutiérrez" },
  { numero: 301, categoria: "C", responsable: "Rodrigo Quispe" },
  { numero: 302, categoria: "C", responsable: "Alejandra Guzmán" },
];

const PERIODOS = ["2026-08", "2026-09", "2026-10"];

const SIN_PAGAR: Record<number, string[]> = {
  103: ["2026-08", "2026-09", "2026-10"],
  201: ["2026-10"],
  202: ["2026-09", "2026-10"],
  203: ["2026-10"],
  302: ["2026-08", "2026-10"],
};

// BACKEND: GET /expensas. La mora de las expensas vencidas la calcula el servidor cada día.
const EXPENSAS_INICIALES: Expensa[] = DEPARTAMENTOS.flatMap((d) =>
  PERIODOS.map((p) => {
    const pendiente = (SIN_PAGAR[d.numero] ?? []).includes(p);
    const vencida = pendiente && p !== "2026-10";
    const monto = TARIFA[d.categoria];
    return {
      id: `${p}-${d.numero}`,
      departamento: d.numero,
      periodo: p,
      monto,
      montoRestante: pendiente ? monto : 0,
      moraRestante: vencida ? monto : 0,
      vencida,
    };
  })
);

// BACKEND: saldo a favor por departamento (anticipos)
const A_FAVOR_INICIAL: Record<number, number> = { 101: 300 };

// BACKEND: GET /pagos/historial
const HISTORIAL_INICIAL: Movimiento[] = [
  { id: 3, fecha: "2026-10-08", departamento: 101, tipo: "Pago anticipado registrado", monto: 300, metodo: "QR", referencia: "QR-ANT-0001", usuario: "Administrador" },
  { id: 2, fecha: "2026-10-06", departamento: 102, tipo: "Pago de expensa", monto: 300, metodo: "QR", referencia: "QR-1002", usuario: "Administrador" },
  { id: 1, fecha: "2026-10-04", departamento: 301, tipo: "Pago de expensa", monto: 450, metodo: "QR", referencia: "QR-1001", usuario: "Administrador" },
];

// =====================================================================
// SIMULACIÓN de lo que hace backend. Se reemplaza por los fetch reales.
// =====================================================================

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// BACKEND: el servidor decide cómo se reparte el pago entre mora y monto. Aquí se simula.
function aplicar(exp: Expensa, monto: number) {
  const aMora = r2(Math.min(monto, exp.moraRestante));
  const aMonto = r2(Math.min(monto - aMora, exp.montoRestante));
  return { aMora, aMonto, restante: r2(exp.moraRestante - aMora + exp.montoRestante - aMonto) };
}

type PagoEntrada = { expensa: Expensa; monto: number; fecha: string; metodo: string; referencia: string; usuario: string };

async function registrarPagoApi(p: PagoEntrada) {
  await new Promise((r) => setTimeout(r, 900));
  // BACKEND: POST /pagos  { departamento, monto, fecha, metodo, referencia }
  // 403 → "Permiso denegado: solo el administrador puede registrar pagos."
  // 422 → mensaje del servidor (monto excesivo o inválido)
  // 5xx → "Fallo del servicio. No se pudo registrar el pago, intenta nuevamente."
  const { aMora, aMonto } = aplicar(p.expensa, p.monto);
  const ahora = new Date();
  const movimiento: Movimiento = {
    id: Date.now(),
    fecha: p.fecha,
    departamento: p.expensa.departamento,
    tipo: "Pago de expensa",
    monto: p.monto,
    metodo: p.metodo,
    referencia: p.referencia,
    usuario: p.usuario,
  };
  const recibo: Recibo = {
    usuario: p.usuario,
    fechaEmision: fechaCorta(hoyISO()),
    horaEmision: ahora.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    departamento: p.expensa.departamento,
    periodo: p.expensa.periodo,
    montoPagado: p.monto,
    descuentoMora: aMora,
    fechaPago: p.fecha,
    metodo: p.metodo,
    referencia: p.referencia,
  };
  return {
    montoRestante: r2(p.expensa.montoRestante - aMonto),
    moraRestante: r2(p.expensa.moraRestante - aMora),
    movimiento,
    recibo,
  };
}

type AnticipoEntrada = { departamento: number; monto: number; fecha: string; metodo: string; referencia: string; usuario: string };

async function registrarAnticipoApi(a: AnticipoEntrada) {
  await new Promise((r) => setTimeout(r, 900));
  // BACKEND: POST /pagos/anticipos  { departamento, monto, fecha, metodo, referencia }
  // 403 → "Permiso denegado: solo el administrador puede registrar pagos anticipados."
  // 422 → "El departamento tiene expensas pendientes." u otro mensaje del servidor
  // 5xx → "Fallo del servicio. No se pudo registrar el pago anticipado, intenta nuevamente."
  const movimiento: Movimiento = {
    id: Date.now(),
    fecha: a.fecha,
    departamento: a.departamento,
    tipo: "Pago anticipado registrado",
    monto: a.monto,
    metodo: a.metodo,
    referencia: a.referencia,
    usuario: a.usuario,
  };
  return { movimiento };
}

// BACKEND: GET /saldos-pendientes?periodo=&categoria=&estado=&q=  → devuelve estas filas
function filaDe(d: Departamento, expensas: Expensa[], aFavor: number, periodo: string): Fila {
  const pend = expensas.filter(
    (e) => e.departamento === d.numero && e.montoRestante + e.moraRestante > 0 && (periodo === "" || e.periodo === periodo)
  );
  const adeudado = r2(pend.reduce((s, e) => s + e.montoRestante, 0));
  const mora = r2(pend.reduce((s, e) => s + e.moraRestante, 0));
  const estado: EstadoDepto = pend.length === 0 ? "Al día" : pend.some((e) => e.vencida) ? "En mora" : "Pendiente";
  return { depto: d, sinPagar: pend.length, adeudado, mora, saldoTotal: r2(adeudado + mora - aFavor), estado };
}

// =====================================================================
// Utilidades de presentación
// =====================================================================

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function bs(n: number) {
  return "Bs. " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nombrePeriodo(p: string) {
  const [a, m] = p.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}
function fechaCorta(iso: string) {
  return iso.split("-").reverse().join("/");
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// La búsqueda ignora mayúsculas y tildes
function normalizar(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
// Monto válido: mayor a 0 y máximo 2 decimales (acepta coma o punto)
function parseMonto(txt: string): number | null {
  const t = txt.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const v = Number(t);
  return v > 0 ? v : null;
}
function readRol(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem("rolUsuario") || "").toUpperCase();
}
function readNombre(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("nombreUsuario") || "Administrador";
}
function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
function imprimirHtml(titulo: string, cuerpo: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.");
    return;
  }
  w.document.write(
    `<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}h2{margin:0 0 8px}p{margin:4px 0}</style></head><body>${cuerpo}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}
function datosRecibo(r: Recibo): [string, string][] {
  return [
    ["Usuario que registró el pago", r.usuario],
    ["Fecha de emisión", r.fechaEmision],
    ["Hora de emisión", r.horaEmision],
    ["Departamento", `Dpto. ${r.departamento}`],
    ["Expensa pagada", nombrePeriodo(r.periodo)],
    ["Monto pagado", bs(r.montoPagado)],
    ["Descontado de la mora", bs(r.descuentoMora)],
    ["Fecha de pago", fechaCorta(r.fechaPago)],
    ["Método de pago", r.metodo],
    ["Referencia", r.referencia || "—"],
  ];
}
function valorOrden(f: Fila, c: Campo): string | number {
  switch (c) {
    case "departamento": return f.depto.numero;
    case "responsable": return normalizar(f.depto.responsable);
    case "categoria": return f.depto.categoria;
    case "sinPagar": return f.sinPagar;
    case "adeudado": return f.adeudado;
    case "mora": return f.mora;
    default: return f.saldoTotal;
  }
}

const AVISO = { background: "#fbf1df", color: "#a16d25", border: "1px solid #f0dcb4" };
const FILA = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1ECE8", fontSize: 13 } as const;
const POR_PAGINA = 5;

// Colores de la HU-11: al día verde, pendiente amarillo, en mora rojo
function BadgeEstado({ estado }: { estado: EstadoDepto }) {
  const clase = estado === "Al día" ? "status-success" : estado === "Pendiente" ? "status-warning" : "";
  const rojo = estado === "En mora" ? { color: "#9F2727", background: "#FFE5E1" } : undefined;
  return <span className={`status ${clase}`} style={rojo}><i />{estado}</span>;
}

// =====================================================================
// Página
// =====================================================================

export default function PagosPage() {
  const [rol] = useState(readRol);
  const esAdmin = rol.startsWith("ADMIN");

  const [expensas, setExpensas] = useState<Expensa[]>(EXPENSAS_INICIALES);
  const [aFavor, setAFavor] = useState<Record<number, number>>(A_FAVOR_INICIAL);
  const [historial, setHistorial] = useState<Movimiento[]>(HISTORIAL_INICIAL);
  const [exito, setExito] = useState("");

  // Filtros de la HU-11
  const [periodoF, setPeriodoF] = useState("");
  const [categoriaF, setCategoriaF] = useState("");
  const [estadoF, setEstadoF] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ campo: Campo; dir: "asc" | "desc" }>({ campo: "departamento", dir: "asc" });
  const [pagina, setPagina] = useState(1);

  // Modal de pago (HU-09)
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoPaso, setPagoPaso] = useState<"form" | "preview" | "recibo">("form");
  const [pagoDepto, setPagoDepto] = useState("");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState(METODOS[0]);
  const [pagoRef, setPagoRef] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  const [recibo, setRecibo] = useState<Recibo | null>(null);

  // Modal de anticipo (HU-10)
  const [antOpen, setAntOpen] = useState(false);
  const [antDepto, setAntDepto] = useState("");
  const [antMonto, setAntMonto] = useState("");
  const [antFecha, setAntFecha] = useState("");
  const [antMetodo, setAntMetodo] = useState(METODOS[0]);
  const [antRef, setAntRef] = useState("");
  const [guardandoAnt, setGuardandoAnt] = useState(false);
  const [errorAnt, setErrorAnt] = useState("");

  // ---------- Datos derivados ----------
  const pendientesDe = (num: number) =>
    expensas
      .filter((e) => e.departamento === num && e.montoRestante + e.moraRestante > 0)
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const deudaDe = (num: number) =>
    r2(expensas.filter((e) => e.departamento === num).reduce((s, e) => s + e.montoRestante + e.moraRestante, 0));

  const filasTodas = DEPARTAMENTOS.map((d) => filaDe(d, expensas, aFavor[d.numero] ?? 0, periodoF));
  const q = normalizar(busqueda);
  const filtradas = filasTodas
    .filter(
      (f) =>
        (categoriaF === "" || f.depto.categoria === categoriaF) &&
        (estadoF === "" || f.estado === estadoF) &&
        (q === "" || String(f.depto.numero).includes(q) || normalizar(f.depto.responsable).includes(q))
    )
    .sort((a, b) => {
      const x = valorOrden(a, orden.campo);
      const y = valorOrden(b, orden.campo);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return orden.dir === "asc" ? r : -r;
    });

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const sumar = (fs: Fila[], k: "adeudado" | "mora" | "saldoTotal") => r2(fs.reduce((s, f) => s + f[k], 0));
  const categoriasPresentes = (["A", "B", "C"] as Categoria[]).filter((c) => filtradas.some((f) => f.depto.categoria === c));

  const filtrosTxt =
    [
      periodoF && `Período: ${nombrePeriodo(periodoF)}`,
      categoriaF && `Categoría: ${categoriaF}`,
      estadoF && `Estado: ${estadoF}`,
      busqueda.trim() && `Búsqueda: "${busqueda.trim()}"`,
    ]
      .filter(Boolean)
      .join(" · ") || "Sin filtros";

  const saldoTxt = (n: number) =>
    n < 0 ? <span style={{ color: "#56704F", fontWeight: 600 }}>A favor {bs(-n)}</span> : bs(n);

  // ---------- Modal de pago: datos del departamento elegido ----------
  const deptoPago = DEPARTAMENTOS.find((d) => String(d.numero) === pagoDepto) ?? null;
  const pendPago = deptoPago ? pendientesDe(deptoPago.numero) : [];
  const masAntigua = pendPago[0] ?? null;
  const totalAPagar = masAntigua ? r2(masAntigua.montoRestante + masAntigua.moraRestante) : 0;
  const montoNum = parseMonto(pagoMonto);
  const excesivo = montoNum !== null && montoNum > totalAPagar;
  const mensajeMonto =
    pagoMonto.trim() === ""
      ? ""
      : montoNum === null
      ? "Monto incorrecto: ingresa un valor mayor a 0 con máximo dos decimales."
      : excesivo
      ? `Monto excesivo: supera lo que debe pagar la expensa (${bs(totalAPagar)}). El pago no se puede realizar.`
      : "";
  const pagoValido = !!masAntigua && montoNum !== null && !excesivo && pagoFecha !== "";
  const aplicacion = masAntigua && montoNum !== null && !excesivo ? aplicar(masAntigua, montoNum) : null;

  // ---------- Modal de anticipo: datos del departamento elegido ----------
  const deptoAnt = DEPARTAMENTOS.find((d) => String(d.numero) === antDepto) ?? null;
  const deudaAnt = deptoAnt ? deudaDe(deptoAnt.numero) : 0;
  const antMontoNum = parseMonto(antMonto);
  const mensajeAntMonto =
    antMonto.trim() !== "" && antMontoNum === null
      ? "Monto incorrecto: ingresa un valor mayor a 0 con máximo dos decimales."
      : "";
  const anticipoValido = !!deptoAnt && deudaAnt === 0 && antMontoNum !== null && antFecha !== "";

  // ---------- Acciones ----------
  function cambiarFiltro(fn: () => void) {
    fn();
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
    setOrden((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }));
  }
  const th = (campo: Campo, texto: string) => (
    <th onClick={() => alternarOrden(campo)} style={{ cursor: "pointer", userSelect: "none" }}>
      {texto}
      {orden.campo === campo ? (orden.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  function elegirDeptoPago(valor: string) {
    setPagoDepto(valor);
    setErrorPago("");
    const pend = valor ? pendientesDe(Number(valor)) : [];
    setPagoMonto(pend[0] ? (pend[0].montoRestante + pend[0].moraRestante).toFixed(2) : "");
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
    if (numero !== undefined) elegirDeptoPago(String(numero));
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
    // Criterio 10: el botón se bloquea para evitar pagos duplicados
    if (guardandoPago || !masAntigua || montoNum === null) return;
    const exp = masAntigua;
    setGuardandoPago(true);
    setErrorPago("");
    try {
      const res = await registrarPagoApi({
        expensa: exp, monto: montoNum, fecha: pagoFecha, metodo: pagoMetodo, referencia: pagoRef.trim(), usuario: readNombre(),
      });
      // Criterio 7: se actualizan los datos con lo que devuelve el servidor
      setExpensas((prev) =>
        prev.map((e) => (e.id === exp.id ? { ...e, montoRestante: res.montoRestante, moraRestante: res.moraRestante } : e))
      );
      setHistorial((prev) => [res.movimiento, ...prev]);
      setRecibo(res.recibo);
      setPagoPaso("recibo");
      // Criterio 6: mensaje de guardado
      setExito(`Pago de ${bs(montoNum)} registrado con éxito para el Dpto. ${exp.departamento}.`);
    } catch (e) {
      setErrorPago(e instanceof Error ? e.message : "No se pudo registrar el pago. Intenta nuevamente.");
    } finally {
      setGuardandoPago(false);
    }
  }

  async function registrarAnticipo() {
    if (guardandoAnt || !deptoAnt || antMontoNum === null) return;
    setGuardandoAnt(true);
    setErrorAnt("");
    try {
      const res = await registrarAnticipoApi({
        departamento: deptoAnt.numero, monto: antMontoNum, fecha: antFecha, metodo: antMetodo, referencia: antRef.trim(), usuario: readNombre(),
      });
      setAFavor((prev) => ({ ...prev, [deptoAnt.numero]: r2((prev[deptoAnt.numero] ?? 0) + antMontoNum) }));
      setHistorial((prev) => [res.movimiento, ...prev]);
      setExito(`Pago anticipado de ${bs(antMontoNum)} registrado con éxito para el Dpto. ${deptoAnt.numero}.`);
      setAntOpen(false);
    } catch (e) {
      setErrorAnt(e instanceof Error ? e.message : "No se pudo registrar el pago anticipado. Intenta nuevamente.");
    } finally {
      setGuardandoAnt(false);
    }
  }

  // Criterio 6 de la HU-11: exportar con indicación de los filtros usados
  function exportarExcel() {
    // BACKEND: GET /saldos-pendientes/exportar?formato=xlsx&<filtros>. Aquí se simula con un CSV que abre Excel.
    if (filtradas.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const lineas: (string | number)[][] = [
      ["Saldos pendientes"],
      [`Filtros aplicados: ${filtrosTxt}`],
      [],
      ["Departamento", "Responsable", "Categoría", "Expensas sin pagar", "Monto adeudado", "Mora acumulada", "Saldo total", "Estado"],
      ...filtradas.map((f) => [f.depto.numero, f.depto.responsable, f.depto.categoria, f.sinPagar, f.adeudado, f.mora, f.saldoTotal, f.estado]),
      [],
      ["Total adeudado", "", "", "", sumar(filtradas, "adeudado"), sumar(filtradas, "mora"), sumar(filtradas, "saldoTotal"), ""],
    ];
    const csv = lineas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    descargar("saldos-pendientes.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  }
  function exportarPdf() {
    // BACKEND: GET /saldos-pendientes/exportar?formato=pdf&<filtros>. Aquí se simula con la ventana de impresión.
    if (filtradas.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const filas = filtradas
      .map(
        (f) =>
          `<tr><td>${f.depto.numero}</td><td>${f.depto.responsable}</td><td>${f.depto.categoria}</td><td>${f.sinPagar}</td><td>${bs(f.adeudado)}</td><td>${bs(f.mora)}</td><td>${bs(f.saldoTotal)}</td><td>${f.estado}</td></tr>`
      )
      .join("");
    imprimirHtml(
      "Saldos pendientes",
      `<h2>Saldos pendientes</h2><p>Filtros aplicados: ${filtrosTxt}</p><table><thead><tr><th>Dpto.</th><th>Responsable</th><th>Cat.</th><th>Sin pagar</th><th>Adeudado</th><th>Mora</th><th>Saldo total</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table><p><b>Total adeudado:</b> ${bs(sumar(filtradas, "adeudado"))}</p>`
    );
  }
  function imprimirRecibo(r: Recibo) {
    imprimirHtml("Recibo de pago", `<h2>Recibo de pago</h2>${datosRecibo(r).map(([k, v]) => `<p><b>${k}:</b> ${v}</p>`).join("")}`);
  }
  function descargarRecibo(r: Recibo) {
    // BACKEND: GET /pagos/{id}/recibo (PDF). Aquí se simula con un archivo de texto.
    descargar(
      `recibo-dpto-${r.departamento}.txt`,
      "RECIBO DE PAGO\r\n\r\n" + datosRecibo(r).map(([k, v]) => `${k}: ${v}`).join("\r\n"),
      "text/plain;charset=utf-8"
    );
  }

  // ---------- Render ----------
  if (!esAdmin) {
    return (
      <DashboardLayout active="pagos">
        <div className="panel">
          <div className="empty-state">Acceso denegado. Solo el administrador puede ver los saldos pendientes.</div>
        </div>
      </DashboardLayout>
    );
  }

  const enMora = filasTodas.filter((f) => f.estado === "En mora").length;

  return (
    <DashboardLayout active="pagos">
      <div className="page-header">
        <div>
          <p className="eyebrow">EP-02 · PAGOS</p>
          <h1>Pagos y mora</h1>
          <p>Registra pagos, consulta los saldos pendientes de cada departamento y revisa la mora.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => abrirAnticipo()}>
            <PlusIcon size={16} /> Pago anticipado
          </button>
          <button className="btn btn-primary" onClick={() => abrirPago()}>
            <CreditCardIcon size={16} /> Registrar pago
          </button>
        </div>
      </div>

      {exito && <div className="alert alert-success" style={{ marginBottom: 16 }}>{exito}</div>}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon attention"><WalletIcon size={20} /></div>
          <div><span>Monto adeudado</span><strong>{bs(sumar(filasTodas, "adeudado"))}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><CreditCardIcon size={20} /></div>
          <div><span>Mora acumulada</span><strong>{bs(sumar(filasTodas, "mora"))}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Departamentos en mora</span><strong>{enMora}</strong></div>
        </div>
      </div>

      {/* HU-11: filtros y búsqueda */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>La búsqueda se aplica junto con los filtros. Ignora mayúsculas y tildes.</p>
          </div>
          <button className="btn btn-secondary" onClick={limpiarFiltros}>Limpiar filtros</button>
        </div>
        <div className="modal-form" style={{ paddingTop: 8 }}>
          <div className="form-grid">
            <label className="field">
              <span>Período</span>
              <select value={periodoF} onChange={(e) => cambiarFiltro(() => setPeriodoF(e.target.value))}>
                <option value="">Todos los períodos</option>
                {PERIODOS.map((p) => <option key={p} value={p}>{nombrePeriodo(p)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Categoría de departamento</span>
              <select value={categoriaF} onChange={(e) => cambiarFiltro(() => setCategoriaF(e.target.value))}>
                <option value="">Todas</option>
                <option value="A">Categoría A</option>
                <option value="B">Categoría B</option>
                <option value="C">Categoría C</option>
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={estadoF} onChange={(e) => cambiarFiltro(() => setEstadoF(e.target.value))}>
                <option value="">Todos</option>
                <option value="Al día">Al día</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En mora">En mora</option>
              </select>
            </label>
            <label className="field">
              <span>Buscar por número o responsable</span>
              <input value={busqueda} onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))} placeholder="Ej. 103 o Ana Vargas" />
            </label>
          </div>
        </div>
      </section>

      {/* HU-11: tabla de saldos pendientes. HU-12: la mora aparece aquí */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Saldos pendientes por departamento</h3>
            <p>La mora se calcula automáticamente cada día. No es necesario calcularla.</p>
            <p>Filtros aplicados: {filtrosTxt}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={exportarPdf}><FileIcon size={16} /> Exportar PDF</button>
            <button className="btn btn-secondary" onClick={exportarExcel}><FileIcon size={16} /> Exportar Excel</button>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="empty-state">No se encontró Departamentos con el filtro seleccionado</div>
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
                  {visibles.map((f) => (
                    <tr key={f.depto.numero}>
                      <td>
                        {/* Criterio 8: al hacer clic en un departamento se ve su estado de cuenta */}
                        <Link href={`/estado-cuenta?depto=${f.depto.numero}`} className="tag" title="Ver estado de cuenta">
                          Dpto. {f.depto.numero}
                        </Link>
                      </td>
                      <td>{f.depto.responsable}</td>
                      <td>{f.depto.categoria}</td>
                      <td>{f.sinPagar}</td>
                      <td>{bs(f.adeudado)}</td>
                      <td>{f.mora > 0 ? bs(f.mora) : "—"}</td>
                      <td><strong>{saldoTxt(f.saldoTotal)}</strong></td>
                      <td><BadgeEstado estado={f.estado} /></td>
                      <td>
                        {pendientesDe(f.depto.numero).length > 0 ? (
                          <button className="btn btn-secondary" onClick={() => abrirPago(f.depto.numero)}>Registrar pago</button>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => abrirAnticipo(f.depto.numero)}>Pago anticipado</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {categoriasPresentes.map((c) => {
                    const fs = filtradas.filter((f) => f.depto.categoria === c);
                    return (
                      <tr key={c} style={{ background: "#faf7f4" }}>
                        <td colSpan={4}>Subtotal categoría {c}</td>
                        <td>{bs(sumar(fs, "adeudado"))}</td>
                        <td>{bs(sumar(fs, "mora"))}</td>
                        <td>{saldoTxt(sumar(fs, "saldoTotal"))}</td>
                        <td colSpan={2}></td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#fff0eb", fontWeight: 700 }}>
                    <td colSpan={4}>Total adeudado</td>
                    <td>{bs(sumar(filtradas, "adeudado"))}</td>
                    <td>{bs(sumar(filtradas, "mora"))}</td>
                    <td>{saldoTxt(sumar(filtradas, "saldoTotal"))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 12, color: "#766E69" }}>
              <span>{filtradas.length} {filtradas.length === 1 ? "departamento" : "departamentos"}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-secondary" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
                <span>Página {paginaActual} de {totalPaginas}</span>
                <button className="btn btn-secondary" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* HU-10 criterio 4: el anticipo se ve en el historial como "pago anticipado registrado" */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-toolbar">
          <div>
            <h3>Historial de pagos registrados</h3>
            <p>Pagos de expensas y pagos anticipados, con el usuario que los registró.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Departamento</th><th>Tipo</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Registrado por</th></tr>
            </thead>
            <tbody>
              {historial.map((m) => (
                <tr key={m.id}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td><span className="tag">Dpto. {m.departamento}</span></td>
                  <td>{m.tipo}</td>
                  <td>{bs(m.monto)}</td>
                  <td>{m.metodo}</td>
                  <td>{m.referencia || "—"}</td>
                  <td>{m.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= HU-09: Registrar pago ================= */}
      <Modal open={pagoOpen} title={pagoPaso === "recibo" ? "Recibo de pago" : "Registrar pago de expensa"} onClose={cerrarPago}>
        {pagoPaso === "form" && (
          <div className="modal-form">
            <label className="field">
              <span>Departamento <b>*</b></span>
              <select value={pagoDepto} onChange={(e) => elegirDeptoPago(e.target.value)}>
                <option value="">Selecciona un departamento</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d.numero} value={String(d.numero)}>Dpto. {d.numero} · {d.responsable}</option>
                ))}
              </select>
            </label>

            {deptoPago && pendPago.length === 0 && (
              <div className="alert alert-success" style={{ marginTop: 12 }}>
                El Dpto. {deptoPago.numero} está al día: no tiene expensas pendientes. Puedes registrar un pago anticipado.
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setPagoOpen(false); abrirAnticipo(deptoPago.numero); }}
                  >
                    Registrar pago anticipado
                  </button>
                </div>
              </div>
            )}

            {deptoPago && pendPago.length > 0 && masAntigua && (
              <>
                <h3 style={{ fontSize: 13, margin: "16px 0 8px" }}>Expensas pendientes del Dpto. {deptoPago.numero}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Período</th><th>Monto fijo</th><th>Mora</th><th>Total a pagar</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {pendPago.map((e) => (
                        <tr key={e.id}>
                          <td>{nombrePeriodo(e.periodo)}</td>
                          <td>{bs(e.montoRestante)}</td>
                          <td>{e.moraRestante > 0 ? bs(e.moraRestante) : "—"}</td>
                          <td><strong>{bs(e.montoRestante + e.moraRestante)}</strong></td>
                          <td><BadgeEstado estado={e.vencida ? "En mora" : "Pendiente"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: "#9a918b", margin: "8px 0 14px" }}>
                  El pago se aplica a la expensa pendiente más antigua ({nombrePeriodo(masAntigua.periodo)}).
                </p>

                <div className="form-grid">
                  <label className="field">
                    <span>Monto pagado (Bs.) <b>*</b></span>
                    <input value={pagoMonto} inputMode="decimal" onChange={(e) => setPagoMonto(e.target.value)} placeholder="Ej. 300,00" />
                  </label>
                  <label className="field">
                    <span>Fecha de pago <b>*</b></span>
                    <input type="date" max={hoyISO()} value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Método de pago <b>*</b></span>
                    <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
                      {METODOS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Referencias</span>
                    <input value={pagoRef} onChange={(e) => setPagoRef(e.target.value)} placeholder="N° de operación (opcional)" />
                  </label>
                </div>

                {mensajeMonto && (
                  <div
                    className={excesivo ? "alert" : "alert alert-error"}
                    style={excesivo ? { ...AVISO, marginTop: 12 } : { marginTop: 12 }}
                  >
                    {mensajeMonto}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cerrarPago}>Cancelar</button>
              <button className="btn btn-primary" disabled={!pagoValido} onClick={() => setPagoPaso("preview")}>
                Ver vista previa
              </button>
            </div>
          </div>
        )}

        {/* Criterio 5: vista previa antes de guardar */}
        {pagoPaso === "preview" && masAntigua && montoNum !== null && aplicacion && (
          <div className="modal-form">
            <p style={{ fontSize: 13, margin: "0 0 8px", color: "#766E69" }}>Revisa los datos antes de guardar el pago.</p>
            <div style={FILA}><span>Departamento</span><strong>Dpto. {masAntigua.departamento}</strong></div>
            <div style={FILA}><span>Expensa a la que se aplica</span><strong>{nombrePeriodo(masAntigua.periodo)}</strong></div>
            <div style={FILA}><span>Monto pagado</span><strong>{bs(montoNum)}</strong></div>
            <div style={FILA}>
              <span>Se descontará de la mora</span>
              <strong>{masAntigua.moraRestante > 0 ? bs(aplicacion.aMora) : "Sin mora"}</strong>
            </div>
            <div style={FILA}><span>Se aplicará al monto de la expensa</span><strong>{bs(aplicacion.aMonto)}</strong></div>
            <div style={FILA}>
              <span>Saldo restante de esta expensa</span>
              <strong>{aplicacion.restante > 0 ? bs(aplicacion.restante) : "Bs. 0,00 (quedará pagada)"}</strong>
            </div>
            <div style={FILA}><span>Fecha · Método</span><strong>{fechaCorta(pagoFecha)} · {pagoMetodo}</strong></div>

            {errorPago && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorPago}</div>}

            <div className="modal-actions">
              <button className="btn btn-secondary" disabled={guardandoPago} onClick={() => setPagoPaso("form")}>Volver</button>
              <button className="btn btn-primary" disabled={guardandoPago} onClick={registrarPago}>
                {guardandoPago ? "Guardando…" : "Registrar pago"}
              </button>
            </div>
          </div>
        )}

        {/* Criterios 6, 8 y 9: éxito, recibo, imprimir y descargar */}
        {pagoPaso === "recibo" && recibo && (
          <div className="modal-form">
            <div className="alert alert-success" style={{ marginBottom: 12 }}>El pago se registró con éxito.</div>
            {datosRecibo(recibo).map(([k, v]) => (
              <div key={k} style={FILA}><span>{k}</span><strong>{v}</strong></div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => descargarRecibo(recibo)}>Descargar</button>
              <button className="btn btn-secondary" onClick={() => imprimirRecibo(recibo)}>Imprimir</button>
              <button className="btn btn-primary" onClick={() => setPagoOpen(false)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= HU-10: Pago anticipado ================= */}
      <Modal open={antOpen} title="Registrar pago anticipado" onClose={cerrarAnticipo}>
        <div className="modal-form">
          <label className="field">
            <span>Departamento <b>*</b></span>
            <select value={antDepto} onChange={(e) => { setAntDepto(e.target.value); setErrorAnt(""); }}>
              <option value="">Selecciona un departamento</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d.numero} value={String(d.numero)}>Dpto. {d.numero} · {d.responsable}</option>
              ))}
            </select>
          </label>

          {deptoAnt && (
            <div style={{ margin: "12px 0" }}>
              <div style={FILA}><span>Categoría del departamento</span><strong>{deptoAnt.categoria}</strong></div>
              <div style={FILA}><span>Expensa mensual</span><strong>{bs(TARIFA[deptoAnt.categoria])}</strong></div>
              <div style={FILA}><span>Deuda actual</span><strong>{bs(deudaAnt)}</strong></div>
              <div style={FILA}><span>Saldo a favor actual</span><strong>{bs(aFavor[deptoAnt.numero] ?? 0)}</strong></div>
            </div>
          )}

          {deptoAnt && deudaAnt > 0 && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>
              Este departamento tiene expensas pendientes ({bs(deudaAnt)}). El pago anticipado solo se puede registrar
              cuando no tiene deudas.
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              <span>Monto (Bs.) <b>*</b></span>
              <input value={antMonto} inputMode="decimal" onChange={(e) => setAntMonto(e.target.value)} placeholder="Ej. 300,00" />
            </label>
            <label className="field">
              <span>Fecha <b>*</b></span>
              <input type="date" max={hoyISO()} value={antFecha} onChange={(e) => setAntFecha(e.target.value)} />
            </label>
            <label className="field">
              <span>Método de pago <b>*</b></span>
              <select value={antMetodo} onChange={(e) => setAntMetodo(e.target.value)}>
                {METODOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Referencias</span>
              <input value={antRef} onChange={(e) => setAntRef(e.target.value)} placeholder="N° de operación (opcional)" />
            </label>
          </div>

          {mensajeAntMonto && <div className="alert alert-error" style={{ marginTop: 12 }}>{mensajeAntMonto}</div>}
          {errorAnt && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorAnt}</div>}

          <div className="modal-actions">
            <button className="btn btn-secondary" disabled={guardandoAnt} onClick={cerrarAnticipo}>Cancelar</button>
            <button className="btn btn-primary" disabled={!anticipoValido || guardandoAnt} onClick={registrarAnticipo}>
              {guardandoAnt ? "Guardando…" : "Registrar pago anticipado"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}