"use client";

import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { ShieldIcon, UsersIcon } from "../../../components/Icons";

type Role = "ADMINISTRADOR" | "COPROPIETARIO" | "INQUILINO" | "DIRECTORIO" | "CONSULTA";
type ManagedRole = "ADMINISTRADOR" | "DIRECTORIO" | "CONSULTA";

type UserRecord = {
  id: number;
  nombre: string;
  email: string;
  role: Role;
  departamento?: string;
};

function readCurrentUsers(): UserRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const currentRaw = localStorage.getItem("edificio_current_user");
    if (!currentRaw) return [];
    const current = JSON.parse(currentRaw) as UserRecord;
    if (current.role !== "ADMINISTRADOR") return [];
    const raw = localStorage.getItem("edificio_users");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let auditIdCounter = 0;
function nextAuditId() {
  auditIdCounter += 1;
  return `${Date.now()}-${auditIdCounter}`;
}

export default function UsuariosRolesPage() {
  const [users, setUsers] = useState<UserRecord[]>(() => readCurrentUsers());
  const [open, setOpen] = useState(false);

  function loadUsers() {
    try {
      const raw = localStorage.getItem("edificio_users");
      const parsed = raw ? JSON.parse(raw) : [];
      setUsers(Array.isArray(parsed) ? parsed : []);
    } catch {
      setUsers([]);
    }
  }

  function openManager() {
    loadUsers();
    setOpen(true);
  }

  return (
    <DashboardLayout active="usuarios-roles">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGURIDAD</span>
          <h1>Usuarios y roles</h1>
          <p>Administra los usuarios del sistema y los roles que determinan sus permisos.</p>
        </div>
      </div>

      <section className="panel usuarios-roles-card">
        <div className="usuarios-roles-icon"><UsersIcon size={30} /></div>
        <div className="usuarios-roles-copy">
          <span className="eyebrow">GESTIÓN DE ROLES</span>
          <h2>Control de usuarios y permisos</h2>
          <p>Desde este módulo puedes asignar roles, eliminar usuarios y registrar automáticamente los cambios en auditoría.</p>
          <div className="hu48-role-chips">
            {(["ADMINISTRADOR", "DIRECTORIO", "CONSULTA"] as const).map(role => (
              <span key={role}><b>{users.filter(user => user.role === role).length}</b>{role}</span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary usuarios-roles-open" onClick={openManager}>
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
          <div className="hu48-info"><ShieldIcon size={20}/><div><strong>Auditoría activa</strong><span>Los cambios de rol y eliminaciones quedan registrados con fecha y hora.</span></div></div>
        </div>
      </section>

      <RoleManagerModal
        open={open}
        users={users}
        onUsersChange={setUsers}
        onClose={() => setOpen(false)}
      />
    </DashboardLayout>
  );
}

function RoleManagerModal({
  open,
  users,
  onUsersChange,
  onClose,
}: {
  open: boolean;
  users: UserRecord[];
  onUsersChange: (users: UserRecord[]) => void;
  onClose: () => void;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  function handleClose() {
    setMessage("");
    onClose();
  }

  function changeRole(id: number, role: ManagedRole) {
    setSavingId(id);
    try {
      const raw = localStorage.getItem("edificio_users");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error("Usuarios inválidos");
      const target = parsed.find((item: UserRecord) => item.id === id);
      if (!target) throw new Error("Usuario no encontrado");
      const oldRole = target.role;
      target.role = role;
      localStorage.setItem("edificio_users", JSON.stringify(parsed));
      const auditRaw = localStorage.getItem("edificio_audit_roles");
      const audit = auditRaw ? JSON.parse(auditRaw) : [];
      const entries = Array.isArray(audit) ? audit : [];
      entries.unshift({
        id: nextAuditId(),
        fecha: new Date().toLocaleString("es-BO"),
        usuario: target.nombre,
        anterior: oldRole,
        nuevo: role,
        accion: "Cambio de rol",
      });
      localStorage.setItem("edificio_audit_roles", JSON.stringify(entries.slice(0, 50)));
      onUsersChange(parsed);
      setMessage(`Rol actualizado: ${target.nombre} ahora tiene ${role}.`);
    } catch {
      setMessage("No se pudo actualizar el rol.");
    } finally {
      setSavingId(null);
    }
  }

  function deleteUser(id: number) {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const raw = localStorage.getItem("edificio_users");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error("Usuarios inválidos");
      const target = parsed.find((item: UserRecord) => item.id === id);
      if (!target) throw new Error("Usuario no encontrado");
      const currentRaw = localStorage.getItem("edificio_current_user");
      const current = currentRaw ? JSON.parse(currentRaw) : null;
      if (current?.id === id) {
        setMessage("No puedes eliminar la cuenta con la que estás conectado.");
        return;
      }
      const nextUsers = parsed.filter((item: UserRecord) => item.id !== id);
      localStorage.setItem("edificio_users", JSON.stringify(nextUsers));
      const auditRaw = localStorage.getItem("edificio_audit_roles");
      const audit = auditRaw ? JSON.parse(auditRaw) : [];
      const entries = Array.isArray(audit) ? audit : [];
      entries.unshift({
        id: nextAuditId(),
        fecha: new Date().toLocaleString("es-BO"),
        usuario: target.nombre,
        anterior: target.role,
        nuevo: "ELIMINADO",
        accion: "Eliminación de usuario",
      });
      localStorage.setItem("edificio_audit_roles", JSON.stringify(entries.slice(0, 50)));
      onUsersChange(nextUsers);
      setMessage(`Usuario eliminado: ${target.nombre}.`);
    } catch {
      setMessage("No se pudo eliminar el usuario.");
    } finally {
      setDeletingId(null);
    }
  }

  const adminRoles = ["ADMINISTRADOR", "DIRECTORIO", "CONSULTA"] as const;

  return (
    <Modal open={open} title="Gestionar roles" onClose={handleClose}>
      <div className="hu48-modal-body">
        <div className="hu48-modal-intro">
          <div><p>Selecciona el rol que determinará los permisos de cada usuario. Los cambios se registran automáticamente en auditoría.</p></div>
        </div>
        <div className="hu48-role-table">
          <div className="hu48-role-row hu48-role-header"><span>USUARIO</span><span>ROL ACTUAL</span><span>ASIGNAR ROL</span><span>ACCIÓN</span></div>
          {users.map(user => (
            <div className="hu48-role-row" key={user.id}>
              <div><strong>{user.nombre}</strong><small>{user.email}</small></div>
              <span className="role-badge">{user.role}</span>
              <select value={adminRoles.includes(user.role as ManagedRole) ? user.role : "CONSULTA"} disabled={savingId === user.id || deletingId === user.id} onChange={event => changeRole(user.id, event.target.value as ManagedRole)} aria-label={`Rol de ${user.nombre}`}>
                {adminRoles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <button className="btn btn-danger hu48-delete-btn" type="button" disabled={savingId === user.id || deletingId === user.id} onClick={() => deleteUser(user.id)} aria-label={`Eliminar a ${user.nombre}`}>
                {deletingId === user.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          ))}
        </div>
        {message && <div className="alert alert-success hu48-message">{message}</div>}
        <div className="hu48-audit-note"><ShieldIcon size={18}/><div><strong>Registro de auditoría</strong><span>Cada cambio guarda usuario, fecha, rol anterior y nuevo rol.</span></div></div>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={handleClose}>Cerrar</button></div>
      </div>
    </Modal>
  );
}