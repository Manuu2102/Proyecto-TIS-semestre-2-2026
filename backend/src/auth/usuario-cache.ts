/**
 * Caché en memoria del usuario autenticado (id, nombre y roles), para no consultar la
 * base de datos en cada pedido. Dura poco y se borra al cambiar el rol, el estado o al
 * eliminar al usuario, así que el control de acceso se comporta igual que antes.
 */
export type UsuarioSesion = { id: string; nombres: string; roles: string[] };

const DURACION_MS = 30_000;
const cache = new Map<string, { usuario: UsuarioSesion; vence: number }>();

export function usuarioEnCache(id: string): UsuarioSesion | null {
  const guardado = cache.get(id);
  if (!guardado) return null;
  if (guardado.vence <= Date.now()) {
    cache.delete(id);
    return null;
  }
  return guardado.usuario;
}

export function guardarUsuarioEnCache(usuario: UsuarioSesion) {
  cache.set(usuario.id, { usuario, vence: Date.now() + DURACION_MS });
}

/** Llamar después de cambiar roles, estado o eliminar a un usuario. */
export function olvidarUsuario(id: string) {
  cache.delete(id);
}
