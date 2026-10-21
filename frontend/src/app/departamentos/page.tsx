"use client";

import { useMemo, useState } from "react";

import { DashboardLayout } from "../../../components/DashboardLayout";

type EstadoDepartamento = "Ocupado" | "Disponible";

type Departamento = {
  id: number;
  codigo: string;
  piso: number;
  tipo: string;
  superficie: number;
  ocupante: string;
  expensa: number;
  estado: EstadoDepartamento;
};

type TipoDepartamento = {
  id: number;
  nombre: string;
  expensa: number;
  superficie: number;
  descripcion: string;
  activo: boolean;
};

const departamentosIniciales: Departamento[] = [
  {
    id: 1,
    codigo: "A-101",
    piso: 1,
    tipo: "Grande",
    superficie: 82,
    ocupante: "María F. Rojas",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 2,
    codigo: "A-202",
    piso: 2,
    tipo: "Pequeño",
    superficie: 82,
    ocupante: "Carlos A. Pérez",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 3,
    codigo: "B-301",
    piso: 3,
    tipo: "Grande",
    superficie: 105,
    ocupante: "Sofía V. Cruz",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 4,
    codigo: "B-402",
    piso: 4,
    tipo: "Pequeño",
    superficie: 105,
    ocupante: "Disponible",
    expensa: 650,
    estado: "Disponible",
  },
  {
    id: 5,
    codigo: "A-105",
    piso: 1,
    tipo: "Grande",
    superficie: 210,
    ocupante: "Rodrigo Quispe",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 6,
    codigo: "A-106",
    piso: 2,
    tipo: "Grande",
    superficie: 150,
    ocupante: "Alejandra Guzmán",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 7,
    codigo: "B-202",
    piso: 3,
    tipo: "Pequeño",
    superficie: 250,
    ocupante: "Luz Maida V.",
    expensa: 650,
    estado: "Ocupado",
  },
  {
    id: 8,
    codigo: "B-205",
    piso: 4,
    tipo: "Grande",
    superficie: 300,
    ocupante: "Andrea Lautaro",
    expensa: 650,
    estado: "Disponible",
  },
];

// Lista de personas ya registradas en Copropietarios / Inquilinos.
const personasRegistradas: string[] = [
  "María Fernanda Rojas",
  "Carlos Andrés Pérez",
  "Sofía Valentina Cruz",
  "Melody Gutiérrez",
  "Rodrigo Quispe",
  "Alejandra Guzmán",
  "Ana Lucía Vargas",
  "Diego Mauricio Salazar",
  "Valeria Núñez",
];

const tiposIniciales: TipoDepartamento[] = [
  {
    id: 1,
    nombre: "Pequeño",
    expensa: 450,
    superficie: 82,
    descripcion: "Cuenta con 1 dormitorio",
    activo: true,
  },
  {
    id: 2,
    nombre: "Mediano",
    expensa: 650,
    superficie: 105,
    descripcion: "Cuenta con 2 dormitorios",
    activo: true,
  },
  {
    id: 3,
    nombre: "Grande",
    expensa: 750,
    superficie: 150,
    descripcion: "Cuenta con 3 dormitorios",
    activo: true,
  },
  {
    id: 4,
    nombre: "Penthouse",
    expensa: 950,
    superficie: 250,
    descripcion: "Unidad especial",
    activo: false,
  },
];

export default function DepartamentosPage() {
  const [tab, setTab] = useState<"unidades" | "tipos">("unidades");

  const [departamentos, setDepartamentos] =
    useState<Departamento[]>(departamentosIniciales);

  const [tipos, setTipos] =
    useState<TipoDepartamento[]>(tiposIniciales);

  const [busqueda, setBusqueda] = useState("");

  const [modalDepartamento, setModalDepartamento] =
    useState(false);

  const [modalTipo, setModalTipo] =
    useState(false);

  const [editandoDepartamento, setEditandoDepartamento] =
    useState<Departamento | null>(null);

  const [editandoTipo, setEditandoTipo] =
    useState<TipoDepartamento | null>(null);

  const [formDepartamento, setFormDepartamento] = useState({
    codigo: "",
    piso: "",
    tipo: "",
    estado: "Ocupado" as EstadoDepartamento,
    ocupante: "",
    ocupanteRespaldo: "",
    superficie: "",
  });

  /*
   * NUEVO:
   * El formulario de tipo comienza seleccionando uno de los
   * tipos existentes. Al seleccionarlo se cargan sus datos.
   */
  const [formTipo, setFormTipo] = useState({
    tipoSeleccionado: "",
    nombre: "",
    expensa: "",
    superficie: "",
    descripcion: "",
    activo: true,
  });

  const totalUnidades = departamentos.length;

  const ocupadas = departamentos.filter(
    (d) => d.estado === "Ocupado"
  ).length;

  const disponibles = departamentos.filter(
    (d) => d.estado === "Disponible"
  ).length;

  const superficieTotal = departamentos.reduce(
    (total, d) => total + d.superficie,
    0
  );

  const tiposActivos = tipos.filter((t) => t.activo).length;

  const expensaMinima =
    tipos.length > 0
      ? Math.min(...tipos.map((t) => t.expensa))
      : 0;

  const expensaMaxima =
    tipos.length > 0
      ? Math.max(...tipos.map((t) => t.expensa))
      : 0;

  const departamentosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    if (!texto) return departamentos;

    return departamentos.filter((d) => {
      return (
        d.codigo.toLowerCase().includes(texto) ||
        d.tipo.toLowerCase().includes(texto) ||
        d.ocupante.toLowerCase().includes(texto) ||
        d.estado.toLowerCase().includes(texto) ||
        d.piso.toString().includes(texto)
      );
    });
  }, [busqueda, departamentos]);

  const abrirNuevoDepartamento = () => {
    setEditandoDepartamento(null);

    setFormDepartamento({
      codigo: "",
      piso: "",
      tipo: "",
      estado: "Ocupado",
      ocupante: "",
      ocupanteRespaldo: "",
      superficie: "",
    });

    setModalDepartamento(true);
  };

  const editarDepartamento = (d: Departamento) => {
    setEditandoDepartamento(d);

    const ocupanteReal =
      d.estado === "Disponible" ? "" : d.ocupante;

    setFormDepartamento({
      codigo: d.codigo,
      piso: d.piso.toString(),
      tipo: d.tipo,
      estado: d.estado,
      ocupante: ocupanteReal,
      ocupanteRespaldo: ocupanteReal,
      superficie: d.superficie.toString(),
    });

    setModalDepartamento(true);
  };

  const guardarDepartamento = () => {
    if (
      !formDepartamento.codigo ||
      !formDepartamento.piso ||
      !formDepartamento.tipo ||
      !formDepartamento.superficie
    ) {
      alert("Completa todos los campos obligatorios.");
      return;
    }

    if (
      formDepartamento.estado === "Ocupado" &&
      !formDepartamento.ocupante
    ) {
      alert(
        "Selecciona quién ocupa la unidad, o marca la unidad como Disponible."
      );
      return;
    }

    const existe = departamentos.some(
      (d) =>
        d.codigo.toLowerCase() ===
          formDepartamento.codigo.toLowerCase() &&
        d.id !== editandoDepartamento?.id
    );

    if (existe) {
      alert("Ya existe un departamento con ese código.");
      return;
    }

    const departamento: Departamento = {
      id: editandoDepartamento?.id ?? Date.now(),
      codigo: formDepartamento.codigo.toUpperCase(),
      piso: Number(formDepartamento.piso),
      tipo: formDepartamento.tipo,
      superficie: Number(formDepartamento.superficie),

      ocupante:
        formDepartamento.estado === "Disponible"
          ? "Disponible"
          : formDepartamento.ocupante || "Sin ocupante",

      /*
       * Se conserva el comportamiento actual de los datos.
       * La lógica de selección de tipos del nuevo formulario
       * no modifica los departamentos ya registrados.
       */
      expensa: 650,

      estado: formDepartamento.estado,
    };

    if (editandoDepartamento) {
      setDepartamentos((actuales) =>
        actuales.map((d) =>
          d.id === editandoDepartamento.id ? departamento : d
        )
      );

      alert(
        "Los datos del departamento se actualizaron correctamente."
      );
    } else {
      setDepartamentos((actuales) => [
        ...actuales,
        departamento,
      ]);

      alert("El departamento se registró correctamente.");
    }

    setModalDepartamento(false);
    setEditandoDepartamento(null);
  };

  const eliminarDepartamento = (id: number) => {
    if (
      !window.confirm(
        "¿Deseas eliminar este departamento?"
      )
    ) {
      return;
    }

    setDepartamentos((actuales) =>
      actuales.filter((d) => d.id !== id)
    );

    alert("El departamento se eliminó correctamente.");
  };

  /*
   * ============================================================
   * TIPOS DE DEPARTAMENTO
   * ============================================================
   */

  const abrirNuevoTipo = () => {
    setEditandoTipo(null);

    setFormTipo({
      tipoSeleccionado: "",
      nombre: "",
      expensa: "",
      superficie: "",
      descripcion: "",
      activo: true,
    });

    setModalTipo(true);
  };

  const editarTipo = (tipo: TipoDepartamento) => {
    setEditandoTipo(tipo);

    setFormTipo({
      tipoSeleccionado: tipo.nombre,
      nombre: tipo.nombre,
      expensa: tipo.expensa.toString(),
      superficie: tipo.superficie.toString(),
      descripcion: tipo.descripcion,
      activo: tipo.activo,
    });

    setModalTipo(true);
  };

  /*
   * Al guardar NO se crea un nuevo tipo.
   * Se actualiza el tipo seleccionado.
   * Esto evita duplicar "Pequeño", "Mediano", etc.
   */
  const guardarTipo = () => {
    if (
      !formTipo.tipoSeleccionado ||
      !formTipo.expensa ||
      !formTipo.superficie
    ) {
      alert(
        "Selecciona un tipo y completa todos los campos obligatorios."
      );
      return;
    }

    const tipoSeleccionado = tipos.find(
      (tipo) =>
        tipo.nombre === formTipo.tipoSeleccionado
    );

    if (!tipoSeleccionado) {
      alert("El tipo seleccionado no es válido.");
      return;
    }

    const tipoActualizado: TipoDepartamento = {
      id: tipoSeleccionado.id,
      nombre: tipoSeleccionado.nombre,
      expensa: Number(formTipo.expensa),
      superficie: Number(formTipo.superficie),
      descripcion:
        formTipo.descripcion || "Sin descripción",
      activo: formTipo.activo,
    };

    setTipos((actuales) =>
      actuales.map((tipo) =>
        tipo.id === tipoSeleccionado.id
          ? tipoActualizado
          : tipo
      )
    );

    setModalTipo(false);
    setEditandoTipo(null);

    alert(
      `El tipo "${tipoSeleccionado.nombre}" se actualizó correctamente.`
    );
  };

  const eliminarTipo = (id: number) => {
    const tipoEncontrado = tipos.find(
      (tipo) => tipo.id === id
    );

    const enUso = departamentos.some(
      (d) => d.tipo === tipoEncontrado?.nombre
    );

    if (enUso) {
      alert(
        "No se puede eliminar: hay departamentos usando este tipo. Márcalo como Inactivo en su lugar."
      );
      return;
    }

    if (
      !window.confirm(
        "¿Deseas eliminar este tipo de departamento?"
      )
    ) {
      return;
    }

    setTipos((actuales) =>
      actuales.filter((tipo) => tipo.id !== id)
    );

    alert(
      "El tipo de departamento se eliminó correctamente."
    );
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
                Administra las unidades habitacionales,
                sus tipos y la expensa de cada una.
              </p>
            </div>

            <button
              onClick={
                tab === "unidades"
                  ? abrirNuevoDepartamento
                  : abrirNuevoTipo
              }
              className="flex h-10 items-center gap-2 rounded-lg bg-[#c93232] px-5 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(201,50,50,0.18)] transition hover:-translate-y-[1px] hover:bg-[#b82b2b]"
            >
              <span className="text-[17px] font-light">
                +
              </span>

              {tab === "unidades"
                ? "Registrar departamento"
                : "Registrar tipo"}
            </button>
          </div>

          {/* ESTADÍSTICAS */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            {tab === "unidades" ? (
              <>
                <StatCard
                  icon={<BuildingIcon />}
                  title="Total unidades"
                  value={totalUnidades.toString()}
                />

                <StatCard
                  icon={<HomeIcon />}
                  title="Ocupadas"
                  value={ocupadas.toString()}
                />

                <StatCard
                  icon={<CheckIcon />}
                  title="Disponibles"
                  value={disponibles.toString()}
                />

                <StatCard
                  icon={<RulerIcon />}
                  title="Superficie total"
                  value={`${superficieTotal.toLocaleString(
                    "es-BO"
                  )} m²`}
                />
              </>
            ) : (
              <>
                <StatCard
                  icon={<BuildingIcon />}
                  title="Total unidades"
                  value={totalUnidades.toString()}
                />

                <StatCard
                  icon={<TagIcon />}
                  title="Tipos activos"
                  value={tiposActivos.toString()}
                />

                <StatCard
                  icon={<MoneyIcon />}
                  title="Expensa mínima"
                  value={`Bs. ${expensaMinima}`}
                />

                <StatCard
                  icon={<MoneyIcon />}
                  title="Expensa máxima"
                  value={`Bs. ${expensaMaxima}`}
                />
              </>
            )}
          </div>

          {/* TABS */}
          <div className="mb-4 flex gap-7 border-b border-[#e6dfd8]">
            <TabButton
              active={tab === "unidades"}
              onClick={() => setTab("unidades")}
            >
              Unidades
            </TabButton>

            <TabButton
              active={tab === "tipos"}
              onClick={() => setTab("tipos")}
            >
              Tipos y Expensas
            </TabButton>
          </div>

          {/* ==================================================
              UNIDADES
          ================================================== */}

          {tab === "unidades" && (
            <div className="overflow-hidden rounded-xl border border-[#e7e0d9] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.035)]">

              <div className="flex items-center justify-between border-b border-[#eee9e4] px-5 py-4">
                <div>
                  <h2 className="text-[13px] font-bold text-[#36322f]">
                    Unidades del edificio
                  </h2>

                  <p className="mt-1 text-[9px] text-[#99918b]">
                    {departamentosFiltrados.length} departamentos encontrados
                  </p>
                </div>

                <SearchInput
                  value={busqueda}
                  onChange={setBusqueda}
                  placeholder="Buscar por número, piso o estado..."
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fbfaf8]">
                      <HeaderCell>DEPARTAMENTO</HeaderCell>
                      <HeaderCell>PISO</HeaderCell>
                      <HeaderCell>TIPO</HeaderCell>
                      <HeaderCell>SUPERFICIE</HeaderCell>
                      <HeaderCell>OCUPANTE</HeaderCell>
                      <HeaderCell>EXPENSA</HeaderCell>
                      <HeaderCell>ESTADO</HeaderCell>
                      <HeaderCell>ACCIONES</HeaderCell>
                    </tr>
                  </thead>

                  <tbody>
                    {departamentosFiltrados.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-[#eeeae6] transition hover:bg-[#fdfbf9]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#fff0eb] text-[#c83232]">
                              <BuildingIcon />
                            </div>

                            <span className="text-[10px] font-bold text-[#3b3734]">
                              {d.codigo}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-[10px] text-[#68615c]">
                          {d.piso}
                        </td>

                        <td className="px-5 py-4 text-[10px] text-[#68615c]">
                          {d.tipo}
                        </td>

                        <td className="px-5 py-4 text-[10px] text-[#68615c]">
                          {d.superficie} m²
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1ece7] text-[8px] font-bold text-[#746c66]">
                              {d.ocupante === "Disponible"
                                ? "—"
                                : d.ocupante.charAt(0)}
                            </div>

                            <span className="text-[10px] text-[#68615c]">
                              {d.ocupante}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-[10px] font-medium text-[#5d5752]">
                          Bs. {d.expensa}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge estado={d.estado} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex gap-1.5">
                            <IconButton
                              title="Editar"
                              onClick={() =>
                                editarDepartamento(d)
                              }
                            >
                              <EditIcon />
                            </IconButton>

                            <IconButton
                              title="Eliminar"
                              danger
                              onClick={() =>
                                eliminarDepartamento(d.id)
                              }
                            >
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {departamentosFiltrados.length === 0 && (
                <EmptyState texto="No se encontraron departamentos." />
              )}
            </div>
          )}

          {/* ==================================================
              TIPOS
          ================================================== */}

          {tab === "tipos" && (
            <div className="overflow-hidden rounded-xl border border-[#e7e0d9] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.035)]">

              <div className="flex items-center justify-between border-b border-[#eee9e4] px-5 py-4">
                <div>
                  <h2 className="text-[13px] font-bold text-[#36322f]">
                    Tipos de departamento
                  </h2>

                  <p className="mt-1 text-[9px] text-[#99918b]">
                    Configuración de tipos y expensas mensuales
                  </p>
                </div>

                <div className="relative">
                  <SearchIcon />

                  <input
                    placeholder="Buscar por nombre..."
                    className="h-9 w-[220px] rounded-lg border border-[#e5ded7] pl-8 pr-3 text-[9px] outline-none focus:border-[#d1a19b]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fbfaf8]">
                      <HeaderCell>TIPO</HeaderCell>
                      <HeaderCell>EXPENSA MENSUAL</HeaderCell>
                      <HeaderCell>SUPERFICIE</HeaderCell>
                      <HeaderCell>DESCRIPCIÓN</HeaderCell>
                      <HeaderCell>ESTADO</HeaderCell>
                      <HeaderCell>ACCIONES</HeaderCell>
                    </tr>
                  </thead>

                  <tbody>
                    {tipos.map((tipo) => (
                      <tr
                        key={tipo.id}
                        className="border-t border-[#eeeae6] transition hover:bg-[#fdfbf9]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0eb] text-[#c83232]">
                              <TagIcon />
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-[#3b3734]">
                                {tipo.nombre}
                              </p>

                              <p className="mt-0.5 text-[8px] text-[#a19a94]">
                                Tipo de unidad
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-[10px] font-semibold text-[#57514c]">
                          Bs. {tipo.expensa}
                        </td>

                        <td className="px-5 py-4 text-[10px] text-[#68615c]">
                          {tipo.superficie} m²
                        </td>

                        <td className="px-5 py-4 text-[10px] text-[#68615c]">
                          {tipo.descripcion}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-semibold ${
                              tipo.activo
                                ? "bg-[#eaf4e7] text-[#5d8a57]"
                                : "bg-[#eeeae7] text-[#837b75]"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                tipo.activo
                                  ? "bg-[#70a566]"
                                  : "bg-[#9a9089]"
                              }`}
                            />

                            {tipo.activo
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex gap-1.5">
                            <IconButton
                              title="Editar"
                              onClick={() =>
                                editarTipo(tipo)
                              }
                            >
                              <EditIcon />
                            </IconButton>

                            <IconButton
                              title="Eliminar"
                              danger
                              onClick={() =>
                                eliminarTipo(tipo.id)
                              }
                            >
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* ==================================================
            MODAL DEPARTAMENTO
        ================================================== */}

        {modalDepartamento && (
          <ModalOverlay>
            <div className="w-full max-w-[570px] overflow-hidden rounded-[18px] border border-[#e4dcd5] bg-white shadow-[0_30px_90px_rgba(38,29,24,0.25)]">

              {/* CABECERA */}
              <div className="relative border-b border-[#eee8e2] px-8 pb-6 pt-7">
                <div className="absolute left-0 top-0 h-[3px] w-full bg-[#c83232]" />

                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0eb] text-[#c83232]">
                      <BuildingIcon />
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#c83232]">
                        {editandoDepartamento
                          ? "Edición"
                          : "Nuevo registro"}
                      </p>

                      <h2 className="mt-1 text-[20px] font-bold tracking-[-0.4px] text-[#302d2b]">
                        {editandoDepartamento
                          ? "Editar departamento"
                          : "Registrar departamento"}
                      </h2>

                      <p className="mt-1 text-[10px] text-[#948c86]">
                        Ingresa los datos de la unidad habitacional.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setModalDepartamento(false)
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#948c86] transition hover:bg-[#f7f2ee] hover:text-[#3e3935]"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* FORMULARIO */}
              <div className="px-8 py-7">
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c83232]" />

                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#665e58]">
                      Información de la unidad
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-5">

                    <ElegantInput
                      label="Número / código"
                      required
                      placeholder="Ej. A-103"
                      value={formDepartamento.codigo}
                      onChange={(value) =>
                        setFormDepartamento({
                          ...formDepartamento,
                          codigo: value,
                        })
                      }
                    />

                    <ElegantInput
                      label="Piso"
                      required
                      placeholder="Ej. 1"
                      type="number"
                      value={formDepartamento.piso}
                      onChange={(value) =>
                        setFormDepartamento({
                          ...formDepartamento,
                          piso: value,
                        })
                      }
                    />

                    <ElegantSelect
                      label="Tipo de departamento"
                      required
                      value={formDepartamento.tipo}
                      placeholder="Seleccionar tipo"
                      options={tipos
                        .filter(
                          (t) =>
                            t.activo ||
                            t.nombre ===
                              formDepartamento.tipo
                        )
                        .map((t) => t.nombre)}
                      onChange={(value) =>
                        setFormDepartamento({
                          ...formDepartamento,
                          tipo: value,
                        })
                      }
                    />

                    <ElegantSelect
                      label="Estado de ocupación"
                      required
                      value={formDepartamento.estado}
                      options={[
                        "Ocupado",
                        "Disponible",
                      ]}
                      onChange={(value) => {
                        const nuevoEstado =
                          value as EstadoDepartamento;

                        if (
                          nuevoEstado === "Disponible"
                        ) {
                          setFormDepartamento({
                            ...formDepartamento,
                            estado: nuevoEstado,
                            ocupanteRespaldo:
                              formDepartamento.ocupante ||
                              formDepartamento.ocupanteRespaldo,
                            ocupante: "",
                          });
                        } else {
                          setFormDepartamento({
                            ...formDepartamento,
                            estado: nuevoEstado,
                            ocupante:
                              formDepartamento.ocupante ||
                              formDepartamento.ocupanteRespaldo,
                          });
                        }
                      }}
                    />

                    <ElegantSelect
                      label="Propietario / ocupante"
                      required={
                        formDepartamento.estado ===
                        "Ocupado"
                      }
                      disabled={
                        formDepartamento.estado ===
                        "Disponible"
                      }
                      placeholder={
                        formDepartamento.estado ===
                        "Disponible"
                          ? "No aplica: unidad disponible"
                          : "Seleccionar persona registrada"
                      }
                      value={formDepartamento.ocupante}
                      options={personasRegistradas}
                      onChange={(value) =>
                        setFormDepartamento({
                          ...formDepartamento,
                          ocupante: value,
                        })
                      }
                    />

                    <ElegantInput
                      label="Superficie"
                      required
                      placeholder="Ej. 85"
                      type="number"
                      value={formDepartamento.superficie}
                      suffix="m²"
                      onChange={(value) =>
                        setFormDepartamento({
                          ...formDepartamento,
                          superficie: value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[#eee5df] bg-[#fcfaf8] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-[#c83232]">
                      <InfoIcon />
                    </div>

                    <div>
                      <p className="text-[9px] font-semibold text-[#5b544f]">
                        Información importante
                      </p>

                      <p className="mt-1 text-[9px] leading-4 text-[#99908a]">
                        El código del departamento debe ser único
                        dentro del edificio.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex items-center justify-between border-t border-[#eee8e2] bg-[#fcfaf8] px-8 py-4">
                <span className="text-[9px] text-[#a09891]">
                  Los campos marcados son obligatorios
                </span>

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setModalDepartamento(false)
                    }
                    className="h-9 rounded-lg border border-[#e5dbd3] bg-white px-5 text-[10px] font-semibold text-[#756d67] transition hover:bg-[#f8f3ef]"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={guardarDepartamento}
                    className="h-9 rounded-lg bg-[#c83232] px-6 text-[10px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.2)] transition hover:bg-[#b72b2b]"
                  >
                    {editandoDepartamento
                      ? "Guardar cambios"
                      : "Registrar departamento"}
                  </button>
                </div>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* ==================================================
            MODAL TIPO
        ================================================== */}

        {modalTipo && (
          <ModalOverlay>
            <div className="w-full max-w-[570px] overflow-hidden rounded-[18px] border border-[#e4dcd5] bg-white shadow-[0_30px_90px_rgba(38,29,24,0.25)]">

              {/* CABECERA */}
              <div className="relative border-b border-[#eee8e2] px-8 pb-6 pt-7">
                <div className="absolute left-0 top-0 h-[3px] w-full bg-[#c83232]" />

                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0eb] text-[#c83232]">
                      <TagIcon />
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#c83232]">
                        {editandoTipo
                          ? "Edición"
                          : "Configuración"}
                      </p>

                      <h2 className="mt-1 text-[20px] font-bold tracking-[-0.4px] text-[#302d2b]">
                        {editandoTipo
                          ? "Editar tipo de departamento"
                          : "Registrar tipo de departamento"}
                      </h2>

                      <p className="mt-1 text-[10px] text-[#948c86]">
                        Selecciona el tipo y configura sus características y expensa mensual.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalTipo(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#948c86] transition hover:bg-[#f7f2ee]"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* FORMULARIO */}
              <div className="px-8 py-7">
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c83232]" />

                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#665e58]">
                      Características del tipo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-5">

                    {/* NUEVO SELECTOR */}
                    <div className="col-span-2">
                      <ElegantSelect
                        label="Tipo de departamento"
                        required
                        value={formTipo.tipoSeleccionado}
                        placeholder="Seleccionar tipo de departamento"
                        options={tipos.map(
                          (tipo) => tipo.nombre
                        )}
                        onChange={(value) => {
                          const tipoSeleccionado =
                            tipos.find(
                              (tipo) =>
                                tipo.nombre === value
                            );

                          if (!tipoSeleccionado) {
                            setFormTipo({
                              ...formTipo,
                              tipoSeleccionado: "",
                              nombre: "",
                              expensa: "",
                              superficie: "",
                              descripcion: "",
                            });

                            return;
                          }

                          setFormTipo({
                            ...formTipo,
                            tipoSeleccionado:
                              tipoSeleccionado.nombre,
                            nombre:
                              tipoSeleccionado.nombre,
                            expensa:
                              tipoSeleccionado.expensa.toString(),
                            superficie:
                              tipoSeleccionado.superficie.toString(),
                            descripcion:
                              tipoSeleccionado.descripcion,
                            activo:
                              tipoSeleccionado.activo,
                          });
                        }}
                      />
                    </div>

                    <ElegantInput
                      label="Expensa mensual"
                      required
                      placeholder="Ej. 450"
                      type="number"
                      prefix="Bs."
                      value={formTipo.expensa}
                      onChange={(value) =>
                        setFormTipo({
                          ...formTipo,
                          expensa: value,
                        })
                      }
                    />

                    <ElegantInput
                      label="Superficie"
                      required
                      placeholder="Ej. 120"
                      type="number"
                      suffix="m²"
                      value={formTipo.superficie}
                      onChange={(value) =>
                        setFormTipo({
                          ...formTipo,
                          superficie: value,
                        })
                      }
                    />

                    <div className="col-span-2">
                      <ElegantInput
                        label="Descripción"
                        placeholder="Ej. Cuenta con 2 dormitorios"
                        value={formTipo.descripcion}
                        onChange={(value) =>
                          setFormTipo({
                            ...formTipo,
                            descripcion: value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* ESTADO */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c83232]" />

                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#665e58]">
                      Estado del tipo
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setFormTipo({
                          ...formTipo,
                          activo: true,
                        })
                      }
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[9px] font-semibold transition ${
                        formTipo.activo
                          ? "border-[#efc7bc] bg-[#fff1ed] text-[#c83232]"
                          : "border-[#e5ddd7] bg-white text-[#938b84]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      Activo
                    </button>

                    <button
                      onClick={() =>
                        setFormTipo({
                          ...formTipo,
                          activo: false,
                        })
                      }
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[9px] font-semibold transition ${
                        !formTipo.activo
                          ? "border-[#d9d0c9] bg-[#f0ece9] text-[#716963]"
                          : "border-[#e5ddd7] bg-white text-[#938b84]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      Inactivo
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex justify-end gap-3 border-t border-[#eee8e2] bg-[#fcfaf8] px-8 py-4">
                <button
                  onClick={() => setModalTipo(false)}
                  className="h-9 rounded-lg border border-[#e5dbd3] bg-white px-5 text-[10px] font-semibold text-[#756d67] transition hover:bg-[#f8f3ef]"
                >
                  Cancelar
                </button>

                <button
                  onClick={guardarTipo}
                  disabled={!formTipo.tipoSeleccionado}
                  className="h-9 rounded-lg bg-[#c83232] px-6 text-[10px] font-semibold text-white shadow-[0_4px_10px_rgba(200,50,50,0.2)] transition hover:bg-[#b72b2b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editandoTipo
                    ? "Guardar cambios"
                    : "Guardar configuración"}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ============================================================
   COMPONENTES
============================================================ */

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="group flex h-[82px] items-center gap-3 rounded-xl border border-[#e7e0d9] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.025)] transition hover:-translate-y-[1px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0eb] text-[#c83232] transition group-hover:bg-[#c83232] group-hover:text-white">
        {icon}
      </div>

      <div>
        <p className="text-[9px] text-[#99918b]">
          {title}
        </p>

        <p className="mt-1 text-[20px] font-bold leading-none text-[#36322f]">
          {value}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-2.5 text-[10px] font-bold transition ${
        active
          ? "text-[#c83232]"
          : "text-[#8d8580]"
      }`}
    >
      {children}

      {active && (
        <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#c83232]" />
      )}
    </button>
  );
}

function HeaderCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-left text-[8px] font-bold tracking-[0.06em] text-[#9b938d]">
      {children}
    </th>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
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

function ElegantInput({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
  required = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  prefix?: string;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[9px] font-semibold text-[#514b46]">
        {label}

        {required && (
          <span className="ml-1 text-[#c83232]">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-medium text-[#8c837c]">
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-[42px] w-full rounded-[9px] border border-[#ded6cf] bg-[#fffdfc] text-[10px] text-[#3f3a36] shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)] outline-none transition placeholder:text-[#aaa19a] hover:border-[#d2c8c0] focus:border-[#c83232] focus:bg-white focus:ring-[3px] focus:ring-[#c83232]/10 ${
            prefix ? "pl-10 pr-3" : "px-3"
          } ${suffix ? "pr-10" : ""}`}
        />

        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-medium text-[#8c837c]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ElegantSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[9px] font-semibold text-[#514b46]">
        {label}

        {required && (
          <span className="ml-1 text-[#c83232]">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-[42px] w-full appearance-none rounded-[9px] border border-[#ded6cf] bg-[#fffdfc] px-3 pr-9 text-[10px] text-[#4d4742] shadow-[inset_0_1px_2px_rgba(0,0,0,0.015)] outline-none transition hover:border-[#d2c8c0] focus:border-[#c83232] focus:bg-white focus:ring-[3px] focus:ring-[#c83232]/10 ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : ""
          }`}
        >
          {placeholder && (
            <option value="">
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8f867f]">
          <ChevronIcon />
        </span>
      </div>
    </div>
  );
}

function IconButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        danger
          ? "bg-[#faf8f6] text-[#958b84] hover:bg-[#fff0eb] hover:text-[#c83232]"
          : "bg-[#faf8f6] text-[#958b84] hover:bg-[#f1ece8] hover:text-[#4f4945]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  estado,
}: {
  estado: EstadoDepartamento;
}) {
  const ocupado = estado === "Ocupado";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-semibold ${
        ocupado
          ? "bg-[#eaf4e7] text-[#5c8956]"
          : "bg-[#fff0eb] text-[#c56a50]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ocupado
            ? "bg-[#70a566]"
            : "bg-[#e77c5d]"
        }`}
      />

      {estado}
    </span>
  );
}

function EmptyState({
  texto,
}: {
  texto: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0eb] text-[#c83232]">
        <BuildingIcon />
      </div>

      <p className="text-[11px] font-semibold text-[#514b47]">
        Sin resultados
      </p>

      <p className="mt-1 text-[9px] text-[#99918b]">
        {texto}
      </p>
    </div>
  );
}

function ModalOverlay({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241d19]/50 p-5 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

/* ============================================================
   ICONOS
============================================================ */

function BuildingIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M2 21h20" />
      <path d="M8 7h2M12 7h2M8 11h2M12 11h2M8 15h2M12 15h2" />
      <path d="M18 21V9h2a2 2 0 0 1 2 2v10" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m3 21 18-18" />
      <path d="m5 17 2 2M8 14l2 2M11 11l2 2M14 8l2 2M17 5l2 2" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M20 13 13 20a2 2 0 0 1-3 0l-6-6a2 2 0 0 1 0-3l7-7h6a2 2 0 0 1 2 2v6Z" />
      <circle cx="16" cy="8" r="1" />
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
      width="13"
      height="13"
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

function EditIcon() {
  return (
    <svg
      width="13"
      height="13"
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
      width="13"
      height="13"
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
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}