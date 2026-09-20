export function getToken(): string | null {
  return sessionStorage.getItem("token") ?? localStorage.getItem("token");
}

export function isAuthenticated(): boolean {
  return (
    sessionStorage.getItem("sesionActiva") === "true" ||
    localStorage.getItem("sesionActiva") === "true"
  );
}

export function logout() {
  sessionStorage.removeItem("sesionActiva");
  sessionStorage.removeItem("token");
  localStorage.removeItem("sesionActiva");
  localStorage.removeItem("token");
}