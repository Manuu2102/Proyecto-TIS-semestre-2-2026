import { formatoBs, hoyISO } from './formato'

// =====================================================================
// Tipos de la pantalla de personal (empleados)
// =====================================================================

export type Empleado = {
  id: number
  nombre: string // nombre completo
  email: string
  cargo: string
  ci: string
  telefono: string
  sueldo: number // sueldo mensual en Bs
  fechaRegistro: string // YYYY-MM-DD
  activo: boolean
}

export type EmpleadoForm = Omit<Empleado, 'id' | 'fechaRegistro' | 'activo'>

export type MetodoPago = 'Efectivo' | 'Transferencia'

export type Anticipo = {
  id: number
  empleadoId: number
  monto: number
  fecha: string // YYYY-MM-DD
  metodo: MetodoPago
  estado: 'Por descontar' | 'Descontado'
}

// ---- Pagos a empleados (sueldos y anticipos) ----

export type TipoMovimiento = 'Pago' | 'Anticipo'
export type EstadoMovimiento = 'Pagado' | 'Por descontar' | 'Descontado'
export type Comprobante = { nombre: string; tipo: string; url: string }

export type MovimientoPago = {
  id: number
  empleadoId: number
  tipo: TipoMovimiento
  concepto: string
  monto: number
  fecha: string // YYYY-MM-DD
  metodo: MetodoPago
  estado: EstadoMovimiento
  comprobante: Comprobante
}

export type NuevoMovimientoPago = {
  empleadoId: number
  tipo: TipoMovimiento
  monto: number
  fecha: string
  metodo: MetodoPago
  archivo: File
}

export const PORCENTAJE_MAX_ANTICIPO = 0.5
export const COMPROBANTE_MAX_MB = 5

/** Monto máximo de un anticipo: 50 % del sueldo mensual. */
export const limiteAnticipo = (sueldo: number) =>
  Math.round(sueldo * PORCENTAJE_MAX_ANTICIPO * 100) / 100

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]

/** "2026-11-03" → "Sueldo de noviembre 2026" */
export function conceptoSueldo(fechaISO: string) {
  const [anio, mes] = fechaISO.split('-')
  return `Sueldo de ${MESES[Number(mes) - 1] ?? ''} ${anio}`.replace('  ', ' ')
}

export const CARGOS_SUGERIDOS = [
  'Portero',
  'Limpieza',
  'Seguridad',
  'Jardinería',
  'Mantenimiento',
  'Secretaría'
]

// =====================================================================
// DATOS DE EJEMPLO EN MEMORIA
// Mientras no exista el backend, todo vive en estas variables. Se mantienen
// al navegar entre pantallas, pero se reinician al recargar la página.
// Cuando haya API, solo hay que reemplazar el cuerpo de las funciones de
// abajo por llamadas a `api`, `apiPost`, `apiPatch` y `apiDelete`
// (lib/api.ts); las pantallas no cambian.
// =====================================================================

let empleados: Empleado[] = [
  {
    id: 1,
    nombre: 'Carlos Mamani Quispe',
    email: 'carlos.mamani@edificiocentral.test',
    cargo: 'Portero',
    ci: '6543210',
    telefono: '71234567',
    sueldo: 2800,
    fechaRegistro: '2025-03-10',
    activo: true
  },
  {
    id: 2,
    nombre: 'María Fernanda Rojas Cruz',
    email: 'maria.rojas@edificiocentral.test',
    cargo: 'Limpieza',
    ci: '7890123',
    telefono: '70123456',
    sueldo: 2500,
    fechaRegistro: '2025-06-02',
    activo: true
  },
  {
    id: 3,
    nombre: 'Juan Pablo Choque Flores',
    email: 'juan.choque@edificiocentral.test',
    cargo: 'Seguridad',
    ci: '5432109',
    telefono: '76543210',
    sueldo: 3200,
    fechaRegistro: '2025-08-18',
    activo: true
  },
  {
    id: 4,
    nombre: 'Lucía Gutiérrez Vargas',
    email: 'lucia.gutierrez@edificiocentral.test',
    cargo: 'Secretaría',
    ci: '8123456',
    telefono: '69876543',
    sueldo: 3500,
    fechaRegistro: '2026-01-12',
    activo: true
  },
  {
    id: 5,
    nombre: 'Roberto Alanoca Condori',
    email: 'roberto.alanoca@edificiocentral.test',
    cargo: 'Mantenimiento',
    ci: '4987654',
    telefono: '72345678',
    sueldo: 3800,
    fechaRegistro: '2026-02-20',
    activo: true
  },
  {
    id: 6,
    nombre: 'Elena Ticona Mendoza',
    email: 'elena.ticona@edificiocentral.test',
    cargo: 'Jardinería',
    ci: '9012345',
    telefono: '78901234',
    sueldo: 2600,
    fechaRegistro: '2026-05-05',
    activo: false
  }
]

/** Comprobante de muestra (una imagen SVG) para los registros de ejemplo. */
function comprobanteDemo(nombre: string, titulo: string): Comprobante {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">` +
    `<rect width="420" height="560" fill="#fff"/><rect width="420" height="70" fill="#C13333"/>` +
    `<text x="24" y="44" font-family="Arial" font-size="22" font-weight="700" fill="#fff">Comprobante de ejemplo</text>` +
    `<text x="24" y="122" font-family="Arial" font-size="16" fill="#2E2927">${titulo}</text>` +
    `<text x="24" y="160" font-family="Arial" font-size="13" fill="#766E69">Archivo de demostración (datos de ejemplo).</text></svg>`
  return {
    nombre,
    tipo: 'image/svg+xml',
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }
}

function mov(
  id: number,
  empleadoId: number,
  tipo: TipoMovimiento,
  concepto: string,
  monto: number,
  fecha: string,
  metodo: MetodoPago,
  estado: EstadoMovimiento
): MovimientoPago {
  return {
    id,
    empleadoId,
    tipo,
    concepto,
    monto,
    fecha,
    metodo,
    estado,
    comprobante: comprobanteDemo(`comprobante-${id}.svg`, concepto)
  }
}

let movimientos: MovimientoPago[] = [
  mov(1, 1, 'Anticipo', 'Anticipo de sueldo', 1000, '2026-10-05', 'Efectivo', 'Por descontar'),
  mov(2, 1, 'Anticipo', 'Anticipo de sueldo', 800, '2026-08-04', 'Transferencia', 'Descontado'),
  mov(3, 3, 'Anticipo', 'Anticipo de sueldo', 1200, '2026-10-12', 'Transferencia', 'Por descontar'),
  mov(4, 1, 'Pago', 'Sueldo de septiembre 2026', 2800, '2026-09-30', 'Efectivo', 'Pagado'),
  mov(5, 2, 'Pago', 'Sueldo de octubre 2026', 2500, '2026-10-31', 'Transferencia', 'Pagado'),
  mov(6, 3, 'Pago', 'Sueldo de septiembre 2026', 3200, '2026-09-30', 'Transferencia', 'Pagado'),
  mov(7, 4, 'Pago', 'Sueldo de octubre 2026', 3500, '2026-10-30', 'Transferencia', 'Pagado'),
  mov(8, 5, 'Pago', 'Sueldo de octubre 2026', 3800, '2026-10-31', 'Efectivo', 'Pagado'),
  mov(9, 2, 'Pago', 'Sueldo de septiembre 2026', 2500, '2026-09-30', 'Efectivo', 'Pagado'),
  mov(10, 4, 'Pago', 'Sueldo de septiembre 2026', 3500, '2026-09-29', 'Transferencia', 'Pagado'),
  mov(11, 5, 'Pago', 'Sueldo de septiembre 2026', 3800, '2026-09-30', 'Efectivo', 'Pagado')
]

let siguienteMovimientoId = 1000

let siguienteId = 100

/** Simula la latencia de la red para que se vean los estados de carga. */
const pausa = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))

function validarUnicos(d: EmpleadoForm, idActual?: number) {
  const otros = empleados.filter((e) => e.id !== idActual)
  if (otros.some((e) => e.ci === d.ci))
    throw new Error('Ya existe un empleado registrado con ese CI.')
  if (otros.some((e) => e.email.toLowerCase() === d.email.toLowerCase()))
    throw new Error('Ya existe un empleado registrado con ese correo electrónico.')
}

// =====================================================================
// Funciones que usan las pantallas
// =====================================================================

export async function listarEmpleados(): Promise<Empleado[]> {
  await pausa()
  return empleados.map((e) => ({ ...e }))
}

/** Los anticipos son los movimientos de tipo "Anticipo" (así ambas pantallas ven los mismos datos). */
export async function listarAnticipos(): Promise<Anticipo[]> {
  await pausa(100)
  return movimientos
    .filter((m) => m.tipo === 'Anticipo')
    .map((m) => ({
      id: m.id,
      empleadoId: m.empleadoId,
      monto: m.monto,
      fecha: m.fecha,
      metodo: m.metodo,
      estado: m.estado === 'Descontado' ? 'Descontado' : 'Por descontar'
    }))
}

export async function crearEmpleado(d: EmpleadoForm): Promise<Empleado> {
  await pausa()
  validarUnicos(d)
  const nuevo: Empleado = { ...d, id: siguienteId++, fechaRegistro: hoyISO(), activo: true }
  empleados = [...empleados, nuevo]
  return { ...nuevo }
}

export async function actualizarEmpleado(id: number, d: EmpleadoForm): Promise<Empleado> {
  await pausa()
  const actual = empleados.find((e) => e.id === id)
  if (!actual) throw new Error('El empleado ya no existe.')
  validarUnicos(d, id)
  const actualizado: Empleado = { ...actual, ...d } // conserva id, fecha de registro y estado
  empleados = empleados.map((e) => (e.id === id ? actualizado : e))
  return { ...actualizado }
}

export async function eliminarEmpleado(id: number): Promise<void> {
  await pausa()
  empleados = empleados.filter((e) => e.id !== id)
  movimientos = movimientos.filter((m) => m.empleadoId !== id) // como el ON DELETE CASCADE de la BD
}

// =====================================================================
// Pagos a empleados
// =====================================================================

export async function listarMovimientosPago(): Promise<MovimientoPago[]> {
  await pausa()
  return movimientos.map((m) => ({ ...m }))
}

export async function registrarMovimientoPago(d: NuevoMovimientoPago): Promise<MovimientoPago> {
  await pausa()
  const empleado = empleados.find((e) => e.id === d.empleadoId)
  if (!empleado) throw new Error('El empleado ya no existe.')
  if (!empleado.activo) throw new Error('No se puede registrar pagos a un empleado inactivo.')
  if (!(d.monto > 0)) throw new Error('El monto debe ser mayor a 0.')
  if (!d.fecha) throw new Error('La fecha es obligatoria.')

  // La BD guardaría el monto con 2 decimales: se compara en centavos para evitar errores de coma flotante
  if (
    d.tipo === 'Anticipo' &&
    Math.round(d.monto * 100) > Math.round(empleado.sueldo * PORCENTAJE_MAX_ANTICIPO * 100)
  ) {
    throw new Error(
      `El anticipo no puede superar el 50% del sueldo mensual (máximo ${formatoBs(limiteAnticipo(empleado.sueldo))}).`
    )
  }
  if (!(d.archivo.type.startsWith('image/') || d.archivo.type === 'application/pdf'))
    throw new Error('El comprobante debe ser una imagen o un PDF.')
  if (d.archivo.size > COMPROBANTE_MAX_MB * 1024 * 1024)
    throw new Error(`El comprobante no puede superar los ${COMPROBANTE_MAX_MB} MB.`)

  const nuevo: MovimientoPago = {
    id: siguienteMovimientoId++,
    empleadoId: d.empleadoId,
    tipo: d.tipo,
    concepto: d.tipo === 'Pago' ? conceptoSueldo(d.fecha) : 'Anticipo de sueldo',
    monto: d.monto,
    fecha: d.fecha,
    metodo: d.metodo,
    estado: d.tipo === 'Pago' ? 'Pagado' : 'Por descontar',
    // En memoria basta una URL temporal; con backend sería la URL del archivo guardado.
    comprobante: {
      nombre: d.archivo.name,
      tipo: d.archivo.type,
      url: URL.createObjectURL(d.archivo)
    }
  }
  movimientos = [...movimientos, nuevo]
  return { ...nuevo }
}
