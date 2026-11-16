import { api, apiPost, apiPatch, apiDelete, apiPostForm, apiArchivoUrl } from './api';
import { hoyISO } from './formato';

// =====================================================================
// Tipos (y tipos de respuesta del backend)
// =====================================================================
export type Empleado = {
  id: number;
  nombre: string;
  email: string;
  cargo: string;
  ci: string;
  telefono: string;
  sueldo: number; 
  fechaRegistro: string;
  activo: boolean;
  historial_personal?: unknown[]; // <-- CORREGIDO AQUÍ (antes era any[])
};

// Tipo para lo que devuelve el backend
export type EmpleadoBackend = {
  id: string | number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  email: string;
  cargo: string;
  ci: string | number;
  telefono?: string | null;
  salario: string | number;
  fecha_inicio: string;
  estatus: boolean;
  historial_personal?: unknown[];
};

export type PagoBackend = {
  id: string | number;
  id_personal: string | number;
  monto: string | number;
  fecha: string;
  periodo?: string | null;
  metodo: string;
  referencia?: string | null;
  estado: string;
  comprobante_nombre?: string | null;
  comprobante_mime?: string | null;
  tiene_comprobante?: boolean;
  created_at?: string;
  tipo_pago?: { nombre: string };
};

export type EmpleadoForm = Omit<Empleado, 'id' | 'fechaRegistro' | 'activo' | 'historial_personal'>;
export type MetodoPago = 'Efectivo' | 'Transferencia';

export type Anticipo = {
  id: number;
  empleadoId: number;
  monto: number;
  fecha: string;
  metodo: MetodoPago;
  estado: 'Por descontar' | 'Descontado';
};

export type TipoMovimiento = 'Pago' | 'Anticipo';
export type EstadoMovimiento = 'Pagado' | 'Por descontar' | 'Descontado';
export type Comprobante = { nombre: string; tipo: string; url: string };

export type MovimientoPago = {
  id: number;
  empleadoId: number;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  fecha: string;
  metodo: MetodoPago;
  estado: EstadoMovimiento;
  comprobante: Comprobante | null; // url se carga al abrirlo (obtenerComprobante)
};

export type NuevoMovimientoPago = {
  empleadoId: number;
  tipo: TipoMovimiento;
  monto: number;
  fecha: string;
  metodo: MetodoPago;
  archivo: File;
};

export const PORCENTAJE_MAX_ANTICIPO = 0.5;
export const COMPROBANTE_MAX_MB = 5;
export const limiteAnticipo = (sueldo: number) => Math.round(sueldo * PORCENTAJE_MAX_ANTICIPO * 100) / 100;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function conceptoSueldo(fechaISO: string) {
  const [anio, mes] = fechaISO.split('-');
  return `Sueldo de ${MESES[Number(mes) - 1] ?? ''} ${anio}`.replace('  ', ' ');
}

export const CARGOS_SUGERIDOS = ['Portero', 'Limpieza', 'Seguridad', 'Jardinería', 'Mantenimiento', 'Secretaría'];

// =====================================================================
// CONEXIÓN CON EL BACKEND
// =====================================================================

export async function listarEmpleados(): Promise<Empleado[]> {
  const empleados = await api<EmpleadoBackend[]>('/personal');
  return empleados.map(e => ({
    id: Number(e.id),
    nombre: `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.trim(),
    email: e.email,
    cargo: e.cargo,
    ci: String(e.ci),
    telefono: e.telefono || '',
    sueldo: Number(e.salario),
    fechaRegistro: e.fecha_inicio.split('T')[0],
    activo: e.estatus,
    historial_personal: e.historial_personal || []
  }));
}

export async function crearEmpleado(d: EmpleadoForm): Promise<Empleado> {
  const partes = d.nombre.trim().split(' ');
  const nombre = partes[0] || d.nombre;
  const apellido_paterno = partes[1] || '';
  const apellido_materno = partes.slice(2).join(' ') || '';

  const res = await apiPost<EmpleadoBackend>('/personal', {
    nombre: nombre,
    apellido_paterno: apellido_paterno,
    apellido_materno: apellido_materno,
    cargo: d.cargo,
    ci: d.ci,
    telefono: d.telefono,
    email: d.email,
    sueldo: d.sueldo,
    fecha_inicio: hoyISO(),
    fecha_nacimiento: '1990-01-01',
    sexo: 'M'
  });
  
  return {
    id: Number(res.id),
    nombre: res.nombre + ' ' + res.apellido_paterno,
    email: res.email,
    cargo: res.cargo,
    ci: String(res.ci),
    telefono: res.telefono || '',
    sueldo: Number(res.salario),
    fechaRegistro: res.fecha_inicio.split('T')[0],
    activo: res.estatus
  };
}

export async function actualizarEmpleado(id: number, d: EmpleadoForm): Promise<Empleado> {
  const partes = d.nombre.trim().split(' ');
  const nombre = partes[0] || d.nombre;
  const apellido_paterno = partes[1] || '';
  const apellido_materno = partes.slice(2).join(' ') || '';

  const res = await apiPatch<EmpleadoBackend>(`/personal/${id}`, {
    nombre: nombre,
    apellido_paterno: apellido_paterno,
    apellido_materno: apellido_materno,
    cargo: d.cargo,
    telefono: d.telefono,
    email: d.email,
    sueldo: d.sueldo
  });
  
  return {
    id: Number(res.id),
    nombre: `${res.nombre} ${res.apellido_paterno} ${res.apellido_materno || ''}`.trim(),
    email: res.email,
    cargo: res.cargo,
    ci: String(res.ci),
    telefono: res.telefono || '',
    sueldo: Number(res.salario),
    fechaRegistro: res.fecha_inicio.split('T')[0],
    activo: res.estatus
  };
}

export async function eliminarEmpleado(id: number): Promise<void> {
  await apiDelete(`/personal/${id}`);
}

// =====================================================================
// PAGOS Y ANTICIPOS
// =====================================================================

const aFecha = (v?: string | null) => (v ? v.split('T')[0] : '');
const aMetodo = (v: string): MetodoPago => (v === 'Transferencia' ? 'Transferencia' : 'Efectivo');
const aEstado = (v: string): EstadoMovimiento =>
  v === 'Por descontar' || v === 'Descontado' ? v : 'Pagado';

function aMovimiento(m: PagoBackend): MovimientoPago {
  const esAnticipo = m.tipo_pago?.nombre === 'Anticipo';
  const fecha = aFecha(m.fecha);
  return {
    id: Number(m.id),
    empleadoId: Number(m.id_personal),
    tipo: esAnticipo ? 'Anticipo' : 'Pago',
    concepto: esAnticipo ? 'Anticipo de sueldo' : conceptoSueldo(aFecha(m.periodo) || fecha),
    monto: Number(m.monto),
    fecha,
    metodo: aMetodo(m.metodo),
    estado: aEstado(m.estado),
    comprobante: m.tiene_comprobante
      ? { nombre: m.comprobante_nombre || 'comprobante', tipo: m.comprobante_mime || 'application/pdf', url: `/personal/pagos/${m.id}/comprobante` }
      : null,
  };
}

export async function listarMovimientosPago(): Promise<MovimientoPago[]> {
  const pagos = await api<PagoBackend[]>('/personal/pagos');
  return pagos.map(aMovimiento);
}

export async function listarAnticipos(): Promise<Anticipo[]> {
  const pagos = await api<PagoBackend[]>('/personal/pagos?tipo=Anticipo');
  return pagos.map((m) => ({
    id: Number(m.id),
    empleadoId: Number(m.id_personal),
    monto: Number(m.monto),
    fecha: aFecha(m.fecha),
    metodo: aMetodo(m.metodo),
    estado: m.estado === 'Descontado' ? 'Descontado' : 'Por descontar',
  }));
}

export async function registrarMovimientoPago(d: NuevoMovimientoPago): Promise<MovimientoPago> {
  const form = new FormData();
  form.append('id_personal', String(d.empleadoId));
  form.append('tipo_pago', d.tipo === 'Anticipo' ? 'Anticipo' : 'Sueldo');
  form.append('monto', d.monto.toFixed(2));
  form.append('fecha', d.fecha);
  form.append('metodo', d.metodo);
  form.append('comprobante', d.archivo);
  return aMovimiento(await apiPostForm<PagoBackend>('/personal/pagos', form));
}

/** Descarga el comprobante con el token y devuelve una URL local para verlo. Liberar con URL.revokeObjectURL. */
export async function obtenerComprobante(c: Comprobante): Promise<Comprobante> {
  return { ...c, url: await apiArchivoUrl(c.url) };
}
