"use client";

import { useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { PlusIcon, BuildingIcon } from "../../../components/Icons";
import { Modal } from "../../../components/Modal";

type Espacio = {
  id: string;
  tipo: "Parqueo" | "Baulera";
  departamento: string;
  estado: "Asignado" | "Disponible";
};

const initial: Espacio[] = [
  {
    id: "P-14",
    tipo: "Parqueo",
    departamento: "A-101",
    estado: "Asignado",
  },
  {
    id: "P-15",
    tipo: "Parqueo",
    departamento: "A-202",
    estado: "Asignado",
  },
  {
    id: "B-08",
    tipo: "Baulera",
    departamento: "A-101",
    estado: "Asignado",
  },
  {
    id: "B-09",
    tipo: "Baulera",
    departamento: "—",
    estado: "Disponible",
  },
];

const departamentos = [
  "A-101",
  "A-202",
  "A-303",
  "A-404",
  "B-101",
  "B-202",
  "B-303",
  "B-404",
];

export default function Espacios() {
  const [items, setItems] = useState<Espacio[]>(initial);

  const [open, setOpen] = useState(false);

  const [tipo, setTipo] =
    useState<"Parqueo" | "Baulera">("Parqueo");

  const [identificador, setIdentificador] = useState("");

  const [departamento, setDepartamento] = useState("—");

  const [error, setError] = useState("");

  function abrirFormulario() {
    setIdentificador("");
    setDepartamento("—");
    setTipo("Parqueo");
    setError("");
    setOpen(true);
  }

  function cerrarFormulario() {
    setOpen(false);
    setIdentificador("");
    setDepartamento("—");
    setTipo("Parqueo");
    setError("");
  }

  function registrarEspacio() {
    const id = identificador.trim().toUpperCase();

    setError("");

    // Validar que exista un identificador
    if (!id) {
      setError(
        "Ingresa un identificador para el espacio."
      );
      return;
    }

    // Verificar que el identificador sea único
    const existe = items.some(
      (item) => item.id.toUpperCase() === id
    );

    if (existe) {
      setError(
        "El identificador ya existe. Usa uno diferente."
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

    // Crear nuevo espacio
    const nuevoEspacio: Espacio = {
      id,
      tipo,
      departamento,
      estado:
        departamento === "—"
          ? "Disponible"
          : "Asignado",
    };

    // Agregar el espacio a la lista
    setItems((actuales) => [
      nuevoEspacio,
      ...actuales,
    ]);

    // Cerrar el formulario
    setOpen(false);

    // Limpiar los campos
    setIdentificador("");
    setDepartamento("—");
    setTipo("Parqueo");
    setError("");

    // Mostrar mensaje emergente del navegador
    alert("El espacio se registró correctamente.");
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
              </tr>
            </thead>

            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.id}</strong>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FORMULARIO DE REGISTRO */}
      <Modal
        open={open}
        title="Registrar espacio"
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

            {/* TIPO DE ESPACIO */}
            <label className="field">
              <span>
                Tipo de espacio
              </span>

              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(
                    e.target.value as
                      | "Parqueo"
                      | "Baulera"
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
                <option value="—">
                  Sin asignar
                </option>

                {departamentos.map(
                  (dep) => (
                    <option
                      key={dep}
                      value={dep}
                    >
                      {dep}
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
            >
              Registrar espacio
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