"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { api } from "../../../lib/api";
import { ESTADOS, bs, cargarDeudasApi, fechaLarga, nombrePeriodo, type Deuda } from "../../../lib/mi-cuenta";
import {
  BellIcon, BuildingIcon, CameraIcon, CheckIcon, CreditCardIcon, FileIcon,
  HomeIcon, ShieldIcon, UsersIcon, WalletIcon, WrenchIcon,
} from "../../../components/Icons";

type Role = "ADMINISTRADOR" | "COPROPIETARIO" | "INQUILINO" | "DIRECTORIO" | "CONSULTA";
type IconType = React.ComponentType<{ size?: number }>;
type Action = [string, string, string, IconType];

const adminActions: Action[] = [
  ["Copropietarios", "Administración de propietarios", "/copropietarios", UsersIcon],
  ["Inquilinos", "Gestión de ocupantes", "/inquilinos", HomeIcon],
  ["Departamentos", "Unidades del edificio", "/departamentos", BuildingIcon],
  ["Parqueos y bauleras", "Espacios y asignaciones", "/espacios", BuildingIcon],
  ["Asociaciones", "Comités y relaciones", "/asociaciones", UsersIcon],
  ["Historial de ocupantes", "Trazabilidad de unidades", "/historial-ocupantes", HomeIcon],
  ["Empleados", "Registro y datos del personal", "/personal", UsersIcon], // NUEVA
  ["Pagos a empleados", "Sueldos, anticipos e historial", "/pagos-personal", WalletIcon], // NUEVA
  ["Expensas y finanzas", "Pagos, saldos y movimientos", "/finanzas", WalletIcon],
  ["Mantenimiento", "Solicitudes y tareas", "/mantenimiento", WrenchIcon],
  ["Comunicados", "Avisos por WhatsApp y correo", "/comunicados", FileIcon], // NUEVA
  ["Gestión documental", "Actas, reglamentos y archivos", "/documentos", FileIcon],
  ["Seguridad y auditoría", "Accesos y actividad", "/seguridad", ShieldIcon],
  ["Nube y respaldos", "Copias y protección de datos", "/respaldo", ShieldIcon],
];

// Cifras reales del edificio, leídas de la API
type ResumenEdificio = {
  copropietarios: number;
  departamentos: number;
  recaudacionMes: number;
  documentos: number;
  inquilinos: number;
  deptosConDeudaVencida: number;
  espaciosSinAsignar: number;
};

// null = esa cifra no se pudo cargar (p. ej. el rol no tiene acceso)
type Resumen = { [K in keyof ResumenEdificio]: number | null };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const formatoBs = (monto: number) =>
  `Bs. ${monto.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// "…" mientras carga, "—" si no se pudo obtener
const mostrar = (valor: number | null | undefined, formato: (n: number) => string = String) =>
  valor === undefined ? "…" : valor === null ? "—" : formato(valor);

/**
 * Lee las cifras del panel. Las consultas van una tras otra para no ocupar varias
 * conexiones del pooler de Supabase a la vez, y si una falla las demás se muestran igual.
 */
function useResumenEdificio() {
  const [resumen, setResumen] = useState<Partial<Resumen>>({});

  useEffect(() => {
    const cargar = async () => {
      const mesActual = new Date().toISOString().slice(0, 7);
      const activos = (lista: { estatus?: boolean }[]) => lista.filter((x) => x.estatus !== false).length;

      // Cada consulta pide su ruta y calcula una cifra
      const consulta = <T,>(ruta: string, calcular: (data: T) => number) =>
        async () => calcular(await api<T>(ruta));

      const consultas: [keyof ResumenEdificio, string, () => Promise<number>][] = [
        ["copropietarios", "/copropietarios",
          consulta<{ copropietarios: { estatus?: boolean }[] }>("/copropietarios", (d) => activos(d.copropietarios))],
        ["departamentos", "/departamentos",
          consulta<{ total: number }>("/departamentos", (d) => d.total)],
        // Pagos de expensas y pagos anticipados registrados este mes
        ["recaudacionMes", "/expensas/pagos/historial",
          consulta<{ fecha: string; monto: number }[]>("/expensas/pagos/historial", (d) =>
            d.filter((m) => m.fecha.startsWith(mesActual)).reduce((total, m) => total + m.monto, 0))],
        ["documentos", "/documentos",
          consulta<{ total: number }>("/documentos", (d) => d.total)],
        ["inquilinos", "/inquilinos",
          consulta<{ inquilinos: { estatus?: boolean }[] }>("/inquilinos", (d) => activos(d.inquilinos))],
        ["deptosConDeudaVencida", "/expensas/pagos/resumen",
          consulta<{ deudas: { vencida: boolean; departamento: number }[] }>("/expensas/pagos/resumen", (d) =>
            new Set(d.deudas.filter((x) => x.vencida).map((x) => x.departamento)).size)],
        ["espaciosSinAsignar", "/espacios",
          consulta<{ total: number; asignados: number }>("/espacios", (d) => d.total - d.asignados)],
      ];

      for (const [clave, ruta, obtener] of consultas) {
        let valor: number | null;
        try {
          valor = await obtener();
        } catch (e) {
          console.error(`Dashboard: no se pudo cargar ${ruta}`, e);
          valor = null;
        }
        setResumen((actual) => ({ ...actual, [clave]: valor }));
      }
    };
    cargar();
  }, []);

  return resumen;
}

function normalizeRole(value: string | null): Role {
  const role = (value || "").toUpperCase();
  if (["ADMINISTRADOR", "COPROPIETARIO", "INQUILINO", "DIRECTORIO", "CONSULTA"].includes(role)) return role as Role;
  return "CONSULTA";
}

function readUnitPhotos(unit: string): string[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem(`edificio_unit_photos_${unit}`);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch { return []; }
}

function Metric({ icon: Icon, label, value, note }: { icon: IconType; label: string; value: string; note: string }) {
  return <div className="metric-card"><div className="metric-icon"><Icon size={20} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function RoleHero({ eyebrow, title, text, icon = BuildingIcon }: { eyebrow: string; title: React.ReactNode; text: string; icon?: IconType }) {
  const Icon = icon;
  return <section className="role-hero"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div><div className="role-hero-icon"><Icon size={52} /></div></section>;
}

function AdminDashboard({ name }: { name: string }) {
  const r = useResumenEdificio();
  const mes = MESES[new Date().getMonth()];
  const adminCards = [
    ["Copropietarios", mostrar(r.copropietarios), "Registros activos", UsersIcon],
    ["Departamentos", mostrar(r.departamentos), "Unidades registradas", BuildingIcon],
    ["Expensas", mostrar(r.recaudacionMes, formatoBs), `Recaudación de ${mes}`, WalletIcon],
    ["Documentos", mostrar(r.documentos), "Archivos almacenados", FileIcon],
  ] as const;
  const alDia = r.deptosConDeudaVencida === 0;

  return <>
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Panel administrativo</h1><p>Gestiona de forma centralizada la administración del edificio.</p></div></div>
    <section className="welcome-banner"><div><span className="eyebrow">RESUMEN GENERAL</span><h2>Hola, {name.split(" ")[0]} 👋</h2><p>Supervisa personas, unidades, finanzas, documentos, mantenimiento y seguridad desde un solo lugar.</p></div><div className="banner-orb"><BuildingIcon size={54} /></div></section>
    <div className="metric-grid">{adminCards.map(([label, value, note, Icon]) => <Metric key={label} icon={Icon} label={label} value={value} note={note} />)}</div>
    <section className="dashboard-modules"><div className="section-heading"><div><h2>Módulos de administración</h2><p>Todos los módulos administrativos están disponibles directamente en la barra lateral.</p></div></div><div className="admin-action-grid">{adminActions.map(([label, description, href, Icon]) => <Link href={href} className="admin-action-card" key={label}><div className="admin-action-icon"><Icon size={24} /></div><div><strong>{label}</strong><span>{description}</span></div><b>→</b></Link>)}</div></section>
    <section className="dashboard-bottom"><div className="panel"><div className="panel-heading"><div><h3>Actividad del edificio</h3><p>Indicadores que requieren seguimiento administrativo.</p></div></div><div className="role-list"><div><CheckIcon size={18}/><span>{alDia ? "Expensas del edificio al día" : "Departamentos con expensas vencidas"}</span><b>{alDia ? "Al día" : mostrar(r.deptosConDeudaVencida)}</b></div><div><HomeIcon size={18}/><span>Inquilinos activos</span><b>{mostrar(r.inquilinos)}</b></div><div><BuildingIcon size={18}/><span>Parqueos y bauleras sin asignar</span><b>{mostrar(r.espaciosSinAsignar)}</b></div></div></div><div className="panel"><div className="panel-heading"><div><h3>Seguridad y auditoría</h3><p>Control de accesos y actividad reciente.</p></div></div><div className="audit-highlight"><ShieldIcon size={26}/><div><strong>Sesión administrativa activa</strong><p>Rol con acceso completo a los módulos de gestión.</p></div></div></div></section>
  </>;
}

// =====================================================================
// Mi departamento (copropietario)
// =====================================================================

type Espacio = { numero: number; piso: number; discapacitados?: boolean };
type MiDepartamento = {
  id: string;
  numero: number;
  codigo: string;
  piso: number;
  tipo: string | null;
  superficie_m2: number;
  dormitorios: number;
  banos: number;
  salas: number;
  amueblado: boolean;
  descripcion: string | null;
  desde: string;
  parqueos: Espacio[];
  bauleras: Espacio[];
  ocupantes: { nombre: string; rol: string | null; desde: string }[];
};
type MisDepartamentos = {
  departamentos: MiDepartamento[];
  actividad: { eventos30Dias: number; ultimos: { accion: string; tabla: string; fecha: string }[] };
};

// BACKEND: GET /departamentos/mios → mis departamentos y mi actividad reciente
const cargarMisDepartamentosApi = () => api<MisDepartamentos>("/departamentos/mios");
// BACKEND: GET /documentos → documentos visibles para mí (solo se usa el total)
const contarDocumentosApi = () => api<{ total: number }>("/documentos").then((r) => r.total);

const ACCIONES: Record<string, string> = { INSERT: "Registro", UPDATE: "Cambio", DELETE: "Eliminación" };
const textoActividad = (a: { accion: string; tabla: string }) =>
  `${ACCIONES[a.accion] ?? a.accion} en ${a.tabla.replace(/_/g, " ")}`;
const fechaCortaLocal = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short" });
const espacios = (lista: Espacio[]) => (lista.length ? lista.map((e) => `N° ${e.numero}`).join(", ") : "—");

// Fotos del departamento: por ahora se guardan solo en este navegador (no hay tabla en la BD)
function FotosDepartamento({ clave, etiqueta }: { clave: string; etiqueta: string }) {
  const [photos, setPhotos] = useState<string[]>(() => readUnitPhotos(clave));

  function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = [...photos, String(reader.result)];
      setPhotos(next);
      try { localStorage.setItem(`edificio_unit_photos_${clave}`, JSON.stringify(next)); } catch { /* sin espacio */ }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return <>
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 18px" }}>
      <label className="upload-photo-btn"><CameraIcon size={17}/> Subir foto<input type="file" accept="image/*" onChange={addPhoto}/></label>
    </div>
    <div className="owner-photo-grid">{photos.length ? photos.map((photo, index) => <img key={`${photo.slice(-20)}-${index}`} src={photo} alt={`Foto de ${etiqueta} ${index + 1}`} />) : <div className="photo-empty"><CameraIcon size={26}/><strong>Aún no hay fotografías</strong><span>Sube imágenes del departamento para que el inquilino pueda conocerlo.</span></div>}</div>
  </>;
}

function OwnerDashboard({ name }: { name: string }) {
  const [datos, setDatos] = useState<MisDepartamentos | null>(null);
  const [deudas, setDeudas] = useState<Deuda[] | null>(null);
  const [documentos, setDocumentos] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarMisDepartamentosApi()
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar tu departamento."));
    // Si alguna de estas falla, solo esa cifra queda sin dato
    cargarDeudasApi().then(setDeudas).catch(() => setDeudas(null));
    contarDocumentosApi().then(setDocumentos).catch(() => setDocumentos(null));
  }, []);

  const depto = datos?.departamentos[0] ?? null;
  const otros = (datos?.departamentos.length ?? 0) - 1;
  const etiqueta = depto ? `Dpto. ${depto.numero}` : datos ? "Sin departamento" : "…";
  const deudaTotal = deudas?.reduce((t, d) => t + d.total, 0) ?? 0;
  const actual = deudas && deudas.length ? deudas[deudas.length - 1] : null;
  const vencidas = deudas?.filter((d) => d.estado === "vencida").length ?? 0;

  const notaDepto = depto
    ? `Piso ${depto.piso}${depto.tipo ? ` · Tipo ${depto.tipo}` : ""}${otros > 0 ? ` · y ${otros} más` : ""}`
    : "Unidad de tu propiedad";
  const notaExpensas = !deudas
    ? "Sin dato"
    : deudas.length === 0
      ? "Al día"
      : vencidas > 0
        ? `${vencidas} vencida${vencidas > 1 ? "s" : ""}`
        : `${deudas.length} pendiente${deudas.length > 1 ? "s" : ""}`;

  return <>
    <div className="page-heading"><div><span className="eyebrow">COPROPIETARIO</span><h1>Mi espacio y mis finanzas</h1><p>Hola, {name.split(" ")[0]}. Aquí tienes la información exclusiva de tu propiedad.</p></div></div>
    {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
    <RoleHero eyebrow="MI PROPIEDAD" title={<>Tu departamento,<br/><span>a tu manera.</span></>} text={`Administra ${etiqueta}, comparte fotografías con tus ocupantes y controla tus obligaciones financieras.`} />
    <div className="metric-grid">
      <Metric icon={BuildingIcon} label="Mi departamento" value={etiqueta} note={notaDepto}/>
      <Metric icon={WalletIcon} label="Expensas" value={deudas ? bs(deudaTotal) : "—"} note={notaExpensas}/>
      <Metric icon={ShieldIcon} label="Actividad" value={datos ? String(datos.actividad.eventos30Dias) : "…"} note="Eventos en los últimos 30 días"/>
      <Metric icon={FileIcon} label="Documentos" value={documentos === null ? "—" : String(documentos)} note="Disponibles para ti"/>
    </div>

    <section className="owner-grid">
      <div className="panel owner-property-panel">
        <div className="panel-heading"><div><h3>Mi departamento {depto ? depto.numero : ""}</h3><p>Las fotografías que subas aquí podrán ser visualizadas por el inquilino de esta unidad.</p></div></div>
        {depto && (
          <div className="role-list">
            <div><BuildingIcon size={18}/><span>Piso {depto.piso} · {depto.superficie_m2} m² · {depto.dormitorios} dormitorios · {depto.banos} baños{depto.amueblado ? " · Amueblado" : ""}</span><b>Código {depto.codigo}</b></div>
            <div><HomeIcon size={18}/><span>Parqueos: {espacios(depto.parqueos)} · Bauleras: {espacios(depto.bauleras)}</span><b>Desde {fechaLarga(depto.desde)}</b></div>
            <div><UsersIcon size={18}/><span>{depto.ocupantes.length ? depto.ocupantes.map((o) => `${o.nombre}${o.rol ? ` (${o.rol.toLowerCase()})` : ""}`).join(", ") : "Sin otros ocupantes"}</span><b>Ocupantes</b></div>
          </div>
        )}
        {depto && <FotosDepartamento key={depto.numero} clave={`dpto-${depto.numero}`} etiqueta={etiqueta} />}
        {datos && !depto && <div className="empty-state">No tienes un departamento asignado. Consulta con la administración.</div>}
      </div>
      <div className="panel">
        <div className="panel-heading"><div><h3>Mis finanzas</h3><p>Resumen de tus obligaciones como copropietario.</p></div></div>
        <div className="finance-summary">
          <span className="eyebrow">{actual ? `EXPENSAS ${nombrePeriodo(actual.periodo).toUpperCase()}` : "EXPENSAS"}</span>
          <strong>{deudas ? bs(actual ? actual.total : 0) : "—"}</strong>
          {deudas && (actual
            ? <span className={ESTADOS[actual.estado].clase}><i/> {ESTADOS[actual.estado].texto}</span>
            : <span className="status status-success"><i/> Al día</span>)}
          <Link href="/mis-expensas" className="btn btn-primary">Ver expensas</Link>
        </div>
      </div>
    </section>

    <section className="dashboard-bottom">
      <div className="panel">
        <div className="panel-heading"><div><h3>Mi actividad reciente</h3><p>Acciones realizadas recientemente con tu cuenta.</p></div></div>
        <div className="role-list">
          {datos && datos.actividad.ultimos.length
            ? datos.actividad.ultimos.map((a, i) => <div key={i}><ShieldIcon size={18}/><span>{textoActividad(a)}</span><b>{fechaCortaLocal(a.fecha)}</b></div>)
            : <div><ShieldIcon size={18}/><span>{datos ? "Sin actividad registrada" : "Cargando…"}</span><b>—</b></div>}
        </div>
      </div>
      <div className="panel"><div className="panel-heading"><div><h3>Accesos de copropietario</h3><p>Funciones que puedes utilizar.</p></div></div><div className="quick-grid"><Link href="/mis-expensas" className="quick-action"><WalletIcon size={19}/><span>Expensas</span><b>→</b></Link><Link href="/mi-estado-cuenta" className="quick-action"><WalletIcon size={19}/><span>Estado de cuenta</span><b>→</b></Link><Link href="/mis-extras" className="quick-action"><WalletIcon size={19}/><span>Extras</span><b>→</b></Link><Link href="/mis-documentos" className="quick-action"><FileIcon size={19}/><span>Documentos del edificio</span><b>→</b></Link></div></div>
    </section>
  </>;
}

function TenantDashboard({ name, unit }: { name: string; unit: string }) {
  const [photos] = useState<string[]>(() => readUnitPhotos(unit));

  return <>
    <div className="page-heading"><div><span className="eyebrow">INQUILINO</span><h1>Mi hogar y mis pagos</h1><p>Hola, {name.split(" ")[0]}. Consulta aquí todo lo relacionado con tu vivienda.</p></div></div>
    <RoleHero eyebrow="ESPACIO PERSONAL" title={<>Tu hogar,<br/><span>siempre a mano.</span></>} text={`Consulta tu departamento ${unit}, las fotografías compartidas por el propietario, tus vouchers y tus pagos.`} icon={HomeIcon} />
    <div className="metric-grid"><Metric icon={HomeIcon} label="Mi departamento" value={unit} note="Unidad donde habitas"/><Metric icon={WalletIcon} label="Saldo pendiente" value="Bs. 320" note="Vence el 10/09/2026"/><Metric icon={CreditCardIcon} label="Vouchers" value="3" note="Comprobantes registrados"/><Metric icon={WrenchIcon} label="Solicitudes" value="2" note="En seguimiento"/></div>

    <section className="tenant-grid">
      <div className="panel tenant-home-panel"><div className="panel-heading"><div><h3>Mi departamento {unit}</h3><p>Fotografías compartidas por el copropietario.</p></div></div><div className="tenant-photo-grid">{photos.length ? photos.map((photo, index) => <img key={`${photo.slice(-20)}-${index}`} src={photo} alt={`Fotografía del departamento ${index + 1}`} />) : <div className="photo-empty"><HomeIcon size={27}/><strong>El propietario todavía no ha compartido fotos</strong><span>Cuando las suba, aparecerán aquí.</span></div>}</div></div>
      <div className="panel tenant-payment-panel"><div className="panel-heading"><div><h3>Pagos y vouchers</h3><p>Consulta y registra tus pagos de expensas.</p></div></div><div className="payment-card"><span className="eyebrow">SALDO PENDIENTE</span><strong>Bs. 320,00</strong><span className="status status-warning"><i/> Pendiente</span><Link href="/finanzas" className="btn btn-primary"><CreditCardIcon size={17}/> Ver cómo pagar</Link></div><div className="voucher-mini"><div><CheckIcon size={17}/><span>Expensas agosto 2026<small>Voucher aprobado · Bs. 1.280</small></span></div><Link href="/finanzas">Ver vouchers →</Link></div></div>
    </section>

    <section className="dashboard-bottom"><div className="panel"><div className="panel-heading"><div><h3>Lo que puedes hacer</h3><p>Acciones disponibles para tu rol de inquilino.</p></div></div><div className="quick-grid"><Link href="/finanzas" className="quick-action"><WalletIcon size={19}/><span>Pagar expensas</span><b>→</b></Link><Link href="/finanzas" className="quick-action"><CreditCardIcon size={19}/><span>Mis vouchers</span><b>→</b></Link><Link href="/mantenimiento" className="quick-action"><WrenchIcon size={19}/><span>Solicitar mantenimiento</span><b>→</b></Link><Link href="/documentos" className="quick-action"><FileIcon size={19}/><span>Mis documentos</span><b>→</b></Link></div></div><div className="panel"><div className="panel-heading"><div><h3>Información para residentes</h3><p>Avisos relevantes para tu vivienda.</p></div></div><div className="role-list"><div><BellIcon size={18}/><span>Mantenimiento programado del edificio</span><b>12/09</b></div><div><FileIcon size={18}/><span>Nuevo comunicado disponible</span><b>Nuevo</b></div><div><ShieldIcon size={18}/><span>Tu sesión está protegida</span><b>OK</b></div></div></div></section>
  </>;
}

function GenericDashboard({ role, name }: { role: Role; name: string }) {
  const labels: Record<string, [string, string]> = {
    DIRECTORIO: ["Panel del directorio", "Supervisa la gestión y las decisiones de la comunidad."],
    CONSULTA: ["Panel de consulta", "Consulta únicamente la información autorizada del edificio."],
  };
  const [title, subtitle] = labels[role] || ["Panel", "Información del edificio."];
  const r = useResumenEdificio();
  return <><div className="page-heading"><div><span className="eyebrow">{role}</span><h1>{title}</h1><p>{subtitle}</p></div></div><RoleHero eyebrow="RESUMEN" title={<>Hola, {name.split(" ")[0]} <span>👋</span></>} text={subtitle} /><div className="metric-grid"><Metric icon={BuildingIcon} label="Departamentos" value={mostrar(r.departamentos)} note="Unidades registradas"/><Metric icon={FileIcon} label="Documentos" value={mostrar(r.documentos)} note="Disponibles"/><Metric icon={UsersIcon} label="Copropietarios" value={mostrar(r.copropietarios)} note="Registros activos"/><Metric icon={ShieldIcon} label="Estado" value="Activo" note="Operación normal"/></div></>;
}

type DashboardSession = { role: Role; name: string; unit: string };

function readDashboardSession(): DashboardSession | null {
  if (typeof window === "undefined") return null;
  const activa = sessionStorage.getItem("sesionActiva");
  if (!activa) return null;
  return {
    role: normalizeRole(sessionStorage.getItem("rolUsuario")),
    name: sessionStorage.getItem("nombreUsuario") || "Usuario",
    unit: sessionStorage.getItem("departamentoUsuario") || "Sin unidad",
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [session] = useState<DashboardSession | null>(() => readDashboardSession());

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const content = useMemo(() => {
    if (!session) return null;
    const { role, name, unit } = session;
    if (role === "ADMINISTRADOR") return <AdminDashboard name={name} />;
    if (role === "COPROPIETARIO") return <OwnerDashboard name={name} />;
    if (role === "INQUILINO") return <TenantDashboard name={name} unit={unit} key={unit} />;
    return <GenericDashboard role={role} name={name} />;
  }, [session]);

  if (!session) return <div className="auth-loading">Cargando tu panel…</div>;
  return <DashboardLayout active="dashboard">{content}</DashboardLayout>;
}