import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Cifrado de los datos personales de `usuario` (ci, email, telefono) con AES-256-GCM.
 * La clave viene de CIFRADO_CLAVE (32 bytes en base64) y nunca se guarda en la BD.
 *
 * - cifrarFijo: el mismo texto da siempre el mismo resultado (el IV sale de un HMAC del
 *   texto). Se usa en ci y email para que sigan funcionando el UNIQUE y las búsquedas.
 * - cifrar: IV aleatorio, un resultado distinto cada vez. Se usa en el teléfono.
 *
 * Formato guardado: "enc:" + base64url(iv | tag | texto cifrado).
 */

const PREFIJO = 'enc:';
const ALGORITMO = 'aes-256-gcm';

let claves: { cifrado: Buffer; iv: Buffer } | null = null;

function obtenerClaves() {
  if (claves) return claves;
  const maestra = Buffer.from(process.env.CIFRADO_CLAVE ?? '', 'base64');
  if (maestra.length !== 32) {
    throw new Error('CIFRADO_CLAVE debe ser una clave de 32 bytes en base64.');
  }
  // Subclaves separadas para cifrar y para derivar el IV de cifrarFijo
  claves = {
    cifrado: createHmac('sha256', maestra).update('cifrado').digest(),
    iv: createHmac('sha256', maestra).update('iv').digest(),
  };
  return claves;
}

function cifrarConIv(texto: string, iv: Buffer) {
  const cipher = createCipheriv(ALGORITMO, obtenerClaves().cifrado, iv);
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return PREFIJO + Buffer.concat([iv, cipher.getAuthTag(), datos]).toString('base64url');
}

/** Cifrado con IV aleatorio. */
export function cifrar(texto: string): string {
  return cifrarConIv(texto, randomBytes(12));
}

/** Cifrado determinista: mismo texto, mismo resultado (para UNIQUE y búsquedas). */
export function cifrarFijo(texto: string): string {
  const iv = createHmac('sha256', obtenerClaves().iv).update(texto).digest().subarray(0, 12);
  return cifrarConIv(texto, iv);
}

export const estaCifrado = (valor: string) => valor.startsWith(PREFIJO);

/** Descifra un valor; si no está cifrado (registros anteriores), lo devuelve tal cual. */
export function descifrar(valor: string): string;
export function descifrar(valor: string | null): string | null;
export function descifrar(valor: string | null): string | null {
  if (valor === null || !estaCifrado(valor)) return valor;
  const bytes = Buffer.from(valor.slice(PREFIJO.length), 'base64url');
  const decipher = createDecipheriv(ALGORITMO, obtenerClaves().cifrado, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}

// Normalización antes de cifrar, para que "Ana@Mail.com " y "ana@mail.com" coincidan
export const cifrarEmail = (email: string) => cifrarFijo(email.trim().toLowerCase());
export const cifrarCi = (ci: string | number | bigint) => cifrarFijo(String(ci).trim());
export const cifrarTelefono = (telefono: string) => cifrar(telefono.trim());

/** Descifra ci, email y telefono de un usuario, dejando el resto igual. */
export function descifrarUsuario<T extends { ci?: string; email?: string; telefono?: string }>(u: T): T {
  return {
    ...u,
    ...(u.ci !== undefined && { ci: descifrar(u.ci) }),
    ...(u.email !== undefined && { email: descifrar(u.email) }),
    ...(u.telefono !== undefined && { telefono: descifrar(u.telefono) }),
  };
}
