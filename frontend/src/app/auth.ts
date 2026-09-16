export type AppUser = {
  id: number;
  nombre: string;
  email: string;
  password: string;
  role:
    | "ADMINISTRADOR"
    | "COPROPIETARIO"
    | "INQUILINO"
    | "DIRECTORIO"
    | "CONSULTA";
  departamento?: string;
};
const seed: AppUser[] = [
  {
    id: 1,
    nombre: "Administrador General",
    email: "admin@edificio.xyz",
    password: "Admin123*",
    role: "ADMINISTRADOR",
  },
  {
    id: 2,
    nombre: "María Fernanda Rojas",
    email: "maria.rojas@email.com",
    password: "Maria123*",
    role: "COPROPIETARIO",
    departamento: "A-103",
  },
  {
    id: 3,
    nombre: "Ana Lucía Vargas",
    email: "ana.vargas@email.com",
    password: "Ana123*",
    role: "INQUILINO",
    departamento: "A-103",
  },
  {
    id: 4,
    nombre: "Directorio del Edificio",
    email: "directorio@edificio.xyz",
    password: "Directorio123*",
    role: "DIRECTORIO",
  },
  {
    id: 5,
    nombre: "Usuario de Consulta",
    email: "consulta@edificio.xyz",
    password: "Consulta123*",
    role: "CONSULTA",
  },
];
export function getUsers(): AppUser[] {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem("edificio_users");
  if (!raw) {
    localStorage.setItem("edificio_users", JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Usuarios inválidos");
    return parsed as AppUser[];
  } catch {
    localStorage.setItem("edificio_users", JSON.stringify(seed));
    return seed;
  }
}
export function saveUser(user: AppUser) {
  const users = getUsers();
  localStorage.setItem("edificio_users", JSON.stringify([...users, user]));
}
export function loginUser(email: string, password: string) {
  return getUsers().find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
}
