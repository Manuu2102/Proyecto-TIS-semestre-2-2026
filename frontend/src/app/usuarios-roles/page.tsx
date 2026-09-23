"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { ShieldIcon, UsersIcon } from "../../../components/Icons";

type ManagedRole = "ADMINISTRADOR" | "DIRECTORIO" | "CONSULTA";

type UserRecord = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  estatus: boolean;
};

const API_URL = "http://localhost:3001";

function getToken() {
  return sessionStorage.getItem("token");
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Error en la solicitud");
  }

  return data;
}

export default function UsuariosRolesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/usuarios");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openManager() {
    setOpen(true);
  }

  const roleCount = (role: ManagedRole) =>
    users.filter((u) => u.role === role).length;

  return (
    <DashboardLayout active="usuarios-roles">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGURIDAD</span>
          <h1>Usuarios y roles</h1>
          <p>Administra los usuarios del sistema y los roles que determinan sus permisos.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel usuarios-roles-card">
        <div className="usuarios-roles-icon"><UsersIcon size={30} /></div>
        <div className="usuarios-roles-copy">
          <span className="eyebrow">GESTIÓN DE ROLES</span>
          <h2>Control de usuarios y permisos</h2>
          <p>Desde este módulo puedes asignar roles y eliminar usuarios. Los cambios quedan registrados automáticamente en auditoría.</p>
          <div className="hu48-role-chips">
            {(["ADMINISTRADOR", "DIRECTORIO", "CONSULTA"] as const).map((role) => (
              <span key={role}><b>{roleCount(role)}</b>{role}</span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary usuarios-roles-open" onClick={openManager} disabled={loading}>
          <UsersIcon size={17} /> Gestionar roles
        </button>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Administración de usuarios</h3>
            <p>El administrador es el único rol autorizado para modificar estos permisos.</p>
          </div>
        </div>
        <div className="hu48-summary">
          <div className="hu48-info">
            <ShieldIcon size={20} />
            <div>
              <strong>Auditoría activa</strong>
              <span>Los cambios de rol y eliminaciones quedan registrados con fecha y hora.</span>
            </div>
          </div>
        </div>
      </section>

      <RoleManagerModal
        open={open}
        users={users}
        onUsersReload={loadUsers}
        onClose={() => setOpen(false)}
      />
    </DashboardLayout>
  );
}

function RoleManagerModal({
  open,
  users,
  onUsersReload,
  onClose,
}: {
  open: boolean;
  users: UserRecord[];
  onUsersReload: () => void;
  onClose: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function handleClose() {
    setMessage("");
    onClose();
  }

  async function changeRole(idUsuario: string, roleNombre: ManagedRole) {
    setSavingId(idUsuario);
    setMessage("");
    try {
      // Necesitas el id numérico del rol — ajusta según cómo tengas cargada tu tabla `rol`
      const ID_ROL: Record<ManagedRole, number> = {
        ADMINISTRADOR: 1,
        DIRECTORIO: 2,
        CONSULTA: 3,
      };

      await apiFetch("/usuarios/assign-role", {
        method: "POST",
        body: JSON.stringify({
          id_usuario: idUsuario,
          id_rol: ID_ROL[roleNombre],
        }),
      });

      onUsersReload();
      setMessage(`Rol actualizado correctamente.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo actualizar el rol.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(idUsuario: string, nombre: string) {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.")) return;

    setDeletingId(idUsuario);
    setMessage("");
    try {
      await apiFetch(`/usuarios/${idUsuario}`, { method: "DELETE" });
      onUsersReload();
      setMessage(`Usuario eliminado: ${nombre}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo eliminar el usuario.");
    } finally {
      setDeletingId(null);
    }
  }

  const adminRoles: ManagedRole[] = ["ADMINISTRADOR", "DIRECTORIO", "CONSULTA"];

  return (
    <Modal open={open} title="Gestionar roles" onClose={handleClose}>
      <div className="hu48-modal-body">
        <div className="hu48-modal-intro">
          <p>Selecciona el rol que determinará los permisos de cada usuario. Los cambios se registran automáticamente en auditoría.</p>
        </div>
        <div className="hu48-role-table">
          <div className="hu48-role-row hu48-role-header">
            <span>USUARIO</span><span>ROL ACTUAL</span><span>ASIGNAR ROL</span><span>ACCIÓN</span>
          </div>
          {users.map((user) => (
            <div className="hu48-role-row" key={user.id}>
              <div><strong>{user.nombre}</strong><small>{user.email}</small></div>
              <span className="role-badge">{user.role}</span>
              <select
                value={adminRoles.includes(user.role as ManagedRole) ? user.role : "CONSULTA"}
                disabled={savingId === user.id || deletingId === user.id}
                onChange={(e) => changeRole(user.id, e.target.value as ManagedRole)}
                aria-label={`Rol de ${user.nombre}`}
              >
                {adminRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                className="btn btn-danger hu48-delete-btn"
                type="button"
                disabled={savingId === user.id || deletingId === user.id}
                onClick={() => deleteUser(user.id, user.nombre)}
                aria-label={`Eliminar a ${user.nombre}`}
              >
                {deletingId === user.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          ))}
        </div>
        {message && <div className="alert alert-success hu48-message">{message}</div>}
        <div className="hu48-audit-note">
          <ShieldIcon size={18} />
          <div><strong>Registro de auditoría</strong><span>Cada cambio guarda usuario, fecha, rol anterior y nuevo rol.</span></div>
        </div>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={handleClose}>Cerrar</button></div>
      </div>
    </Modal>
  );
}