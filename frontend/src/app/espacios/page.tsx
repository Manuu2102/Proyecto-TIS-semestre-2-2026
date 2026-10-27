"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { PlusIcon, BuildingIcon, EditIcon, TrashIcon } from "../../../components/Icons";
import { Modal } from "../../../components/Modal";

type Tipo = "Parqueo" | "Baulera";

type Espacio = {
  id: string;
  tipo: Tipo;
  identificador: string;
  piso: number;
  discapacitados: boolean;
  idDepartamento: string;
  departamento: string;
  estado: "Asignado" | "Disponible";
};

type EspacioAPI = {
  id: string;
  tipo: "parqueo" | "baulera";
  identificador: string;
  piso: number;
  discapacitados?: boolean;
  id_departamento: string | null;
  departamento: string | null;
};

type DepartamentoOpcion = {
  id: string;
  codigo: string;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const getToken = () => sessionStorage.getItem("token") ?? "";

const SIN_ASIGNAR = "—";

// Ruta de la API según el tipo
const RUTA: Record<Tipo, string> = { Parqueo: "parqueos", Baulera: "bauleras" };

const adaptar = (e: EspacioAPI): Espacio => ({
  id: e.id,
  tipo: e.tipo === "parqueo" ? "Parqueo" : "Baulera",
  identificador: e.identificador,
  piso: e.piso,
  discapacitados: e.discapacitados ?? false,
  idDepartamento: e.id_departamento ?? SIN_ASIGNAR,
  departamento: e.departamento ?? SIN_ASIGNAR,
  estado: e.id_departamento ? "Asignado" : "Disponible",
});

const mensajeDeError = (data: ApiErrorResponse) =>
  (Array.isArray(data.message) ? data.message.join(" ") : data.message) ??
  "No se pudo completar la acción.";

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    const data: ApiErrorResponse = await res.json().catch(() => ({}));
    throw new Error(mensajeDeError(data));
  }
  return res.json();
}

export default function Espacios() {
  const [items, setItems] = useState<Espacio[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoOpcion[]>([]);

  const [open, setOpen] = useState(false);

  // Espacio que se está editando (null = registrando uno nuevo)
  const [editando, setEditando] = useState<Espacio | null>(null);

  const [tipo, setTipo] =
    useState<Tipo>("Parqueo");

  const [identificador, setIdentificador] = useState("");

  const [piso, setPiso] = useState("");

  const [discapacitados, setDiscapacitados] = useState(false);

  const [departamento, setDepartamento] = useState(SIN_ASIGNAR);

  const [error, setError] = useState("");

  const [guardando, setGuardando] = useState(false);

  const recargar = async () => {
    const [dataEsp, dataDep]: [
      { espacios: EspacioAPI[] },
      { departamentos: { id: string; numeroCompleto: string }[] },
    ] = await Promise.all([pedir("/espacios"), pedir("/departamentos")]);

    setItems(dataEsp.espacios.map(adaptar));
    setDepartamentos(
      dataDep.departamentos.map((d) => ({ id: String(d.id), codigo: d.numeroCompleto }))
    );
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        await recargar();
      } catch (e) {
        console.error("Error cargando espacios:", e);
      }
    };
    cargar();
  }, []);

  function limpiar() {
    setEditando(null);
    setIdentificador("");
    setPiso("");
    setDiscapacitados(false);
    setDepartamento(SIN_ASIGNAR);
    setTipo("Parqueo");
    setError("");
  }

  function abrirFormulario() {
    limpiar();
    setOpen(true);
  }

  function abrirEdicion(espacio: Espacio) {
    setEditando(espacio);
    setTipo(espacio.tipo);
    setIdentificador(espacio.identificador);
    setPiso(String(espacio.piso));
    setDiscapacitados(espacio.discapacitados);
    setDepartamento(espacio.idDepartamento);
    setError("");
    setOpen(true);
  }

  function cerrarFormulario() {
    setOpen(false);
    limpiar();
  }

  async function registrarEspacio() {
    const id = identificador.trim().toUpperCase();

    setError("");

    // Validar que exista un identificador
    if (!id) {
      setError(
        "Ingresa un identificador para el espacio."
      );
      return;
    }

    // Validar formato para parqueos
    if (
      tipo === "Parqueo" &&
      !id.startsWith("P-")
    ) {
      setError(
        "Los parqueos deben tener un identificador que empiece con P-."
      );
      return;
    }

    // Validar formato para bauleras
    if (
      tipo === "Baulera" &&
      !id.startsWith("B-")
    ) {
      setError(
        "Las bauleras deben tener un identificador que empiece con B-."
      );
      return;
    }

    // En la base el identificador es un número: "P-14" → 14
    const numero = Number(id.slice(2));
    if (!Number.isInteger(numero) || numero < 1) {
      setError(
        "Después de P- o B- debe ir un número, por ejemplo P-16."
      );
      return;
    }

    if (piso.trim() === "" || !Number.isInteger(Number(piso))) {
      setError("Ingresa el piso del espacio (puede ser negativo para subsuelos).");
      return;
    }

    // Verificar que el identificador sea único
    const existe = items.some(
      (item) =>
        item.identificador.toUpperCase() === id &&
        item.tipo === tipo &&
        item.id !== editando?.id
    );

    if (existe) {
      setError(
        "El identificador ya existe. Usa uno diferente."
      );
      return;
    }

    const body = {
      numero,
      piso: Number(piso),
      ...(tipo === "Parqueo" && { discapacitados }),
      id_departamento: departamento === SIN_ASIGNAR ? null : Number(departamento),
    };

    try {
      setGuardando(true);
      await pedir(
        editando
          ? `/espacios/${RUTA[tipo]}/${editando.id}`
          : `/espacios/${RUTA[tipo]}`,
        {
          method: editando ? "PATCH" : "POST",
          body: JSON.stringify(body),
        }
      );

      await recargar();
      setOpen(false);
      limpiar();

      // Mostrar mensaje emergente del navegador
      alert(
        editando
          ? "El espacio se actualizó correctamente."
          : "El espacio se registró correctamente."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarEspacio(espacio: Espacio) {
    const confirmar = window.confirm(
      `¿Eliminar el ${espacio.tipo.toLowerCase()} ${espacio.identificador}? Se quitará también su asignación.`
    );
    if (!confirmar) return;

    try {
      await pedir(`/espacios/${RUTA[espacio.tipo]}/${espacio.id}`, { method: "DELETE" });
      await recargar();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <DashboardLayout active="espacios">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            EP-01 · UNIDADES
          </p>

          <h1>Parqueos y bauleras</h1>

          <p>
            Registra espacios con identificador único
            y controla su asignación.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={abrirFormulario}
        >
          <PlusIcon size={17} />
          Registrar espacio
        </button>
      </div>

      {/* MÉTRICAS */}
      <div className="metric-row">
        <Metric
          t="Espacios"
          n={items.length}
        />

        <Metric
          t="Asignados"
          n={
            items.filter(
              (x) => x.estado === "Asignado"
            ).length
          }
        />

        <Metric
          t="Disponibles"
          n={
            items.filter(
              (x) => x.estado === "Disponible"
            ).length
          }
        />
      </div>

      {/* INVENTARIO */}
      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>
              Inventario de espacios
            </h3>

            <p>
              Cada espacio solo puede estar asignado
              a un departamento.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Tipo</th>
                <th>Departamento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {items.map((x) => (
                <tr key={`${x.tipo}-${x.id}`}>
                  <td>
                    <strong>{x.identificador}</strong>
                    <small>
                      Piso {x.piso}
                      {x.discapacitados ? " · Discapacitados" : ""}
                    </small>
                  </td>

                  <td>{x.tipo}</td>

                  <td>
                    <span className="tag">
                      {x.departamento}
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        x.estado === "Asignado"
                          ? "status status-success"
                          : "status status-attention"
                      }
                    >
                      <span />
                      {x.estado}
                    </span>
                  </td>

                  <td>
                    <div className="row-actions">
                      <button className="icon-action" onClick={() => abrirEdicion(x)} title="Editar">
                        <EditIcon size={16} />
                      </button>
                      <button className="icon-action danger" onClick={() => eliminarEspacio(x)} title="Eliminar">
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "30px" }}>
                    No hay espacios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FORMULARIO DE REGISTRO */}
      <Modal
        open={open}
        title={editando ? "Editar espacio" : "Registrar espacio"}
        onClose={cerrarFormulario}
      >
        <div className="modal-form">

          {/* MENSAJE DE ERROR */}
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
              }}
            >
              {error}
            </div>
          )}

          <div className="form-grid">

            {/* TIPO DE ESPACIO (no se cambia al editar) */}
            <label className="field">
              <span>
                Tipo de espacio
              </span>

              <select
                value={tipo}
                disabled={!!editando}
                onChange={(e) =>
                  setTipo(
                    e.target.value as Tipo
                  )
                }
              >
                <option value="Parqueo">
                  Parqueo
                </option>

                <option value="Baulera">
                  Baulera
                </option>
              </select>
            </label>

            {/* IDENTIFICADOR */}
            <label className="field">
              <span>
                Identificador único
              </span>

              <input
                type="text"
                value={identificador}
                onChange={(e) =>
                  setIdentificador(
                    e.target.value.toUpperCase()
                  )
                }
                placeholder={
                  tipo === "Parqueo"
                    ? "Ej. P-16"
                    : "Ej. B-10"
                }
              />

              <small>
                {tipo === "Parqueo"
                  ? "El identificador debe comenzar con P-."
                  : "El identificador debe comenzar con B-."}
              </small>
            </label>

            {/* PISO */}
            <label className="field">
              <span>
                Piso
              </span>

              <input
                type="number"
                value={piso}
                onChange={(e) => setPiso(e.target.value)}
                placeholder="Ej. -1"
              />
            </label>

            {/* DISCAPACITADOS (solo parqueos) */}
            {tipo === "Parqueo" && (
              <label className="field">
                <span>
                  Para personas con discapacidad
                </span>

                <select
                  value={discapacitados ? "si" : "no"}
                  onChange={(e) => setDiscapacitados(e.target.value === "si")}
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </label>
            )}

            {/* DEPARTAMENTO */}
            <label className="field">
              <span>
                Asociar a departamento
              </span>

              <select
                value={departamento}
                onChange={(e) =>
                  setDepartamento(
                    e.target.value
                  )
                }
              >
                <option value={SIN_ASIGNAR}>
                  Sin asignar
                </option>

                {departamentos.map(
                  (dep) => (
                    <option
                      key={dep.id}
                      value={dep.id}
                    >
                      {dep.codigo}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {/* BOTONES */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={cerrarFormulario}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={registrarEspacio}
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : editando
                  ? "Guardar cambios"
                  : "Registrar espacio"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

function Metric({
  t,
  n,
}: {
  t: string;
  n: number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <BuildingIcon size={20} />
      </div>

      <div>
        <span>{t}</span>
        <strong>{n}</strong>
      </div>
    </div>
  );
}
