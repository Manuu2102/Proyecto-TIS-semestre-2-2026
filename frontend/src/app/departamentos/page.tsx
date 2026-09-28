"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardLayout } from "../../../components/DashboardLayout";
import { api } from "../../../lib/api";

type EstadoDepartamento = "Ocupado" | "Disponible";

type Departamento = {
  id: string;
  numero: number;
  piso: number;
  habitaciones: number;
  banos: number;
  superficie_m2: number;
  precio: number;
  amueblado: boolean;
  libre: boolean;
  descripcion: string;
  ocupante: string;
  estado: EstadoDepartamento;
};

export default function DepartamentosPage() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalDepartamento, setModalDepartamento] = useState(false);
  const [editandoDepartamento, setEditandoDepartamento] = useState<Departamento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errores, setErrores] = useState<string[]>([]);

  const [formDepartamento, setFormDepartamento] = useState({
    numero: "",
    piso: "",
    habitaciones: "",
    banos: "",
    superficie_m2: "",
    precio: "",
    amueblado: false,
    libre: true,
    descripcion: "",
  });

  // CARGAR DEPARTAMENTOS DEL BACKEND
  useEffect(() => {
    async function cargarDatos() {
      try {
        setCargando(true);
        const data = await api<any>("/departamentos"); // eslint-disable-line @typescript-eslint/no-explicit-any
        const mapeados: Departamento[] = data.departamentos.map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: d.id,
          numero: d.numero,
          piso: d.piso,
          habitaciones: d.habitaciones,
          banos: d.banos,
          superficie_m2: d.superficie_m2,
          precio: Number(d.precio),
          amueblado: d.amueblado,
          libre: d.libre,
          descripcion: d.descripcion,
          ocupante: d.departamento_usuario?.[0]?.usuario
            ? `${d.departamento_usuario[0].usuario.nombres} ${d.departamento_usuario[0].usuario.apellido_paterno}`
            : "Sin ocupante",
          estado: d.libre ? "Disponible" : "Ocupado",
        }));
        setDepartamentos(mapeados);
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("Error al cargar departamentos:", err.message);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, []);

  const totalUnidades = departamentos.length;
  const ocupadas = departamentos.filter((d) => d.estado === "Ocupado").length;
  const disponibles = departamentos.filter((d) => d.estado === "Disponible").length;
  const superficieTotal = departamentos.reduce((total, d) => total + d.superficie_m2, 0);

  const departamentosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return departamentos;

    return departamentos.filter((d) => {
      return (
        d.numero.toString().includes(texto) ||
        d.descripcion.toLowerCase().includes(texto) ||
        d.ocupante.toLowerCase().includes(texto) ||
        d.estado.toLowerCase().includes(texto) ||
        d.piso.toString().includes(texto)
      );
    });
  }, [busqueda, departamentos]);

  const abrirNuevoDepartamento = () => {
    setEditandoDepartamento(null);
    setErrores([]);
    setFormDepartamento({
      numero: "",
      piso: "",
      habitaciones: "",
      banos: "",
      superficie_m2: "",
      precio: "",
      amueblado: false,
      libre: true,
      descripcion: "",
    });
    setModalDepartamento(true);
  };

  const editarDepartamento = (d: Departamento) => {
    setEditandoDepartamento(d);
    setErrores([]);
    setFormDepartamento({
      numero: d.numero.toString(),
      piso: d.piso.toString(),
      habitaciones: d.habitaciones.toString(),
      banos: d.banos.toString(),
      superficie_m2: d.superficie_m2.toString(),
      precio: d.precio.toString(),
      amueblado: d.amueblado,
      libre: d.libre,
      descripcion: d.descripcion,
    });
    setModalDepartamento(true);
  };

  const cancelar = () => {
    setModalDepartamento(false);
    setEditandoDepartamento(null);
    setErrores([]);
  };

  const validar = (): string[] => {
    const problemas: string[] = [];

    if (!formDepartamento.numero || Number(formDepartamento.numero) < 1) {
      problemas.push("El número es obligatorio y debe ser mayor a 0.");
    }
    if (!formDepartamento.piso || Number(formDepartamento.piso) < 0) {
      problemas.push("El piso es obligatorio.");
    }
    if (!formDepartamento.habitaciones || Number(formDepartamento.habitaciones) < 0) {
      problemas.push("Las habitaciones son obligatorias.");
    }
    if (!formDepartamento.banos || Number(formDepartamento.banos) < 0) {
      problemas.push("Los baños son obligatorios.");
    }
    if (!formDepartamento.superficie_m2 || Number(formDepartamento.superficie_m2) < 0) {
      problemas.push("La superficie es obligatoria.");
    }
    if (!formDepartamento.precio || Number(formDepartamento.precio) < 0) {
      problemas.push("El precio es obligatorio.");
    }
    if (!formDepartamento.descripcion.trim()) {
      problemas.push("La descripción es obligatoria.");
    }

    return problemas;
  };

  const guardarDepartamento = async () => {
    const problemas = validar();
    if (problemas.length > 0) {
      setErrores(problemas);
      return;
    }

    setErrores([]);
    setGuardando(true);

    try {
      const payload = {
        numero: Number(formDepartamento.numero),
        piso: Number(formDepartamento.piso),
        habitaciones: Number(formDepartamento.habitaciones),
        banos: Number(formDepartamento.banos),
        superficie_m2: Number(formDepartamento.superficie_m2),
        precio: Number(formDepartamento.precio),
        amueblado: formDepartamento.amueblado,
        libre: formDepartamento.libre,
        descripcion: formDepartamento.descripcion.trim(),
      };

      if (editandoDepartamento) {
        await api(`/departamentos/${editandoDepartamento.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMensajeExito("✅ Departamento actualizado correctamente");
      } else {
        await api("/departamentos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMensajeExito("✅ Departamento registrado correctamente");
      }

      cancelar();

      const data = await api<any>("/departamentos"); // eslint-disable-line @typescript-eslint/no-explicit-any
      const mapeados: Departamento[] = data.departamentos.map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: d.id,
        numero: d.numero,
        piso: d.piso,
        habitaciones: d.habitaciones,
        banos: d.banos,
        superficie_m2: d.superficie_m2,
        precio: Number(d.precio),
        amueblado: d.amueblado,
        libre: d.libre,
        descripcion: d.descripcion,
        ocupante: "Sin ocupante",
        estado: d.libre ? "Disponible" : "Ocupado",
      }));
      setDepartamentos(mapeados);

      setTimeout(() => setMensajeExito(""), 4000);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrores([err.message || "Error al guardar departamento"]);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarDepartamento = async (id: string) => {
    const item = departamentos.find((d) => d.id === id);
    if (!item) return;

    if (!window.confirm(`¿Desactivar el departamento #${item.numero}?`)) {
      return;
    }

    try {
      await api(`/departamentos/${id}`, { method: "DELETE" });

      const data = await api<any>("/departamentos"); // eslint-disable-line @typescript-eslint/no-explicit-any
      const mapeados: Departamento[] = data.departamentos.map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: d.id,
        numero: d.numero,
        piso: d.piso,
        habitaciones: d.habitaciones,
        banos: d.banos,
        superficie_m2: d.superficie_m2,
        precio: Number(d.precio),
        amueblado: d.amueblado,
        libre: d.libre,
        descripcion: d.descripcion,
        ocupante: "Sin ocupante",
        estado: d.libre ? "Disponible" : "Ocupado",
      }));
      setDepartamentos(mapeados);
      setMensajeExito("✅ Departamento desactivado");
      setTimeout(() => setMensajeExito(""), 3000);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrores([err.message]);
      setTimeout(() => setErrores([]), 4000);
    }
  };

  return (
    <DashboardLayout active="departamentos">
      <div className="min-h-screen bg-[#f7f4ef]">
        <main className="mx-auto max-w-[1250px] px-7 py-7">
          {/* HEADER */}
          <div className="mb-7 flex items-end justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c83232]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c83232]">
                  Administración
                </span>
              </div>
              <h1 className="text-[30px] font-bold tracking-[-0.8px] text-[#302d2b]">
                Departamentos
              </h1>
              <p className="mt-1.5 text-[11px] text-[#8b8580]">
                Administra las unidades habitacionales del edificio.
              </p>
            </div>

            <button
              onClick={abrirNuevoDepartamento}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#c93232] px-5 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(201,50,50,0.18)] transition hover:-translate-y-[1px] hover:bg-[#b82b2b]"
            >
              <span className="text-[17px] font-light">+</span>
              Registrar departamento
            </button>
          </div>

          {mensajeExito && (
            <div className="mb-4 rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-[10px] text-[#2e7d32]">
              {mensajeExito}
            </div>
          )}

          {errores.length > 0 && (
            <div className="mb-4 rounded-lg border border-[#f3c9c3] bg-[#fff3f1] px-4 py-3 text-[10px] text-[#8a4038]">
              <ul className="list-disc pl-4">
                {errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ESTADÍSTICAS */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <StatCard icon={<BuildingIcon />} title="Total unidades" value={totalUnidades.toString()} />
            <StatCard icon={<HomeIcon />} title="Ocupadas" value={ocupadas.toString()} />
            <StatCard icon={<CheckIcon />} title="Disponibles" value={disponibles.toString()} />
            <StatCard icon={<RulerIcon />} title="Superficie total" value={`${superficieTotal.toLocaleString("es-BO")} m²`} />
          </div>

          {/* TABLA */}
          <div className="overflow-hidden rounded-xl border border-[#e7e0d9] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.035)]">
            <div className="flex items-center justify-between border-b border-[#eee9e4] px-5 py-4">
              <div>
                <h2 className="text-[13px] font-bold text-[#36322f]">Unidades del edificio</h2>
                <p className="mt-1 text-[9px] text-[#99918b]">
                  {departamentosFiltrados.length} departamentos encontrados
                </p>
              </div>
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por número, piso o estado..." />
            </div>

            {cargando ? (
              <div className="flex items-center justify-center py-14">
                <p className="text-[10px] text-[#99918b]">Cargando departamentos...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fbfaf8]">
                      <HeaderCell>DEPARTAMENTO</HeaderCell>
                      <HeaderCell>PISO</HeaderCell>
                      <HeaderCell>HABITACIONES</HeaderCell>
                      <HeaderCell>BAÑOS</HeaderCell>
                      <HeaderCell>SUPERFICIE</HeaderCell>
                      <HeaderCell>PRECIO</HeaderCell>
                      <HeaderCell>ESTADO</HeaderCell>
                      <HeaderCell>ACCIONES</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {departamentosFiltrados.map((d) => (
                      <tr key={d.id} className="border-t border-[#eeeae6] transition hover:bg-[#fdfbf9]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#fff0eb] text-[#c83232]">
                              <BuildingIcon />
                            </div>
                            <span className="text-[10px] font-bold text-[#3b3734]">#{d.numero}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[10px] text-[#68615c]">{d.piso}</td>
                        <td className="px-5 py-4 text-[10px] text-[#68615c]">{d.habitaciones}</td>
                        <td className="px-5 py-4 text-[10px] text-[#68615c]">{d.banos}</td>
                        <td className="px-5 py-4 text-[10px] text-[#68615c]">{d.superficie_m2} m²</td>
                        <td className="px-5 py-4 text-[10px] font-medium text-[#5d5752]">Bs. {d.precio}</td>
                        <td className="px-5 py-4">
                          <StatusBadge estado={d.estado} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1.5">
                            <IconButton title="Editar" onClick={() => editarDepartamento(d)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton title="Eliminar" danger onClick={() => eliminarDepartamento(d.id)}>
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!cargando && departamentosFiltrados.length === 0 && (
              <EmptyState texto="No se encontraron departamentos." />
            )}
          </div>
        </main>

        {/* MODAL DEPARTAMENTO */}
        {modalDepartamento && (
          <ModalOverlay>
            <div className="w-full max-w-[570px] overflow-hidden rounded-[18px] border border-[#e4dcd5] bg-white shadow-[0_30px_90px_rgba(38,29,24,0.25)]">
              <div className="relative border-b border-[#eee8e2] px-8 pb-6 pt-7">
                <div className="absolute left-0 top-0 h-[3px] w-full bg-[#c83232]" />
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0eb] text-[#c83232]">
                      <BuildingIcon />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#c83232]">
                        {editandoDepartamento ? "Edición" : "Nuevo registro"}
                      </p>
                      <h2 className="mt-1 text-[20px] font-bold tracking-[-0.4px] text-[#302d2b]">
                        {editandoDepartamento ? "Editar departamento" : "Registrar departamento"}
                      </h2>
                      <p className="mt-1 text-[10px] text-[#948c86]">
                        Ingresa los datos de la unidad habitacional.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={cancelar}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#948c86] transition hover:bg-[#f7f2ee] hover:text-[#3e3935]"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-8 py-7">
                {errores.length > 0 && (
                  <div className="mb-4 rounded-lg border border-[#f3c9c3] bg-[#fff3f1] px-4 py-3">
                    <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#c83232]">
                      Revisa estos campos
                    </p>
                    <ul className="list-disc pl-4 text-[9px] text-[#8a4038]">
                      {errores.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  <ElegantInput
                    label="Número"
                    required
                    placeholder="Ej. 101"
                    type="number"
                    value={formDepartamento.numero}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, numero: value })}
                  />
                  <ElegantInput
                    label="Piso"
                    required
                    placeholder="Ej. 1"
                    type="number"
                    value={formDepartamento.piso}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, piso: value })}
                  />
                  <ElegantInput
                    label="Habitaciones"
                    required
                    placeholder="Ej. 3"
                    type="number"
                    value={formDepartamento.habitaciones}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, habitaciones: value })}
                  />
                  <ElegantInput
                    label="Baños"
                    required
                    placeholder="Ej. 2"
                    type="number"
                    value={formDepartamento.banos}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, banos: value })}
                  />
                  <ElegantInput
                    label="Superficie"
                    required
                    placeholder="Ej. 85"
                    type="number"
                    suffix="m²"
                    value={formDepartamento.superficie_m2}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, superficie_m2: value })}
                  />
                  <ElegantInput
                    label="Precio"
                    required
                    placeholder="Ej. 1500"
                    type="number"
                    prefix="Bs."
                    value={formDepartamento.precio}
                    onChange={(value) => setFormDepartamento({ ...formDepartamento, precio: value })}
                  />
                  <div className="col-span-2">
                    <ElegantInput
                      label="Descripción"
                      required
                      placeholder="Ej. Departamento amplio con vista"
                      value={formDepartamento.descripcion}
                      onChange={(value) => setFormDepartamento({ ...formDepartamento, descripcion: value })}
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formDepartamento.amueblado}
                      onChange={(e) => setFormDepartamento({ ...formDepartamento, amueblado: e.target.checked })}
                      className="h-4 w-4 accent-[#c83232]"
                    />
                    <span className="text-[10px] font-semibold text-[#514b46]">Amueblado</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formDepartamento.libre}
                      onChange={(e) => setFormDepartamento({ ...formDepartamento, libre: e.target.checked })}
                      className="h-4 w-4 accent-[#c83232]"
                    />
                    <span className="text-[10px] font-semibold text-[#514b46]">Libre / Disponible</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#eee8e2] bg-[#fcfaf8] px-8 py-4">
                <button
                  onClick={cancelar}
                  className="h-9 rounded-lg border border-[#e5dbd3] bg-white px-5 text-[10px] font-semibold text-[#756d67] transition hover:bg-[#f8f3ef]"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarDepartamento}
                  disabled={guardando}
                  className="h-9 rounded-lg bg-[#c83232] px-6 text-[10px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.2)] transition hover:bg-[#b72b2b] disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : editandoDepartamento ? "Guardar cambios" : "Registrar departamento"}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// COMPONENTES
// ============================================================

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="group flex h-[82px] items-center gap-3 rounded-xl border border-[#e7e0d9] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.025)] transition hover:-translate-y-[1px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0eb] text-[#c83232] transition group-hover:bg-[#c83232] group-hover:text-white">
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-[#99918b]">{title}</p>
        <p className="mt-1 text-[20px] font-bold leading-none text-[#36322f]">{value}</p>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-left text-[8px] font-bold tracking-[0.06em] text-[#9b938d]">
      {children}
    </th>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa19a]">
        <SearchIcon />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-[245px] rounded-lg border border-[#e5ded7] bg-white pl-9 pr-3 text-[9px] outline-none transition placeholder:text-[#aaa19a] focus:border-[#d5aaa4] focus:ring-2 focus:ring-[#c83232]/5"
      />
    </div>
  );
}

function ElegantInput({ label, placeholder, value, onChange, type = "text", prefix, suffix, required = false }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; type?: string; prefix?: string; suffix?: string; required?: boolean; }) {
  return (
    <div>
      <label className="mb-2 block text-[9px] font-semibold text-[#514b46]">
        {label}
        {required && <span className="ml-1 text-[#c83232]">*</span>}
      </label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-medium text-[#8c837c]">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-[42px] w-full rounded-[9px] border border-[#ded6cf] bg-[#fffdfc] text-[10px] text-[#3f3a36] outline-none transition placeholder:text-[#aaa19a] hover:border-[#d2c8c0] focus:border-[#c83232] focus:bg-white focus:ring-[3px] focus:ring-[#c83232]/10 ${prefix ? "pl-10 pr-3" : "px-3"} ${suffix ? "pr-10" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-medium text-[#8c837c]">{suffix}</span>}
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick, danger = false }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${danger ? "bg-[#faf8f6] text-[#958b84] hover:bg-[#fff0eb] hover:text-[#c83232]" : "bg-[#faf8f6] text-[#958b84] hover:bg-[#f1ece8] hover:text-[#4f4945]"}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ estado }: { estado: EstadoDepartamento }) {
  const ocupado = estado === "Ocupado";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-semibold ${ocupado ? "bg-[#eaf4e7] text-[#5c8956]" : "bg-[#fff0eb] text-[#c56a50]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ocupado ? "bg-[#70a566]" : "bg-[#e77c5d]"}`} />
      {estado}
    </span>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0eb] text-[#c83232]">
        <BuildingIcon />
      </div>
      <p className="text-[11px] font-semibold text-[#514b47]">Sin resultados</p>
      <p className="mt-1 text-[9px] text-[#99918b]">{texto}</p>
    </div>
  );
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241d19]/50 p-5 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

// ============================================================
// ICONOS
// ============================================================

function BuildingIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M2 21h20" />
      <path d="M8 7h2M12 7h2M8 11h2M12 11h2M8 15h2M12 15h2" />
      <path d="M18 21V9h2a2 2 0 0 1 2 2v10" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="m3 21 18-18" />
      <path d="m5 17 2 2M8 14l2 2M11 11l2 2M14 8l2 2M17 5l2 2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}