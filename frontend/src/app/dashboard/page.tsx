"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/DashboardLayout";
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
  ["Expensas y finanzas", "Pagos, saldos y movimientos", "/finanzas", WalletIcon],
  ["Mantenimiento", "Solicitudes y tareas", "/mantenimiento", WrenchIcon],
  ["Gestión documental", "Actas, reglamentos y archivos", "/documentos", FileIcon],
  ["Seguridad y auditoría", "Accesos y actividad", "/seguridad", ShieldIcon],
  ["Nube y respaldos", "Copias y protección de datos", "/respaldo", ShieldIcon],
];

const adminCards = [
  ["Copropietarios", "24", "Registros activos", UsersIcon],
  ["Departamentos", "32", "Unidades registradas", BuildingIcon],
  ["Expensas", "Bs. 18.450", "Recaudación del mes", WalletIcon],
  ["Documentos", "86", "Archivos almacenados", FileIcon],
] as const;

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
  return <>
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Panel administrativo</h1><p>Gestiona de forma centralizada la administración del edificio.</p></div></div>
    <section className="welcome-banner"><div><span className="eyebrow">RESUMEN GENERAL</span><h2>Hola, {name.split(" ")[0]} 👋</h2><p>Supervisa personas, unidades, finanzas, documentos, mantenimiento y seguridad desde un solo lugar.</p></div><div className="banner-orb"><BuildingIcon size={54} /></div></section>
    <div className="metric-grid">{adminCards.map(([label, value, note, Icon]) => <Metric key={label} icon={Icon} label={label} value={value} note={note} />)}</div>
    <section className="dashboard-modules"><div className="section-heading"><div><h2>Módulos de administración</h2><p>Todos los módulos administrativos están disponibles directamente en la barra lateral.</p></div></div><div className="admin-action-grid">{adminActions.map(([label, description, href, Icon]) => <Link href={href} className="admin-action-card" key={label}><div className="admin-action-icon"><Icon size={24} /></div><div><strong>{label}</strong><span>{description}</span></div><b>→</b></Link>)}</div></section>
    <section className="dashboard-bottom"><div className="panel"><div className="panel-heading"><div><h3>Actividad del edificio</h3><p>Indicadores que requieren seguimiento administrativo.</p></div></div><div className="role-list"><div><CheckIcon size={18}/><span>Recaudación de expensas del mes actualizada</span><b>Al día</b></div><div><FileIcon size={18}/><span>Documentos pendientes de clasificación</span><b>4</b></div><div><WrenchIcon size={18}/><span>Solicitudes de mantenimiento abiertas</span><b>8</b></div></div></div><div className="panel"><div className="panel-heading"><div><h3>Seguridad y auditoría</h3><p>Control de accesos y actividad reciente.</p></div></div><div className="audit-highlight"><ShieldIcon size={26}/><div><strong>Sesión administrativa activa</strong><p>Rol con acceso completo a los módulos de gestión.</p></div></div></div></section>
  </>;
}

function OwnerDashboard({ name, unit }: { name: string; unit: string }) {
  const [photos, setPhotos] = useState<string[]>(() => readUnitPhotos(unit));

  function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = [...photos, String(reader.result)];
      setPhotos(next);
      localStorage.setItem(`edificio_unit_photos_${unit}`, JSON.stringify(next));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">COPROPIETARIO</span><h1>Mi espacio y mis finanzas</h1><p>Hola, {name.split(" ")[0]}. Aquí tienes la información exclusiva de tu propiedad.</p></div></div>
    <RoleHero eyebrow="MI PROPIEDAD" title={<>Tu departamento,<br/><span>a tu manera.</span></>} text={`Administra ${unit}, comparte fotografías con tus ocupantes y controla tus obligaciones financieras.`} />
    <div className="metric-grid"><Metric icon={BuildingIcon} label="Mi departamento" value={unit} note="Unidad de tu propiedad"/><Metric icon={WalletIcon} label="Expensas" value="Bs. 1.280" note="Septiembre · Al día"/><Metric icon={ShieldIcon} label="Auditoría" value="24" note="Eventos recientes"/><Metric icon={FileIcon} label="Documentos" value="18" note="Disponibles para ti"/></div>

    <section className="owner-grid">
      <div className="panel owner-property-panel"><div className="panel-heading"><div><h3>Mi departamento {unit}</h3><p>Las fotografías que subas aquí podrán ser visualizadas por el inquilino de esta unidad.</p></div><label className="upload-photo-btn"><CameraIcon size={17}/> Subir foto<input type="file" accept="image/*" onChange={addPhoto}/></label></div><div className="owner-photo-grid">{photos.length ? photos.map((photo, index) => <img key={`${photo.slice(-20)}-${index}`} src={photo} alt={`Foto de ${unit} ${index + 1}`} />) : <div className="photo-empty"><CameraIcon size={26}/><strong>Aún no hay fotografías</strong><span>Sube imágenes del departamento para que el inquilino pueda conocerlo.</span></div>}</div></div>
      <div className="panel"><div className="panel-heading"><div><h3>Mis finanzas</h3><p>Resumen de tus obligaciones como copropietario.</p></div></div><div className="finance-summary"><span className="eyebrow">EXPENSAS SEPTIEMBRE 2026</span><strong>Bs. 1.280,00</strong><span className="status status-success"><i/> Al día</span><Link href="/finanzas" className="btn btn-primary">Ver finanzas</Link></div></div>
    </section>

    <section className="dashboard-bottom"><div className="panel"><div className="panel-heading"><div><h3>Auditoría de mi actividad</h3><p>Acciones realizadas recientemente en tu cuenta.</p></div></div><div className="role-list"><div><ShieldIcon size={18}/><span>Inicio de sesión registrado</span><b>Hoy</b></div><div><CameraIcon size={18}/><span>Fotografías de la unidad</span><b>{photos.length}</b></div><div><WalletIcon size={18}/><span>Última expensa registrada</span><b>Aprobada</b></div></div></div><div className="panel"><div className="panel-heading"><div><h3>Accesos de copropietario</h3><p>Funciones que puedes utilizar.</p></div></div><div className="quick-grid"><Link href="/finanzas" className="quick-action"><WalletIcon size={19}/><span>Expensas y finanzas</span><b>→</b></Link><Link href="/seguridad" className="quick-action"><ShieldIcon size={19}/><span>Seguridad y auditoría</span><b>→</b></Link><Link href="/documentos" className="quick-action"><FileIcon size={19}/><span>Mis documentos</span><b>→</b></Link><Link href="/mantenimiento" className="quick-action"><WrenchIcon size={19}/><span>Mantenimiento</span><b>→</b></Link></div></div></section>
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
  return <><div className="page-heading"><div><span className="eyebrow">{role}</span><h1>{title}</h1><p>{subtitle}</p></div></div><RoleHero eyebrow="RESUMEN" title={<>Hola, {name.split(" ")[0]} <span>👋</span></>} text={subtitle} /><div className="metric-grid"><Metric icon={BuildingIcon} label="Departamentos" value="32" note="Unidades registradas"/><Metric icon={FileIcon} label="Documentos" value="18" note="Disponibles"/><Metric icon={BellIcon} label="Comunicados" value="6" note="Avisos recientes"/><Metric icon={ShieldIcon} label="Estado" value="Activo" note="Operación normal"/></div></>;
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

  useMemo(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const content = useMemo(() => {
    if (!session) return null;
    const { role, name, unit } = session;
    if (role === "ADMINISTRADOR") return <AdminDashboard name={name} />;
    if (role === "COPROPIETARIO") return <OwnerDashboard name={name} unit={unit} key={unit} />;
    if (role === "INQUILINO") return <TenantDashboard name={name} unit={unit} key={unit} />;
    return <GenericDashboard role={role} name={name} />;
  }, [session]);

  if (!session) return <div className="auth-loading">Cargando tu panel…</div>;
  return <DashboardLayout active="dashboard">{content}</DashboardLayout>;
}