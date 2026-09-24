"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";

type Estado = "Activo" | "Inactivo";

type Copropietario = {
  id: number;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
  ci: string;
  telefono: string;
  departamento: string;
  estado: Estado;
};

// Simula la lista real de departamentos del edificio (esto vendrá del backend
// cuando exista el endpoint de /departamentos; por ahora se fija aquí para
// que el admin NO pueda escribir un departamento que no existe).
const DEPARTAMENTOS_DISPONIBLES = [
  "A-101", "A-102", "A-105", "A-106",
  "A-201", "A-202",
  "B-201", "B-202",
  "B-301", "B-302",
];

const datosIniciales: Copropietario[] = [
  { id: 1, nombres: "María Fernanda", apellidoPaterno: "Rojas", apellidoMaterno: "Salazar", correo: "maria.rojas@email.com", ci: "4587210", telefono: "72145678", departamento: "A-101", estado: "Activo" },
  { id: 2, nombres: "Carlos Andrés", apellidoPaterno: "Pérez", apellidoMaterno: "Mamani", correo: "carlos.perez@email.com", ci: "5129034", telefono: "73422011", departamento: "A-202", estado: "Activo" },
  { id: 3, nombres: "Sofía Valentina", apellidoPaterno: "Cruz", apellidoMaterno: "Fernández", correo: "sofia.cruz@email.com", ci: "6342189", telefono: "70388122", departamento: "B-301", estado: "Activo" },
  { id: 4, nombres: "Melody", apellidoPaterno: "Gutiérrez", apellidoMaterno: "Rivera", correo: "melody.gutierrez@email.com", ci: "7189234", telefono: "70122344", departamento: "A-105", estado: "Activo" },
  { id: 5, nombres: "Rodrigo", apellidoPaterno: "Quispe", apellidoMaterno: "Choque", correo: "rodrigo.quispe@email.com", ci: "7198452", telefono: "69733122", departamento: "A-106", estado: "Activo" },
  { id: 6, nombres: "Alejandra", apellidoPaterno: "Guzmán", apellidoMaterno: "Ortiz", correo: "alejandra.guzman@email.com", ci: "6234812", telefono: "70388122", departamento: "B-202", estado: "Activo" },
];

const CI_REGEX = /^[0-9]{5,10}$/;
const TELEFONO_REGEX = /^[0-9]{7,15}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CopropietariosPage() {
  const [copropietarios, setCopropietarios] = useState<Copropietario[]>(datosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  const [form, setForm] = useState({
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    ci: "",
    correo: "",
    telefono: "",
    departamento: "",
    estado: "Activo" as Estado,
  });

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
        item.departamento.toLowerCase().includes(texto) ||
        item.correo.toLowerCase().includes(texto)
    );
  }, [busqueda, copropietarios]);

  const limpiarFormulario = () => {
    setForm({
      nombres: "", apellidoPaterno: "", apellidoMaterno: "",
      ci: "", correo: "", telefono: "", departamento: "", estado: "Activo",
    });
    setEditando(null);
    setErrores([]);
  };

  const abrirRegistro = () => {
    limpiarFormulario();
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
    if (!form.departamento.trim()) problemas.push("Debes seleccionar un departamento.");

    if (!CI_REGEX.test(form.ci.trim())) {
      problemas.push("El CI debe tener solo números (5 a 10 dígitos).");
    } else {
      const duplicadoCI = copropietarios.some(
        (c) => c.ci === form.ci.trim() && c.id !== editando
      );
      if (duplicadoCI) problemas.push("Ya existe un copropietario registrado con ese CI.");
    }

    if (!CORREO_REGEX.test(form.correo.trim())) {
      problemas.push("El correo electrónico no tiene un formato válido.");
    } else {
      const duplicadoCorreo = copropietarios.some(
        (c) => c.correo.toLowerCase() === form.correo.trim().toLowerCase() && c.id !== editando
      );
      if (duplicadoCorreo) problemas.push("Ya existe un copropietario registrado con ese correo.");
    }

    if (!TELEFONO_REGEX.test(form.telefono.trim())) {
      problemas.push("El teléfono debe tener solo números (7 a 15 dígitos).");
    }

    return problemas;
  };

  const guardar = () => {
    const problemas = validar();
    if (problemas.length > 0) {
      setErrores(problemas);
      return;
    }

    const datos = {
      nombres: form.nombres.trim(),
      apellidoPaterno: form.apellidoPaterno.trim(),
      apellidoMaterno: form.apellidoMaterno.trim(),
      correo: form.correo.trim(),
      ci: form.ci.trim(),
      telefono: form.telefono.trim(),
      departamento: form.departamento,
      estado: form.estado,
    };

    if (editando !== null) {
      setCopropietarios((lista) =>
        lista.map((item) => (item.id === editando ? { ...item, ...datos } : item))
      );
    } else {
      setCopropietarios((lista) => [...lista, { id: Date.now(), ...datos }]);
    }

    cancelar();
  };

  const editar = (item: Copropietario) => {
    setForm({
      nombres: item.nombres,
      apellidoPaterno: item.apellidoPaterno,
      apellidoMaterno: item.apellidoMaterno,
      ci: item.ci,
      correo: item.correo,
      telefono: item.telefono,
      departamento: item.departamento,
      estado: item.estado,
    });
    setEditando(item.id);
    setErrores([]);
    setMostrarFormulario(true);
  };

  const eliminar = (id: number) => {
    const item = copropietarios.find((c) => c.id === id);
    if (!item) return;

    if (item.estado === "Activo") {
      const confirmar = window.confirm(
        `¿Marcar a ${item.nombres} ${item.apellidoPaterno} como Inactivo? Su historial se conservará.`
      );
      if (!confirmar) return;
      setCopropietarios((lista) =>
        lista.map((c) => (c.id === id ? { ...c, estado: "Inactivo" } : c))
      );
    } else {
      const confirmar = window.confirm(
        `Este copropietario ya está Inactivo. ¿Eliminar el registro de forma permanente?`
      );
      if (!confirmar) return;
      setCopropietarios((lista) => lista.filter((c) => c.id !== id));
    }
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
                  placeholder="Buscar por nombre, CI o departamento..."
                  className="h-[34px] w-[260px] rounded-[7px] border border-[#e5ded8] bg-white pl-9 pr-3 text-[9px] outline-none placeholder:text-[#aaa29b] focus:border-[#c83232] focus:ring-2 focus:ring-[#c83232]/10"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#fbfaf8]">
                    <Th>COPROPIETARIO</Th>
                    <Th>CI</Th>
                    <Th>TELÉFONO</Th>
                    <Th>DEPARTAMENTO</Th>
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
                        <span className="inline-flex rounded-[5px] bg-[#fff0eb] px-[9px] py-[5px] text-[8px] font-bold text-[#c94b3e]">
                          {item.departamento}
                        </span>
                      </td>
                      <td className="px-5">
                        <Estado estado={item.estado} />
                      </td>
                      <td className="px-5">
                        <div className="flex gap-[5px]">
                          <Action title="Editar" onClick={() => editar(item)}><EditIcon /></Action>
                          <Action title={item.estado === "Activo" ? "Marcar como inactivo" : "Eliminar definitivamente"} onClick={() => eliminar(item.id)}><TrashIcon /></Action>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtrados.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0eb] text-[#c83232]"><SearchEmptyIcon /></div>
                <p className="text-[10px] font-semibold text-[#514b47]">No se encontraron resultados</p>
                <p className="mt-1 text-[8px] text-[#9d958e]">Intenta con otro nombre, CI o departamento.</p>
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
                  <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#c83232]">{editando ? "Editar registro" : "Nuevo registro"}</p>
                  <h2 className="mt-1 text-[19px] font-medium tracking-[-0.4px] text-[#383431]">{editando ? "Editar copropietario" : "Registrar copropietario"}</h2>
                  <p className="mt-1 text-[9px] text-[#938a83]">Ingresa los datos del propietario.</p>
                </div>
              </div>
              <button type="button" onClick={cancelar} className="flex h-7 w-7 items-center justify-center rounded-full text-[#918982] hover:bg-[#f7f2ee] hover:text-[#c83232]"><CloseIcon /></button>
            </div>

            <div className="h-px bg-[#eee8e3]" />

            <div className="px-8 py-5">
              {errores.length > 0 && (
                <div className="mb-4 rounded-[8px] border border-[#f3c9c3] bg-[#fff3f1] px-4 py-3">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#c83232]">Revisa estos campos</p>
                  <ul className="list-disc pl-4 text-[9px] text-[#8a4038]">
                    {errores.map((err) => <li key={err}>{err}</li>)}
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
                </div>
              </div>

              <div className="my-4 h-px bg-[#eee8e3]" />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#c83232]" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#68615b]">Unidad asignada</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[8px] font-semibold text-[#5a534d]">
                      Departamento<span className="ml-1 text-[#c83232]">*</span>
                    </label>
                    <select
                      value={form.departamento}
                      onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                      className="h-[42px] w-full rounded-[9px] border border-[#ddd5ce] bg-white px-3 text-[9px] text-[#49433f] outline-none focus:border-[#c83232] focus:ring-[3px] focus:ring-[#c83232]/10"
                    >
                      <option value="">Selecciona un departamento</option>
                      {DEPARTAMENTOS_DISPONIBLES.map((dep) => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[7px] text-[#a09891]">
                      El monto de expensa se gestiona en el módulo de Departamentos/Finanzas, no aquí.
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1.5 block text-[8px] font-semibold text-[#59524d]">Estado<span className="ml-1 text-[#c83232]">*</span></label>
                  <div className="flex gap-2">
                    <EstadoButton activo={form.estado === "Activo"} texto="Activo" onClick={() => setForm({ ...form, estado: "Activo" })} />
                    <EstadoButton activo={form.estado === "Inactivo"} texto="Inactivo" onClick={() => setForm({ ...form, estado: "Inactivo" })} />
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
                <button type="button" onClick={guardar} className="h-[36px] rounded-[7px] bg-[#c83232] px-5 text-[9px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.16)] transition hover:bg-[#b72d2d]">
                  {editando ? "Guardar cambios" : "Registrar copropietario"}
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

function EstadoButton({ activo, texto, onClick }: { activo: boolean; texto: string; onClick: () => void }) {
  const esActivo = texto === "Activo";
  return (
    <button type="button" onClick={onClick} className={`flex h-[31px] items-center justify-center gap-1.5 rounded-[7px] px-4 text-[8px] font-semibold transition-all ${activo ? (esActivo ? "bg-[#c83232] text-white shadow-[0_3px_8px_rgba(200,50,50,0.18)]" : "bg-[#817971] text-white") : "border border-[#ddd5ce] bg-white text-[#837a73] hover:bg-[#faf8f6]"}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${activo ? "bg-white" : esActivo ? "bg-[#c83232]" : "bg-[#968c84]"}`} />
      {texto}
    </button>
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
function EditIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
}
function TrashIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>;
}
function CloseIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
}