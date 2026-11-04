import { hoyISO } from './formato'

// =====================================================================
// Tipos de la pantalla de comunicados
// =====================================================================

export type Canal = 'WhatsApp' | 'Correo'
export type Rol = 'Copropietario' | 'Inquilino' | 'Personal'
export type EstadoComunicado = 'Enviado' | 'Borrador'
export type ModoDestinatarios = 'todos' | 'cargo' | 'especificas'

export type Contacto = { id: number; nombre: string; rol: Rol; email: string; telefono: string }

export type Destinatarios = {
  modo: ModoDestinatarios
  cargos: Rol[] // se usa cuando modo = "cargo"
  personas: number[] // ids de contacto; se usa cuando modo = "especificas"
}

export type Comunicado = {
  id: number
  titulo: string
  asunto: string // asunto del correo
  mensaje: string
  canales: Canal[]
  destinatarios: Destinatarios
  personas: number // cuántas personas alcanzó / alcanzará (se guarda al enviar o guardar)
  fecha: string // YYYY-MM-DD
  estado: EstadoComunicado
}

export type ComunicadoForm = Pick<
  Comunicado,
  'titulo' | 'asunto' | 'mensaje' | 'canales' | 'destinatarios'
>

export const MENSAJE_MAX = 1000
export const ROLES: Rol[] = ['Copropietario', 'Inquilino', 'Personal']
export const ETIQUETA_ROL: Record<Rol, string> = {
  Copropietario: 'Copropietarios',
  Inquilino: 'Inquilinos',
  Personal: 'Personal'
}

// =====================================================================
// DATOS DE EJEMPLO EN MEMORIA (se reinician al recargar la página)
// Con backend, solo hay que cambiar el cuerpo de las funciones exportadas.
// =====================================================================

const contactos: Contacto[] = [
  {
    id: 1,
    nombre: 'Ana Rivera Soliz',
    rol: 'Copropietario',
    email: 'ana.rivera@correo.test',
    telefono: '71110001'
  },
  {
    id: 2,
    nombre: 'Pedro Salvatierra Arce',
    rol: 'Copropietario',
    email: 'pedro.salvatierra@correo.test',
    telefono: '71110002'
  },
  {
    id: 3,
    nombre: 'Sofía Aguilar Peña',
    rol: 'Copropietario',
    email: 'sofia.aguilar@correo.test',
    telefono: '71110003'
  },
  {
    id: 4,
    nombre: 'Luis Fernández Camacho',
    rol: 'Copropietario',
    email: 'luis.fernandez@correo.test',
    telefono: '71110004'
  },
  {
    id: 5,
    nombre: 'Marcela Vargas Ortiz',
    rol: 'Inquilino',
    email: 'marcela.vargas@correo.test',
    telefono: '72220001'
  },
  {
    id: 6,
    nombre: 'Diego Pinto Lozano',
    rol: 'Inquilino',
    email: 'diego.pinto@correo.test',
    telefono: '72220002'
  },
  {
    id: 7,
    nombre: 'Valeria Soria Ramos',
    rol: 'Inquilino',
    email: 'valeria.soria@correo.test',
    telefono: '72220003'
  },
  {
    id: 8,
    nombre: 'Carlos Mamani Quispe',
    rol: 'Personal',
    email: 'carlos.mamani@edificiocentral.test',
    telefono: '71234567'
  },
  {
    id: 9,
    nombre: 'Lucía Gutiérrez Vargas',
    rol: 'Personal',
    email: 'lucia.gutierrez@edificiocentral.test',
    telefono: '69876543'
  }
]

const TODOS: Destinatarios = { modo: 'todos', cargos: [], personas: [] }

let comunicados: Comunicado[] = [
  {
    id: 1,
    titulo: 'Corte de agua programado',
    asunto: 'Corte de agua programado – sábado 7 de noviembre',
    mensaje:
      'Estimados vecinos: el sábado 7 de noviembre habrá corte de agua de 08:00 a 14:00 por trabajos en el tanque elevado. Les pedimos almacenar agua con anticipación.',
    canales: ['Correo', 'WhatsApp'],
    destinatarios: TODOS,
    personas: 9,
    fecha: '2026-11-02',
    estado: 'Enviado'
  },
  {
    id: 2,
    titulo: 'Reunión de copropietarios',
    asunto: 'Convocatoria a reunión ordinaria de copropietarios',
    mensaje:
      'Se convoca a todos los copropietarios a la reunión ordinaria del jueves 12 de noviembre a las 19:00 en el salón de eventos. Se tratará el presupuesto del próximo año.',
    canales: ['Correo'],
    destinatarios: { modo: 'cargo', cargos: ['Copropietario'], personas: [] },
    personas: 4,
    fecha: '2026-10-28',
    estado: 'Enviado'
  },
  {
    id: 3,
    titulo: 'Mantenimiento del ascensor',
    asunto: '',
    mensaje:
      'El ascensor estará fuera de servicio el martes 27 de octubre de 09:00 a 12:00 por mantenimiento preventivo. Disculpen las molestias.',
    canales: ['WhatsApp'],
    destinatarios: TODOS,
    personas: 9,
    fecha: '2026-10-20',
    estado: 'Enviado'
  },
  {
    id: 4,
    titulo: 'Recordatorio de expensas de octubre',
    asunto: 'Recordatorio: vencimiento de expensas de octubre',
    mensaje:
      'Les recordamos que el plazo para pagar las expensas de octubre vence el día 10. Pueden pagar por transferencia o en administración.',
    canales: ['Correo', 'WhatsApp'],
    destinatarios: { modo: 'cargo', cargos: ['Copropietario', 'Inquilino'], personas: [] },
    personas: 7,
    fecha: '2026-10-05',
    estado: 'Enviado'
  },
  {
    id: 5,
    titulo: 'Horario de la sala de eventos',
    asunto: '',
    mensaje:
      'A partir de noviembre la sala de eventos se podrá reservar de lunes a domingo hasta las 22:00. Las reservas se hacen en administración.',
    canales: ['WhatsApp'],
    destinatarios: TODOS,
    personas: 9,
    fecha: '2026-10-30',
    estado: 'Borrador'
  },
  {
    id: 6,
    titulo: 'Fumigación de áreas comunes',
    asunto: 'Fumigación de áreas comunes – viernes 18 de septiembre',
    mensaje:
      'El viernes 18 de septiembre se fumigarán pasillos, parqueos y escaleras. Se recomienda mantener a las mascotas dentro de los departamentos.',
    canales: ['Correo'],
    destinatarios: TODOS,
    personas: 9,
    fecha: '2026-09-18',
    estado: 'Enviado'
  },
  {
    id: 7,
    titulo: 'Cambio de turno del personal',
    asunto: '',
    mensaje:
      'El personal de portería y limpieza cambiará de turno a partir del lunes. Revisar el nuevo cronograma en administración.',
    canales: ['WhatsApp'],
    destinatarios: { modo: 'cargo', cargos: ['Personal'], personas: [] },
    personas: 2,
    fecha: '2026-10-15',
    estado: 'Borrador'
  }
]

let siguienteId = 100
const pausa = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))

// =====================================================================
// Funciones puras (las usan la pantalla y las validaciones)
// =====================================================================

/** Personas que recibirían el comunicado según el modo de destinatarios. */
export function resolverDestinatarios(d: Destinatarios, lista: Contacto[]): Contacto[] {
  if (d.modo === 'todos') return lista
  if (d.modo === 'cargo') return lista.filter((c) => d.cargos.includes(c.rol))
  return lista.filter((c) => d.personas.includes(c.id))
}

/** "Todos los usuarios, 9 personas" */
export function textoDestinatarios(d: Destinatarios, personas: number) {
  const quien =
    d.modo === 'todos'
      ? 'Todos los usuarios'
      : d.modo === 'cargo'
        ? d.cargos.map((c) => ETIQUETA_ROL[c]).join(', ') || 'Por cargo'
        : 'Personas específicas'
  return `${quien}, ${personas} ${personas === 1 ? 'persona' : 'personas'}`
}

export type ErroresComunicado = Partial<
  Record<'titulo' | 'asunto' | 'mensaje' | 'canales' | 'destinatarios', string>
>

/**
 * Para enviar se exige todo; para guardar un borrador basta con el título.
 */
export function validarComunicado(d: ComunicadoForm, estricto: boolean): ErroresComunicado {
  const e: ErroresComunicado = {}
  if (!d.titulo.trim()) e.titulo = 'Escribe el título del comunicado.'
  if (!estricto) return e

  if (!d.mensaje.trim()) e.mensaje = 'Escribe el mensaje del comunicado.'
  else if (d.mensaje.length > MENSAJE_MAX)
    e.mensaje = `El mensaje no puede superar los ${MENSAJE_MAX} caracteres.`
  if (d.canales.length === 0) e.canales = 'Elige al menos un canal de envío.'
  if (d.canales.includes('Correo') && !d.asunto.trim()) e.asunto = 'Escribe el asunto del correo.'
  if (resolverDestinatarios(d.destinatarios, contactos).length === 0)
    e.destinatarios = 'Elige al menos un destinatario.'
  return e
}

// =====================================================================
// Funciones que usan las pantallas
// =====================================================================

export async function listarComunicados(): Promise<Comunicado[]> {
  await pausa()
  return comunicados.map((c) => ({ ...c }))
}

export async function listarContactos(): Promise<Contacto[]> {
  await pausa(100)
  return contactos.map((c) => ({ ...c }))
}

/**
 * Crea un comunicado. `enviar = true` lo marca como "Enviado"; si no, queda "Borrador".
 */
export async function crearComunicado(d: ComunicadoForm, enviar: boolean): Promise<Comunicado> {
  await pausa()
  const errores = validarComunicado(d, enviar)
  if (Object.keys(errores).length > 0) throw new Error(Object.values(errores)[0])

  const nuevo: Comunicado = {
    ...d,
    id: siguienteId++,
    personas: resolverDestinatarios(d.destinatarios, contactos).length,
    fecha: hoyISO(),
    estado: enviar ? 'Enviado' : 'Borrador'
  }
  comunicados = [...comunicados, nuevo]
  return { ...nuevo }
}

/**
 * Edita un comunicado. Un borrador puede seguir como borrador o enviarse;
 * uno ya enviado conserva su estado y su fecha de envío.
 */
export async function actualizarComunicado(
  id: number,
  d: ComunicadoForm,
  enviar: boolean
): Promise<Comunicado> {
  await pausa()
  const actual = comunicados.find((c) => c.id === id)
  if (!actual) throw new Error('El comunicado ya no existe.')

  const estado: EstadoComunicado = enviar ? 'Enviado' : actual.estado
  const errores = validarComunicado(d, estado === 'Enviado')
  if (Object.keys(errores).length > 0) throw new Error(Object.values(errores)[0])

  const actualizado: Comunicado = {
    ...actual,
    ...d,
    personas: resolverDestinatarios(d.destinatarios, contactos).length,
    estado,
    fecha: enviar || actual.estado === 'Borrador' ? hoyISO() : actual.fecha
  }
  comunicados = comunicados.map((c) => (c.id === id ? actualizado : c))
  return { ...actualizado }
}

export async function eliminarComunicado(id: number): Promise<void> {
  await pausa()
  comunicados = comunicados.filter((c) => c.id !== id)
}
