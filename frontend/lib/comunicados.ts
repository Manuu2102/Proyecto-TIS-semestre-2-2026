import { api, apiPost, apiPatch, apiDelete } from './api';
import { hoyISO } from './formato';

// =====================================================================
// Tipos de la pantalla de comunicados
// =====================================================================

export type Canal = 'WhatsApp' | 'Correo';
export type Rol = 'Copropietario' | 'Inquilino' | 'Personal';
export type EstadoComunicado = 'Enviado' | 'Borrador';
export type ModoDestinatarios = 'todos' | 'cargo' | 'especificas';

export type Contacto = { id: number; nombre: string; rol: Rol; email: string; telefono: string };

export type Destinatarios = {
  modo: ModoDestinatarios;
  cargos: Rol[];
  personas: number[];
};

export type Comunicado = {
  id: number;
  titulo: string;
  asunto: string;
  mensaje: string;
  canales: Canal[];
  destinatarios: Destinatarios;
  personas: number;
  fecha: string;
  estado: EstadoComunicado;
};

export type ComunicadoForm = Pick<
  Comunicado,
  'titulo' | 'asunto' | 'mensaje' | 'canales' | 'destinatarios'
>;

export const MENSAJE_MAX = 1000;
export const ROLES: Rol[] = ['Copropietario', 'Inquilino', 'Personal'];
export const ETIQUETA_ROL: Record<Rol, string> = {
  Copropietario: 'Copropietarios',
  Inquilino: 'Inquilinos',
  Personal: 'Personal'
};

export type ErroresComunicado = Partial<
  Record<'titulo' | 'asunto' | 'mensaje' | 'canales' | 'destinatarios', string>
>;

// =====================================================================
// FUNCIONES PURAS (Validaciones y lógica visual)
// =====================================================================

export function resolverDestinatarios(d: Destinatarios, lista: Contacto[]): Contacto[] {
  if (d.modo === 'todos') return lista;
  if (d.modo === 'cargo') return lista.filter((c) => d.cargos.includes(c.rol));
  return lista.filter((c) => d.personas.includes(c.id));
}

export function textoDestinatarios(d: Destinatarios, personas: number) {
  const quien =
    d.modo === 'todos'
      ? 'Todos los usuarios'
      : d.modo === 'cargo'
        ? d.cargos.map((c) => ETIQUETA_ROL[c]).join(', ') || 'Por cargo'
        : 'Personas específicas';
  return `${quien}, ${personas} ${personas === 1 ? 'persona' : 'personas'}`;
}

export function validarComunicado(d: ComunicadoForm, estricto: boolean): ErroresComunicado {
  const e: ErroresComunicado = {};
  if (!d.titulo.trim()) e.titulo = 'Escribe el título del comunicado.';
  if (!estricto) return e;

  if (!d.mensaje.trim()) e.mensaje = 'Escribe el mensaje del comunicado.';
  else if (d.mensaje.length > MENSAJE_MAX)
    e.mensaje = `El mensaje no puede superar los ${MENSAJE_MAX} caracteres.`;
  if (d.canales.length === 0) e.canales = 'Elige al menos un canal de envío.';
  if (d.canales.includes('Correo') && !d.asunto.trim()) e.asunto = 'Escribe el asunto del correo.';
  
  // Para la validación de destinatarios usamos una lista local ficticia para no llamar a la API
  if (d.destinatarios.modo === 'cargo' && d.destinatarios.cargos.length === 0) {
    e.destinatarios = 'Elige al menos un cargo.';
  }
  if (d.destinatarios.modo === 'especificas' && d.destinatarios.personas.length === 0) {
    e.destinatarios = 'Elige al menos una persona.';
  }
  
  return e;
}

// =====================================================================
// CONEXIÓN CON EL BACKEND (API)
// =====================================================================

// Tipo que devuelve tu backend real
type ComunicadoBackend = {
  id: string | number;
  titulo: string;
  contenido: string;
  tipo: string;
  fecha_publicacion: string;
  estatus: boolean;
};

// Adaptamos lo que viene del backend al formato que espera la pantalla
function adaptarComunicado(c: ComunicadoBackend): Comunicado {
  return {
    id: Number(c.id),
    titulo: c.titulo,
    asunto: c.titulo, // Usamos el título como asunto
    mensaje: c.contenido,
    canales: c.tipo === 'Correo' ? ['Correo'] : ['WhatsApp'], // Usamos el tipo como canal
    destinatarios: { modo: 'todos', cargos: [], personas: [] },
    personas: 1, // Simulamos 1 persona
    fecha: c.fecha_publicacion.split('T')[0],
    estado: c.estatus ? 'Enviado' : 'Borrador',
  };
}

// LISTAR
export async function listarComunicados(): Promise<Comunicado[]> {
  const res = await api<ComunicadoBackend[]>('/comunicados');
  return res.map(adaptarComunicado);
}

// LISTAR CONTACTOS (Mock temporal, ya que no hay endpoint)
export async function listarContactos(): Promise<Contacto[]> {
  // Como no hay endpoint real de contactos, devolvemos algunos de prueba
  return [
    { id: 1, nombre: 'Ana Rivera', rol: 'Copropietario', email: 'ana@test.com', telefono: '123' },
    { id: 2, nombre: 'Carlos Mamani', rol: 'Personal', email: 'carlos@test.com', telefono: '456' },
  ];
}

// CREAR
export async function crearComunicado(d: ComunicadoForm, enviar: boolean): Promise<Comunicado> {
  const errores = validarComunicado(d, enviar);
  if (Object.keys(errores).length > 0) throw new Error(Object.values(errores)[0]);

  const res = await apiPost<ComunicadoBackend>('/comunicados', {
    titulo: d.titulo,
    contenido: d.mensaje,
    tipo: d.canales.includes('Correo') ? 'Correo' : 'WhatsApp', // Traducimos los canales al tipo
  });
  
  return adaptarComunicado(res);
}

// ACTUALIZAR (El backend no tiene PATCH aún, pero lo dejamos listo)
export async function actualizarComunicado(id: number, d: ComunicadoForm, enviar: boolean): Promise<Comunicado> {
  const errores = validarComunicado(d, enviar);
  if (Object.keys(errores).length > 0) throw new Error(Object.values(errores)[0]);

  const res = await apiPatch<ComunicadoBackend>(`/comunicados/${id}`, {
    titulo: d.titulo,
    contenido: d.mensaje,
    tipo: d.canales.includes('Correo') ? 'Correo' : 'WhatsApp',
  });
  
  return adaptarComunicado(res);
}

// ELIMINAR
export async function eliminarComunicado(id: number): Promise<void> {
  await apiDelete(`/comunicados/${id}`);
}