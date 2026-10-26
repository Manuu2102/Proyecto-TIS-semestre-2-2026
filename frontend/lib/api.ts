const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

/**
 * Descarga un archivo generado por el backend (PDF, Excel). Usa el nombre que envía el
 * servidor en Content-Disposition; si el backend rechaza, lanza el error con su mensaje.
 */
export async function apiDescargar(path: string, nombrePorDefecto = "archivo"): Promise<void> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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