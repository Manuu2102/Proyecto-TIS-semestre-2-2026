"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";

type Estado = "Activo" | "Inactivo";

type Copropietario = {
  id: number;
  nombre: string;
  correo: string;
  ci: string;
  telefono: string;
  departamento: string;
  monto: number;
  estado: Estado;
};

const datosIniciales: Copropietario[] = [
  {
    id: 1,
    nombre: "María Fernanda Rojas",
    correo: "maria.rojas@email.com",
    ci: "4587210",
    telefono: "721 456 780",
    departamento: "A-101",
    monto: 650,
    estado: "Activo",
  },
  {
    id: 2,
    nombre: "Carlos Andrés Pérez",
    correo: "carlos.perez@email.com",
    ci: "5129034",
    telefono: "734 220 114",
    departamento: "A-202",
    monto: 650,
    estado: "Activo",
  },
  {
    id: 3,
    nombre: "Sofía Valentina Cruz",
    correo: "sofia.cruz@email.com",
    ci: "6342189",
    telefono: "703 881 220",
    departamento: "B-301",
    monto: 650,
    estado: "Activo",
  },
  {
    id: 4,
    nombre: "Melody Gutiérrez",
    correo: "melody.gutierrez@email.com",
    ci: "7189234",
    telefono: "701 223 440",
    departamento: "A-105",
    monto: 750,
    estado: "Activo",
  },
  {
    id: 5,
    nombre: "Rodrigo Quispe",
    correo: "rodrigo.quispe@email.com",
    ci: "7198452",
    telefono: "697 331 220",
    departamento: "A-106",
    monto: 650,
    estado: "Activo",
  },
  {
    id: 6,
    nombre: "Alejandra Guzmán",
    correo: "alejandra.guzman@email.com",
    ci: "6234812",
    telefono: "703 881 220",
    departamento: "B-202",
    monto: 650,
    estado: "Activo",
  },
];

export default function CopropietariosPage() {
  const [copropietarios, setCopropietarios] =
    useState<Copropietario[]>(datosIniciales);

  const [busqueda, setBusqueda] = useState("");

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [editando, setEditando] =
    useState<number | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    ci: "",
    correo: "",
    telefono: "",
    departamento: "",
    monto: "",
    estado: "Activo" as Estado,
  });

  const total = copropietarios.length;

  const activos = copropietarios.filter(
    (item) => item.estado === "Activo"
  ).length;

  const montoTotal = copropietarios.reduce(
    (suma, item) => suma + item.monto,
    0
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return copropietarios;

    return copropietarios.filter(
      (item) =>
        item.nombre.toLowerCase().includes(texto) ||
        item.ci.includes(texto) ||
        item.departamento.toLowerCase().includes(texto) ||
        item.correo.toLowerCase().includes(texto)
    );
  }, [busqueda, copropietarios]);

  const limpiarFormulario = () => {
    setForm({
      nombre: "",
      apellidos: "",
      ci: "",
      correo: "",
      telefono: "",
      departamento: "",
      monto: "",
      estado: "Activo",
    });

    setEditando(null);
  };

  const abrirRegistro = () => {
    limpiarFormulario();
    setMostrarFormulario(true);
  };

  const cancelar = () => {
    limpiarFormulario();
    setMostrarFormulario(false);
  };

  const guardar = () => {
    if (
      !form.nombre.trim() ||
      !form.apellidos.trim() ||
      !form.ci.trim() ||
      !form.correo.trim() ||
      !form.telefono.trim() ||
      !form.departamento.trim() ||
      !form.monto.trim()
    ) {
      alert("Completa todos los campos obligatorios.");
      return;
    }

    const nombreCompleto =
      `${form.nombre.trim()} ${form.apellidos.trim()}`;

    if (editando !== null) {
      setCopropietarios((lista) =>
        lista.map((item) =>
          item.id === editando
            ? {
                ...item,
                nombre: nombreCompleto,
                correo: form.correo,
                ci: form.ci,
                telefono: form.telefono,
                departamento:
                  form.departamento.toUpperCase(),
                monto: Number(form.monto),
                estado: form.estado,
              }
            : item
        )
      );
    } else {
      const nuevo: Copropietario = {
        id: Date.now(),
        nombre: nombreCompleto,
        correo: form.correo,
        ci: form.ci,
        telefono: form.telefono,
        departamento:
          form.departamento.toUpperCase(),
        monto: Number(form.monto),
        estado: form.estado,
      };

      setCopropietarios((lista) => [
        ...lista,
        nuevo,
      ]);
    }

    cancelar();
  };

  const editar = (item: Copropietario) => {
    const partes = item.nombre.split(" ");

    setForm({
      nombre: partes.slice(0, 2).join(" "),
      apellidos: partes.slice(2).join(" "),
      ci: item.ci,
      correo: item.correo,
      telefono: item.telefono,
      departamento: item.departamento,
      monto: String(item.monto),
      estado: item.estado,
    });

    setEditando(item.id);
    setMostrarFormulario(true);
  };

  const eliminar = (id: number) => {
    const confirmar = window.confirm(
      "¿Está seguro de eliminar este copropietario?"
    );

    if (!confirmar) return;

    setCopropietarios((lista) =>
      lista.filter((item) => item.id !== id)
    );
  };

  return (
    <DashboardLayout active="copropietarios">

      <div className="min-h-screen bg-[#f6f3ee]">

        <main className="mx-auto max-w-[1180px] px-8 py-7">

          {/* ENCABEZADO */}

          <header className="mb-7 flex items-end justify-between">

            <div>

              <div className="mb-2 flex items-center gap-2">

                <span className="h-[5px] w-[5px] rounded-full bg-[#c83232]" />

                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#c83232]">
                  Administración
                </span>

              </div>

              <h1 className="text-[30px] font-semibold tracking-[-1px] text-[#302d2a]">
                Copropietarios
              </h1>

              <p className="mt-1 text-[10px] text-[#8d8680]">
                Gestiona la información de los propietarios del edificio.
              </p>

            </div>

            <button
              type="button"
              onClick={abrirRegistro}
              className="flex h-[39px] items-center gap-2 rounded-[7px] bg-[#c83232] px-5 text-[10px] font-semibold text-white shadow-[0_5px_14px_rgba(200,50,50,0.16)] transition hover:bg-[#b82d2d]"
            >
              <span className="text-[16px] font-light">
                +
              </span>

              Registrar copropietario
            </button>

          </header>

          {/* MÉTRICAS */}

          <section className="mb-5 grid grid-cols-3 gap-4">

            <MetricCard
              icon={<UsersIcon />}
              title="Total copropietarios"
              value={total.toString()}
            />

            <MetricCard
              icon={<CheckIcon />}
              title="Activos"
              value={activos.toString()}
            />

            <MetricCard
              icon={<MoneyIcon />}
              title="Monto Total Registrado"
              value={`Bs. ${montoTotal.toLocaleString(
                "es-BO",
                {
                  minimumFractionDigits: 2,
                }
              )}`}
            />

          </section>

          {/* TABLA */}

          <section className="overflow-hidden rounded-[11px] border border-[#e4ddd6] bg-white shadow-[0_2px_10px_rgba(43,32,25,0.035)]">

            <div className="flex h-[67px] items-center justify-between border-b border-[#eee9e4] px-5">

              <div>

                <h2 className="text-[12px] font-semibold text-[#383431]">
                  Listado de copropietarios
                </h2>

                <p className="mt-[3px] text-[8px] text-[#a09891]">
                  {filtrados.length} registros encontrados
                </p>

              </div>

              <div className="relative">

                <SearchIcon />

                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) =>
                    setBusqueda(e.target.value)
                  }
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
                    <Th>MONTO (BS.)</Th>
                    <Th>ESTADO</Th>
                    <Th>ACCIONES</Th>

                  </tr>

                </thead>

                <tbody>

                  {filtrados.map((item) => (

                    <tr
                      key={item.id}
                      className="border-t border-[#eee9e4] hover:bg-[#fdfbf9]"
                    >

                      <td className="px-5 py-[13px]">

                        <div className="flex items-center gap-3">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff1ed] text-[#c83232]">
                            <UserIcon />
                          </div>

                          <div>

                            <p className="text-[10px] font-semibold text-[#3d3936]">
                              {item.nombre}
                            </p>

                            <p className="mt-[2px] text-[8px] text-[#a29a94]">
                              {item.correo}
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="px-5 text-[9px] text-[#69625c]">
                        {item.ci}
                      </td>

                      <td className="px-5 text-[9px] text-[#69625c]">
                        {item.telefono}
                      </td>

                      <td className="px-5">

                        <span className="inline-flex rounded-[5px] bg-[#fff0eb] px-[9px] py-[5px] text-[8px] font-bold text-[#c94b3e]">
                          {item.departamento}
                        </span>

                      </td>

                      <td className="px-5 text-[9px] font-medium text-[#69625c]">
                        Bs. {item.monto.toFixed(2)}
                      </td>

                      <td className="px-5">
                        <Estado estado={item.estado} />
                      </td>

                      <td className="px-5">

                        <div className="flex gap-[5px]">

                          <Action
                            title="Editar"
                            onClick={() => editar(item)}
                          >
                            <EditIcon />
                          </Action>

                          <Action
                            title="Eliminar"
                            onClick={() => eliminar(item.id)}
                          >
                            <TrashIcon />
                          </Action>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            {filtrados.length === 0 && (

              <div className="flex flex-col items-center justify-center py-14">

                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0eb] text-[#c83232]">
                  <SearchEmptyIcon />
                </div>

                <p className="text-[10px] font-semibold text-[#514b47]">
                  No se encontraron resultados
                </p>

                <p className="mt-1 text-[8px] text-[#9d958e]">
                  Intenta con otro nombre, CI o departamento.
                </p>

              </div>

            )}

          </section>

        </main>

      </div>

      {/* =====================================================
          MODAL COMPACTO - MISMO TAMAÑO DEL DEPARTAMENTOS
      ====================================================== */}

      {mostrarFormulario && (

        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">

          {/* FONDO */}

          <div
            className="absolute inset-0 backdrop-blur-[1px]"
            onClick={cancelar}
          />

          {/* MODAL */}

          <div className="relative z-10 w-full max-w-[570px] overflow-hidden rounded-[18px] bg-white shadow-[0_20px_55px_rgba(0,0,0,0.20)]">

            {/* LÍNEA ROJA */}

            <div className="h-[3px] bg-[#c83232]" />

            {/* HEADER */}

            <div className="flex items-start justify-between px-8 pb-5 pt-6">

              <div className="flex items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#fff0eb] text-[#c83232]">
                  <UserFormIcon />
                </div>

                <div>

                  <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#c83232]">
                    {editando
                      ? "Editar registro"
                      : "Nuevo registro"}
                  </p>

                  <h2 className="mt-1 text-[19px] font-medium tracking-[-0.4px] text-[#383431]">
                    {editando
                      ? "Editar copropietario"
                      : "Registrar copropietario"}
                  </h2>

                  <p className="mt-1 text-[9px] text-[#938a83]">
                    Ingresa los datos del propietario.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={cancelar}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#918982] hover:bg-[#f7f2ee] hover:text-[#c83232]"
              >
                <CloseIcon />
              </button>

            </div>

            <div className="h-px bg-[#eee8e3]" />

            {/* FORMULARIO */}

            <div className="px-8 py-5">

              {/* DATOS PERSONALES */}

              <div>

                <div className="mb-3 flex items-center gap-2">

                  <span className="h-[6px] w-[6px] rounded-full bg-[#c83232]" />

                  <span className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#68615b]">
                    Información personal
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <Input
                    label="Nombre"
                    required
                    placeholder="Ej. María Fernanda"
                    value={form.nombre}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        nombre: value,
                      })
                    }
                  />

                  <Input
                    label="Apellidos"
                    required
                    placeholder="Ej. Rojas Pérez"
                    value={form.apellidos}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        apellidos: value,
                      })
                    }
                  />

                  <Input
                    label="Número de CI"
                    required
                    placeholder="Ej. 4587210"
                    value={form.ci}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        ci: value,
                      })
                    }
                  />

                  <Input
                    label="Correo electrónico"
                    required
                    placeholder="Ej. maria@email.com"
                    type="email"
                    value={form.correo}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        correo: value,
                      })
                    }
                  />

                  <Input
                    label="Número de teléfono"
                    required
                    placeholder="Ej. 69848860"
                    value={form.telefono}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        telefono: value,
                      })
                    }
                  />

                </div>

              </div>

              {/* SEPARADOR */}

              <div className="my-4 h-px bg-[#eee8e3]" />

              {/* DEPARTAMENTO */}

              <div>

                <div className="mb-3 flex items-center gap-2">

                  <span className="h-[6px] w-[6px] rounded-full bg-[#c83232]" />

                  <span className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#68615b]">
                    Información del departamento
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <Input
                    label="Departamento"
                    required
                    placeholder="Ej. A-101"
                    value={form.departamento}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        departamento: value,
                      })
                    }
                  />

                  <Input
                    label="Monto mensual"
                    required
                    placeholder="Ej. 650"
                    type="number"
                    value={form.monto}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        monto: value,
                      })
                    }
                  />

                </div>

                {/* ESTADO */}

                <div className="mt-3">

                  <label className="mb-1.5 block text-[8px] font-semibold text-[#59524d]">

                    Estado

                    <span className="ml-1 text-[#c83232]">
                      *
                    </span>

                  </label>

                  <div className="flex gap-2">

                    <EstadoButton
                      activo={form.estado === "Activo"}
                      texto="Activo"
                      onClick={() =>
                        setForm({
                          ...form,
                          estado: "Activo",
                        })
                      }
                    />

                    <EstadoButton
                      activo={form.estado === "Inactivo"}
                      texto="Inactivo"
                      onClick={() =>
                        setForm({
                          ...form,
                          estado: "Inactivo",
                        })
                      }
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex items-center justify-between border-t border-[#eee8e3] px-8 py-4">

              <p className="text-[8px] text-[#9b928b]">

                Los campos marcados con{" "}

                <span className="font-semibold text-[#c83232]">
                  *
                </span>{" "}

                son obligatorios.

              </p>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={cancelar}
                  className="h-[36px] rounded-[7px] border border-[#ded6cf] bg-white px-5 text-[9px] font-medium text-[#716963] transition hover:bg-[#f7f3f0]"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={guardar}
                  className="h-[36px] rounded-[7px] bg-[#c83232] px-5 text-[9px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.16)] transition hover:bg-[#b72d2d]"
                >
                  {editando
                    ? "Guardar cambios"
                    : "Registrar copropietario"}
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </DashboardLayout>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function MetricCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex h-[78px] items-center gap-3 rounded-[10px] border border-[#e5ded7] bg-white px-4 shadow-[0_2px_7px_rgba(45,33,25,0.025)]">

      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#fff0eb] text-[#c83232]">
        {icon}
      </div>

      <div>

        <p className="text-[8px] text-[#99918b]">
          {title}
        </p>

        <p className="mt-1 text-[19px] font-bold leading-none text-[#373330]">
          {value}
        </p>

      </div>

    </div>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>

      <label className="mb-1.5 block text-[8px] font-semibold text-[#5a534d]">

        {label}

        {required && (
          <span className="ml-1 text-[#c83232]">
            *
          </span>
        )}

      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="h-[42px] w-full rounded-[9px] border border-[#ddd5ce] bg-white px-3 text-[9px] text-[#49433f] outline-none placeholder:text-[#aaa19a] focus:border-[#c83232] focus:ring-[3px] focus:ring-[#c83232]/10"
      />

    </div>
  );
}

function EstadoButton({
  activo,
  texto,
  onClick,
}: {
  activo: boolean;
  texto: string;
  onClick: () => void;
}) {
  const esActivo = texto === "Activo";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[31px] items-center justify-center gap-1.5 rounded-[7px] px-4 text-[8px] font-semibold transition-all ${
        activo
          ? esActivo
            ? "bg-[#c83232] text-white shadow-[0_3px_8px_rgba(200,50,50,0.18)]"
            : "bg-[#817971] text-white"
          : "border border-[#ddd5ce] bg-white text-[#837a73] hover:bg-[#faf8f6]"
      }`}
    >

      <span
        className={`h-[5px] w-[5px] rounded-full ${
          activo
            ? "bg-white"
            : esActivo
              ? "bg-[#c83232]"
              : "bg-[#968c84]"
        }`}
      />

      {texto}

    </button>
  );
}

function Th({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-[11px] text-left text-[7px] font-bold tracking-[0.08em] text-[#9b938d]">
      {children}
    </th>
  );
}

function Estado({
  estado,
}: {
  estado: Estado;
}) {
  const activo = estado === "Activo";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[7px] font-semibold ${
        activo
          ? "bg-[#eaf4e7] text-[#5b8955]"
          : "bg-[#eeeae7] text-[#817971]"
      }`}
    >

      <span
        className={`h-[5px] w-[5px] rounded-full ${
          activo
            ? "bg-[#6da361]"
            : "bg-[#9a9088]"
        }`}
      />

      {estado}

    </span>
  );
}

function Action({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-[27px] w-[27px] items-center justify-center rounded-[6px] bg-[#faf8f6] text-[#938a83] transition hover:bg-[#fff0eb] hover:text-[#c83232]"
    >
      {children}
    </button>
  );
}

/* =========================================================
   ICONOS
========================================================= */

function UsersIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function UserFormIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa19a]"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function SearchEmptyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
      <path d="M8 10.5h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}