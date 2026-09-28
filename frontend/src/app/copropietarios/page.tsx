"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { api } from "../../../lib/api";

type Estado = "Activo" | "Inactivo";

type Copropietario = {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
  ci: string;
  telefono: string;
  departamento: string;
  estado: Estado;
};

const CI_REGEX = /^[0-9]{5,10}$/;
const TELEFONO_REGEX = /^[0-9]{7,15}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CopropietariosPage() {
  const [copropietarios, setCopropietarios] = useState<Copropietario[]>([]);
  const [departamentosDisponibles, setDepartamentosDisponibles] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  const [form, setForm] = useState({
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    ci: "",
    correo: "",
    telefono: "",
    departamento: "",
    estado: "Activo" as Estado,
    password: "",
    sexo: "M" as "M" | "F",
    fechaNacimiento: "",
  });

  // Cargar copropietarios
  useEffect(() => {
    async function cargarDatos() {
      try {
        setCargando(true);
        const data = await api<any>("/copropietarios"); // eslint-disable-line @typescript-eslint/no-explicit-any
        const mapeados: Copropietario[] = data.copropietarios.map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: c.id,
          nombres: c.nombres,
          apellidoPaterno: c.apellido_paterno,
          apellidoMaterno: c.apellido_materno ?? "",
          correo: c.email,
          ci: c.ci.toString(),
          telefono: c.telefono,
          departamento: "—",
          estado: c.estatus ? "Activo" : "Inactivo",
        }));
        setCopropietarios(mapeados);
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("Error al cargar copropietarios:", err.message);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, []);

  // Cargar departamentos
  useEffect(() => {
    async function cargarDepartamentos() {
      try {
        const data = await api<any>("/departamentos"); // eslint-disable-line @typescript-eslint/no-explicit-any
        const codigos = data.departamentos.map((d: any) => `#${d.numero} - Piso ${d.piso}`); // eslint-disable-line @typescript-eslint/no-explicit-any
        setDepartamentosDisponibles(codigos);
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("Error al cargar departamentos:", err.message);
      }
    }
    cargarDepartamentos();
  }, []);

  const total = copropietarios.length;
  const activos = copropietarios.filter((item) => item.estado === "Activo").length;
  const departamentosOcupados = useMemo(
    () => new Set(copropietarios.filter((c) => c.estado === "Activo").map((c) => c.departamento)).size,
    [copropietarios]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return copropietarios;
    return copropietarios.filter(
      (item) =>
        `${item.nombres} ${item.apellidoPaterno} ${item.apellidoMaterno}`.toLowerCase().includes(texto) ||
        item.ci.includes(texto) ||
        item.correo.toLowerCase().includes(texto)
    );
  }, [busqueda, copropietarios]);

  const limpiarFormulario = () => {
    setForm({
      nombres: "", apellidoPaterno: "", apellidoMaterno: "",
      ci: "", correo: "", telefono: "", departamento: "", estado: "Activo",
      password: "", sexo: "M", fechaNacimiento: "",
    });
    setErrores([]);
  };

  const abrirRegistro = () => {
    limpiarFormulario();
    setMensajeExito("");
    setMostrarFormulario(true);
  };

  const cancelar = () => {
    limpiarFormulario();
    setMostrarFormulario(false);
  };

  const validar = (): string[] => {
    const problemas: string[] = [];

    if (!form.nombres.trim()) problemas.push("El nombre es obligatorio.");
    if (!form.apellidoPaterno.trim()) problemas.push("El apellido paterno es obligatorio.");
    if (!form.password || form.password.length < 8) {
      problemas.push("La contraseña debe tener al menos 8 caracteres.");
    }
    if (!form.fechaNacimiento) problemas.push("La fecha de nacimiento es obligatoria.");
    if (!CI_REGEX.test(form.ci.trim())) {
      problemas.push("El CI debe tener solo números (5 a 10 dígitos).");
    }
    if (!CORREO_REGEX.test(form.correo.trim())) {
      problemas.push("El correo electrónico no tiene un formato válido.");
    }
    if (!TELEFONO_REGEX.test(form.telefono.trim())) {
      problemas.push("El teléfono debe tener solo números (7 a 15 dígitos).");
    }

    return problemas;
  };

  const guardar = async () => {
    const problemas = validar();
    if (problemas.length > 0) {
      setErrores(problemas);
      return;
    }

    setErrores([]);
    setGuardando(true);

    try {
      await api("/copropietarios", {
        method: "POST",
        body: JSON.stringify({
          password: form.password,
          ci: form.ci.trim(),
          nombres: form.nombres.trim(),
          apellido_paterno: form.apellidoPaterno.trim(),
          apellido_materno: form.apellidoMaterno.trim() || undefined,
          sexo: form.sexo,
          fecha_de_nacimiento: form.fechaNacimiento,
          email: form.correo.trim(),
          telefono: form.telefono.trim(),
        }),
      });

      setMensajeExito("✅ Copropietario registrado correctamente");
      setMostrarFormulario(false);
      limpiarFormulario();

      const data = await api<any>("/copropietarios"); // eslint-disable-line @typescript-eslint/no-explicit-any
      const mapeados: Copropietario[] = data.copropietarios.map((c: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: c.id,
        nombres: c.nombres,
        apellidoPaterno: c.apellido_paterno,
        apellidoMaterno: c.apellido_materno ?? "",
        correo: c.email,
        ci: c.ci.toString(),
        telefono: c.telefono,
        departamento: "—",
        estado: c.estatus ? "Activo" : "Inactivo",
      }));
      setCopropietarios(mapeados);

      setTimeout(() => setMensajeExito(""), 4000);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrores([err.message || "Error al registrar copropietario"]);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (id: string) => {
    const item = copropietarios.find((c) => c.id === id);
    if (!item) return;

    const confirmar = window.confirm(
      `¿Marcar a ${item.nombres} ${item.apellidoPaterno} como Inactivo?`
    );
    if (!confirmar) return;

    setCopropietarios((lista) =>
      lista.map((c) => (c.id === id ? { ...c, estado: "Inactivo" } : c))
    );
  };

  return (
    <DashboardLayout active="copropietarios">
      <div className="min-h-screen bg-[#f6f3ee]">
        <main className="mx-auto max-w-[1180px] px-8 py-7">
          <header className="mb-7 flex items-end justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-[5px] w-[5px] rounded-full bg-[#c83232]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#c83232]">Administración</span>
              </div>
              <h1 className="text-[30px] font-semibold tracking-[-1px] text-[#302d2a]">Copropietarios</h1>
              <p className="mt-1 text-[10px] text-[#8d8680]">Gestiona la información de los propietarios del edificio.</p>
            </div>
            <button type="button" onClick={abrirRegistro} className="flex h-[39px] items-center gap-2 rounded-[7px] bg-[#c83232] px-5 text-[10px] font-semibold text-white shadow-[0_5px_14px_rgba(200,50,50,0.16)] transition hover:bg-[#b82d2d]">
              <span className="text-[16px] font-light">+</span>
              Registrar copropietario
            </button>
          </header>

          {mensajeExito && (
            <div className="mb-4 rounded-[8px] border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-[10px] text-[#2e7d32]">
              {mensajeExito}
            </div>
          )}

          <section className="mb-5 grid grid-cols-3 gap-4">
            <MetricCard icon={<UsersIcon />} title="Total copropietarios" value={total.toString()} />
            <MetricCard icon={<CheckIcon />} title="Activos" value={activos.toString()} />
            <MetricCard icon={<BuildingMiniIcon />} title="Departamentos ocupados" value={departamentosOcupados.toString()} />
          </section>

          <section className="overflow-hidden rounded-[11px] border border-[#e4ddd6] bg-white shadow-[0_2px_10px_rgba(43,32,25,0.035)]">
            <div className="flex h-[67px] items-center justify-between border-b border-[#eee9e4] px-5">
              <div>
                <h2 className="text-[12px] font-semibold text-[#383431]">Listado de copropietarios</h2>
                <p className="mt-[3px] text-[8px] text-[#a09891]">{filtrados.length} registros encontrados</p>
              </div>
              <div className="relative">
                <SearchIcon />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, CI o correo..."
                  className="h-[34px] w-[260px] rounded-[7px] border border-[#e5ded8] bg-white pl-9 pr-3 text-[9px] outline-none placeholder:text-[#aaa29b] focus:border-[#c83232] focus:ring-2 focus:ring-[#c83232]/10"
                />
              </div>
            </div>

            {cargando ? (
              <div className="flex items-center justify-center py-14">
                <p className="text-[10px] text-[#99918b]">Cargando copropietarios...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fbfaf8]">
                      <Th>COPROPIETARIO</Th>
                      <Th>CI</Th>
                      <Th>TELÉFONO</Th>
                      <Th>ESTADO</Th>
                      <Th>ACCIONES</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((item) => (
                      <tr key={item.id} className="border-t border-[#eee9e4] hover:bg-[#fdfbf9]">
                        <td className="px-5 py-[13px]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff1ed] text-[#c83232]">
                              <UserIcon />
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-[#3d3936]">
                                {item.nombres} {item.apellidoPaterno} {item.apellidoMaterno}
                              </p>
                              <p className="mt-[2px] text-[8px] text-[#a29a94]">{item.correo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 text-[9px] text-[#69625c]">{item.ci}</td>
                        <td className="px-5 text-[9px] text-[#69625c]">{item.telefono}</td>
                        <td className="px-5">
                          <Estado estado={item.estado} />
                        </td>
                        <td className="px-5">
                          <div className="flex gap-[5px]">
                            <Action title="Marcar como inactivo" onClick={() => eliminar(item.id)}><TrashIcon /></Action>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!cargando && filtrados.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0eb] text-[#c83232]"><SearchEmptyIcon /></div>
                <p className="text-[10px] font-semibold text-[#514b47]">No se encontraron resultados</p>
                <p className="mt-1 text-[8px] text-[#9d958e]">Intenta con otro nombre, CI o correo.</p>
              </div>
            )}
          </section>
        </main>
      </div>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">
          <div className="absolute inset-0 backdrop-blur-[1px]" onClick={cancelar} />

          <div className="relative z-10 w-full max-w-[570px] overflow-hidden rounded-[18px] bg-white shadow-[0_20px_55px_rgba(0,0,0,0.20)]">
            <div className="h-[3px] bg-[#c83232]" />

            <div className="flex items-start justify-between px-8 pb-5 pt-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#fff0eb] text-[#c83232]"><UserFormIcon /></div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#c83232]">Nuevo registro</p>
                  <h2 className="mt-1 text-[19px] font-medium tracking-[-0.4px] text-[#383431]">Registrar copropietario</h2>
                  <p className="mt-1 text-[9px] text-[#938a83]">Ingresa los datos del propietario.</p>
                </div>
              </div>
              <button type="button" onClick={cancelar} className="flex h-7 w-7 items-center justify-center rounded-full text-[#918982] hover:bg-[#f7f2ee] hover:text-[#c83232]"><CloseIcon /></button>
            </div>

            <div className="h-px bg-[#eee8e3]" />

            <div className="max-h-[70vh] overflow-y-auto px-8 py-5">
              {errores.length > 0 && (
                <div className="mb-4 rounded-[8px] border border-[#f3c9c3] bg-[#fff3f1] px-4 py-3">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#c83232]">Revisa estos campos</p>
                  <ul className="list-disc pl-4 text-[9px] text-[#8a4038]">
                    {errores.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#c83232]" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#68615b]">Información personal</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombres" required placeholder="Ej. María Fernanda" value={form.nombres} onChange={(value) => setForm({ ...form, nombres: value })} />
                  <Input label="Apellido paterno" required placeholder="Ej. Rojas" value={form.apellidoPaterno} onChange={(value) => setForm({ ...form, apellidoPaterno: value })} />
                  <Input label="Apellido materno" placeholder="Ej. Salazar (opcional)" value={form.apellidoMaterno} onChange={(value) => setForm({ ...form, apellidoMaterno: value })} />
                  <Input label="Número de CI" required placeholder="Solo números, ej. 4587210" value={form.ci} onChange={(value) => setForm({ ...form, ci: value.replace(/\D/g, "") })} />
                  <Input label="Correo electrónico" required placeholder="Ej. maria@email.com" type="email" value={form.correo} onChange={(value) => setForm({ ...form, correo: value })} />
                  <Input label="Número de teléfono" required placeholder="Solo números, ej. 69848860" value={form.telefono} onChange={(value) => setForm({ ...form, telefono: value.replace(/\D/g, "") })} />
                  <Input label="Contraseña" required placeholder="Mínimo 8 caracteres" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
                  <Input label="Fecha de nacimiento" required placeholder="" type="date" value={form.fechaNacimiento} onChange={(value) => setForm({ ...form, fechaNacimiento: value })} />
                  
                  <div>
                    <label className="mb-1.5 block text-[8px] font-semibold text-[#5a534d]">
                      Sexo<span className="ml-1 text-[#c83232]">*</span>
                    </label>
                    <select
                      value={form.sexo}
                      onChange={(e) => setForm({ ...form, sexo: e.target.value as "M" | "F" })}
                      className="h-[42px] w-full rounded-[9px] border border-[#ddd5ce] bg-white px-3 text-[9px] text-[#49433f] outline-none focus:border-[#c83232] focus:ring-[3px] focus:ring-[#c83232]/10"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#eee8e3] px-8 py-4">
              <p className="text-[8px] text-[#9b928b]">
                Los campos marcados con <span className="font-semibold text-[#c83232]">*</span> son obligatorios.
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={cancelar} className="h-[36px] rounded-[7px] border border-[#ded6cf] bg-white px-5 text-[9px] font-medium text-[#716963] transition hover:bg-[#f7f3f0]">Cancelar</button>
                <button type="button" onClick={guardar} disabled={guardando} className="h-[36px] rounded-[7px] bg-[#c83232] px-5 text-[9px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.16)] transition hover:bg-[#b72d2d] disabled:opacity-50">
                  {guardando ? "Registrando..." : "Registrar copropietario"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function MetricCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex h-[78px] items-center gap-3 rounded-[10px] border border-[#e5ded7] bg-white px-4 shadow-[0_2px_7px_rgba(45,33,25,0.025)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#fff0eb] text-[#c83232]">{icon}</div>
      <div>
        <p className="text-[8px] text-[#99918b]">{title}</p>
        <p className="mt-1 text-[19px] font-bold leading-none text-[#373330]">{value}</p>
      </div>
    </div>
  );
}

function Input({ label, placeholder, value, onChange, required, type = "text" }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; }) {
  return (
    <div>
      <label className="mb-1.5 block text-[8px] font-semibold text-[#5a534d]">
        {label}
        {required && <span className="ml-1 text-[#c83232]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-[42px] w-full rounded-[9px] border border-[#ddd5ce] bg-white px-3 text-[9px] text-[#49433f] outline-none placeholder:text-[#aaa19a] focus:border-[#c83232] focus:ring-[3px] focus:ring-[#c83232]/10"
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-[11px] text-left text-[7px] font-bold tracking-[0.08em] text-[#9b938d]">{children}</th>;
}

function Estado({ estado }: { estado: Estado }) {
  const activo = estado === "Activo";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[7px] font-semibold ${activo ? "bg-[#eaf4e7] text-[#5b8955]" : "bg-[#eeeae7] text-[#817971]"}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${activo ? "bg-[#6da361]" : "bg-[#9a9088]"}`} />
      {estado}
    </span>
  );
}

function Action({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="flex h-[27px] w-[27px] items-center justify-center rounded-[6px] bg-[#faf8f6] text-[#938a83] transition hover:bg-[#fff0eb] hover:text-[#c83232]">
      {children}
    </button>
  );
}

function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function UserIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}
function UserFormIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}
function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
}
function BuildingMiniIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></svg>;
}
function SearchIcon() {
  return <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa19a]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
function SearchEmptyIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /><path d="M8 10.5h5" /></svg>;
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>;
}
function CloseIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
}