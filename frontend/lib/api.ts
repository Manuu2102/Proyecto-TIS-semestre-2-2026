const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Momento (ms) en que vence el token guardado, leído de su campo `exp`; null si no hay o no se puede leer. */
export function vencimientoToken(): number | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Sesión vencida: borra los datos guardados y vuelve al login. */
export function irAlLoginPorExpiracion() {
  sessionStorage.clear();
  window.location.replace("/login");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  // Token vencido o inválido: se cierra la sesión
  if (res.status === 401 && token) {
    irAlLoginPorExpiracion();
    throw new Error("La sesión expiró. Inicia sesión nuevamente.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });

export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });

/** Respuesta con error: cierra sesión si el token venció o lanza el mensaje del backend. */
async function fallar(res: Response, token: string | null): Promise<never> {
  if (res.status === 401 && token) {
    irAlLoginPorExpiracion();
    throw new Error("La sesión expiró. Inicia sesión nuevamente.");
  }
  const err = await res.json().catch(() => ({}));
  const mensaje = Array.isArray(err.message) ? err.message.join(" ") : err.message;
  throw new Error(mensaje || `Error ${res.status}`);
}

/** POST multipart (con archivos). El navegador pone el Content-Type con su boundary. */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) return fallar(res, token);
  return res.json();
}

/** PUT multipart (con archivos). */
export async function apiPutForm<T>(path: string, form: FormData): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) return fallar(res, token);
  return res.json();
}

/** Trae un archivo protegido y devuelve una URL local (blob:) para mostrarlo o abrirlo. */
export async function apiArchivoUrl(path: string): Promise<string> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return fallar(res, token);
  return URL.createObjectURL(await res.blob());
}

/**
 * Descarga un archivo generado por el backend (PDF, Excel). Usa el nombre que envía el
 * servidor en Content-Disposition; si el backend rechaza, lanza el error con su mensaje.
 */
export async function apiDescargar(path: string, nombrePorDefecto = "archivo"): Promise<void> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && token) {
    irAlLoginPorExpiracion();
    throw new Error("La sesión expiró. Inicia sesión nuevamente.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const mensaje = Array.isArray(err.message) ? err.message.join(" ") : err.message;
    throw new Error(mensaje || `Error ${res.status}`);
  }
  const nombre =
    res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}