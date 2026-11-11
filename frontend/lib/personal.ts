import { api, apiPost, apiPatch, apiDelete } from './api';
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
  comprobante: Comprobante;
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

export async function listarAnticipos(): Promise<Anticipo[]> {
  const movimientos = await api<PagoBackend[]>('/personal/pagos');
  return movimientos
    .filter(m => m.tipo_pago?.nombre === 'Anticipo')
    .map(m => ({
      id: Number(m.id),
      empleadoId: Number(m.id_personal),
      monto: Number(m.monto),
      fecha: m.created_at?.split('T')[0] || '',
      metodo: 'Efectivo',
      estado: 'Por descontar'
    }));
}

export async function listarMovimientosPago(): Promise<MovimientoPago[]> {
  const movimientos = await api<PagoBackend[]>('/personal/pagos');
  return movimientos.map(m => ({
    id: Number(m.id),
    empleadoId: Number(m.id_personal),
    tipo: m.tipo_pago?.nombre === 'Anticipo' ? 'Anticipo' : 'Pago',
    concepto: m.tipo_pago?.nombre || 'Pago',
    monto: Number(m.monto),
    fecha: m.created_at?.split('T')[0] || '',
    metodo: 'Efectivo',
    estado: m.tipo_pago?.nombre === 'Anticipo' ? 'Por descontar' : 'Pagado',
    comprobante: { nombre: 'comprobante.pdf', tipo: 'application/pdf', url: '#' }
  }));
}

export async function registrarMovimientoPago(d: NuevoMovimientoPago): Promise<MovimientoPago> {
  const res = await apiPost<PagoBackend>('/personal/pagos', {
    id_personal: d.empleadoId,
    monto: d.monto,
    tipo_pago: d.tipo,
    fecha: d.fecha
  });
  
  return {
    id: Number(res.id),
    empleadoId: Number(res.id_personal),
    tipo: d.tipo,
    concepto: d.tipo === 'Pago' ? conceptoSueldo(d.fecha) : 'Anticipo de sueldo',
    monto: Number(res.monto),
    fecha: d.fecha,
    metodo: d.metodo,
    estado: d.tipo === 'Pago' ? 'Pagado' : 'Por descontar',
    comprobante: { nombre: 'comprobante.pdf', tipo: 'application/pdf', url: '#' }
  };
}