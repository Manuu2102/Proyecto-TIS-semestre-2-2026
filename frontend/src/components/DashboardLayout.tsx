"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  BuildingIcon,
  ChevronIcon,
  FileIcon,
  HomeIcon,
  LayoutIcon,
  MenuIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "./Icons";

type NavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutIcon;
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

// La navegación es siempre directa: los módulos no están dentro de menús desplegables.
// Las secciones solo sirven para separar visualmente los grupos, como en el diseño de referencia.
const adminSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutIcon,
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        key: "copropietarios",
        label: "Copropietarios",
        href: "/copropietarios",
        icon: UsersIcon,
      },
      {
        key: "inquilinos",
        label: "Inquilinos",
        href: "/inquilinos",
        icon: HomeIcon,
      },
      {
        key: "departamentos",
        label: "Departamentos",
        href: "/departamentos",
        icon: BuildingIcon,
      },
      {
        key: "espacios",
        label: "Parqueos y bauleras",
        href: "/espacios",
        icon: BuildingIcon,
      },
      {
        key: "asociaciones",
        label: "Asociaciones",
        href: "/asociaciones",
        icon: UsersIcon,
      },
      {
        key: "ocupantes",
        label: "Historial de ocupantes",
        href: "/historial-ocupantes",
        icon: HomeIcon,
      },
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        key: "finanzas",
        label: "Expensas y finanzas",
        href: "/finanzas",
        icon: WalletIcon,
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        key: "mantenimiento",
        label: "Mantenimiento",
        href: "/mantenimiento",
        icon: WrenchIcon,
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        key: "documentos",
        label: "Gestión documental",
        href: "/documentos",
        icon: FileIcon,
      },
    ],
  },
  {
    title: "Seguridad",
    items: [
      {
        key: "seguridad",
        label: "Seguridad y auditoría",
        href: "/seguridad",
        icon: ShieldIcon,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        key: "respaldo",
        label: "Nube y respaldos",
        href: "/respaldo",
        icon: SettingsIcon,
      },
      {
        key: "usuarios-roles",
        label: "Usuarios y roles",
        href: "/usuarios-roles",
        icon: UsersIcon,
      },
    ],
  },
];

const ownerSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutIcon,
      },
    ],
  },
  {
    title: "Mi vivienda",
    items: [
      {
        key: "departamentos",
        label: "Mi departamento",
        href: "/dashboard",
        icon: BuildingIcon,
      },
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        key: "finanzas",
        label: "Expensas y finanzas",
        href: "/finanzas",
        icon: WalletIcon,
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        key: "mantenimiento",
        label: "Mantenimiento",
        href: "/mantenimiento",
        icon: WrenchIcon,
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        key: "documentos",
        label: "Gestión documental",
        href: "/documentos",
        icon: FileIcon,
      },
    ],
  },
  {
    title: "Seguridad",
    items: [
      {
        key: "seguridad",
        label: "Seguridad y auditoría",
        href: "/seguridad",
        icon: ShieldIcon,
      },
    ],
  },
];

const tenantSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutIcon,
      },
    ],
  },
  {
    title: "Mi vivienda",
    items: [
      {
        key: "departamentos",
        label: "Mi departamento",
        href: "/dashboard",
        icon: BuildingIcon,
      },
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        key: "finanzas",
        label: "Expensas y finanzas",
        href: "/finanzas",
        icon: WalletIcon,
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        key: "mantenimiento",
        label: "Mantenimiento",
        href: "/mantenimiento",
        icon: WrenchIcon,
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        key: "documentos",
        label: "Gestión documental",
        href: "/documentos",
        icon: FileIcon,
      },
    ],
  },
];

const directorSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutIcon,
      },
    ],
  },
  {
    title: "Finanzas",
    items: [
      {
        key: "finanzas",
        label: "Expensas y finanzas",
        href: "/finanzas",
        icon: WalletIcon,
      },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        key: "mantenimiento",
        label: "Mantenimiento",
        href: "/mantenimiento",
        icon: WrenchIcon,
      },
    ],
  },
  {
    title: "Documentos",
    items: [
      {
        key: "documentos",
        label: "Gestión documental",
        href: "/documentos",
        icon: FileIcon,
      },
    ],
  },
  {
    title: "Seguridad",
    items: [
      {
        key: "seguridad",
        label: "Seguridad y auditoría",
        href: "/seguridad",
        icon: ShieldIcon,
      },
    ],
  },
];

const consultationSections: NavigationSection[] = [
  {
    title: "Principal",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutIcon,
      },
    ],
  },
  {
    title: "Consulta",
    items: [
      {
        key: "departamentos",
        label: "Departamentos",
        href: "/departamentos",
        icon: BuildingIcon,
      },
      {
        key: "documentos",
        label: "Gestión documental",
        href: "/documentos",
        icon: FileIcon,
      },
    ],
  },
];

// El login autentica contra app/auth.ts (5 usuarios de ejemplo, uno por rol) y guarda
// el rol real en sessionStorage. Aquí se traduce ese rol a la navegación que le
// corresponde, igual que en edificio.
function sectionsForRole(role: string): NavigationSection[] {
  const normalized = role.trim().toUpperCase();
  if (normalized.startsWith("ADMIN")) return adminSections;
  if (normalized.startsWith("COPROPIETARIO")) return ownerSections;
  if (normalized.startsWith("INQUILINO")) return tenantSections;
  if (normalized.startsWith("DIRECTORIO")) return directorSections;
  return consultationSections;
}

const allNavigation = [
  ...adminSections,
  ...ownerSections,
  ...tenantSections,
  ...directorSections,
  ...consultationSections,
].flatMap((section) => section.items);
const titles: Record<string, string> = Object.fromEntries(
  allNavigation.map((item) => [item.key, item.label]),
);

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "US"
  );
}

export function DashboardLayout({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  const [mobile, setMobile] = useState(false);
  // sessionSet distingue "todavía no verifiqué sessionStorage" (null) de "verifiqué y no hay sesión".
  const [session, setSession] = useState<{
    nombre: string;
    rol: string;
  } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const navSections = sectionsForRole(session?.rol ?? "");
  const allowedPaths = useMemo(
    () =>
      new Set(
        navSections.flatMap((section) =>
          section.items.map((item) => item.href),
        ),
      ),
    [navSections],
  );

  useEffect(() => {
    // Misma sesión que crea app/login/page.tsx: sessionStorage con estas 3 claves.
    const activa = sessionStorage.getItem("sesionActiva");
    if (!activa) {
      router.replace("/login");
      return;
    }
    setSession({
      nombre: sessionStorage.getItem("nombreUsuario") || "Usuario",
      rol: sessionStorage.getItem("rolUsuario") || "Consulta",
    });
  }, [router]);

  useEffect(() => {
    if (!session || pathname === "/dashboard" || pathname === "/login") return;
    if (!allowedPaths.has(pathname)) router.replace("/dashboard");
  }, [session, pathname, router, allowedPaths]);

  function logout() {
    sessionStorage.removeItem("sesionActiva");
    sessionStorage.removeItem("nombreUsuario");
    sessionStorage.removeItem("rolUsuario");
    sessionStorage.removeItem("departamentoUsuario");
    setSession(null);
    setMobile(false);
    router.replace("/login");
  }

  const currentTitle = titles[active] || "Dashboard";
  const name = session?.nombre || "Usuario";
  const roleLabel = session?.rol || "Consulta";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <BuildingIcon size={21} />
          </span>
          <span>
            Edificio <strong>Central</strong>
          </span>
        </div>

        <nav className="sidebar-navigation" aria-label="Navegación principal">
          {navSections.map((section) => (
            <div className="sidebar-nav-section" key={section.title}>
              <p className="sidebar-nav-title">{section.title}</p>
              {section.items.map((item) => {
                const I = item.icon;
                const isActive = active === item.key || pathname === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setMobile(false)}
                  >
                    <I size={17} />
                    <span>{item.label}</span>
                    {isActive && <span className="nav-dot" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            <div className="avatar">{initials(name)}</div>
            <div>
              <strong>{name}</strong>
              <span>{roleLabel}</span>
            </div>
            <button
              className="sidebar-logout"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <ChevronIcon size={15} />
            </button>
          </div>
        </div>
      </aside>

      {mobile && (
        <button
          className="mobile-overlay"
          onClick={() => setMobile(false)}
          aria-label="Cerrar menú"
        />
      )}

      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Abrir menú"
          >
            <MenuIcon size={21} />
          </button>
          <div className="breadcrumb">
            <span>Edificio Central</span>
            <b>/</b>
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-actions">
            <button className="top-icon" aria-label="Notificaciones">
              <BellIcon size={19} />
              <i />
            </button>
            <div className="top-user">
              <div className="avatar">{initials(name)}</div>
              <div>
                <strong>{name}</strong>
                <span>{roleLabel}</span>
              </div>
            </div>
            <button className="btn btn-secondary top-logout" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
