"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { CheckIcon, EditIcon, FileIcon, MailIcon, PlusIcon, SearchIcon, TrashIcon } from "../../../components/Icons";
import { fechaCorta, normalizar } from "../../../lib/formato";
import {
  actualizarComunicado, crearComunicado, eliminarComunicado, ETIQUETA_ROL, listarComunicados,
  listarContactos, MENSAJE_MAX, resolverDestinatarios, ROLES, textoDestinatarios, validarComunicado,
} from "../../../lib/comunicados";
import type {
  Canal, Comunicado, ComunicadoForm, Contacto, ErroresComunicado, ModoDestinatarios, Rol,
} from "../../../lib/comunicados";

// =====================================================================
// Iconos propios (solo presentación)
// =====================================================================

type IconoProps = { size?: number };

const svgBase = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

function ChatIcon({ size = 18 }: IconoProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
      <path d="M8.5 10h7M8.5 13.5h4" />
    </svg>
  );
}

function PencilDocIcon({ size = 18 }: IconoProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function SendIcon({ size = 18 }: IconoProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function UsersIcon({ size = 18 }: IconoProps) {
  return (
    <svg {...svgBase(size)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function TinyCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// =====================================================================
// Estilos del formulario (con prefijo cm- para no chocar con el CSS global)
// =====================================================================

const ESTILOS_FORM = `
.cm-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:start}
@media (max-width:900px){.cm-grid{grid-template-columns:minmax(0,1fr)}}
.cm-col{display:flex;flex-direction:column;gap:16px;min-width:0}
.cm-sticky{position:sticky;top:0}

.cm-sec{border:1px solid #EEE8E2;border-radius:12px;background:#fff}
.cm-sec-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #F1ECE8}
.cm-sec-ico{width:34px;height:34px;border-radius:9px;background:#FFF0EB;color:#C83232;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-sec-title{margin:0;font-size:13px;font-weight:700;color:#302D2B;line-height:1.3}
.cm-sec-help{margin:2px 0 0;font-size:11.5px;font-weight:400;color:#9A918B;line-height:1.35}
.cm-sec-body{padding:16px 18px;display:flex;flex-direction:column;gap:14px}

.cm-label{display:block;font-size:12px;font-weight:600;color:#514B46;margin:0 0 8px}
.cm-label b{color:#C83232;margin-left:2px}
.cm-note{margin:0;font-size:11.5px;color:#9A918B;line-height:1.5;font-weight:400}
.cm-error{margin:6px 0 0;font-size:11.5px;color:#9F2727;font-weight:500}

.cm-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.cm-opt{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #E5DED7;border-radius:10px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s;font-weight:400;margin:0}
.cm-opt:hover{border-color:#D9B9B2}
.cm-opt:focus-within{box-shadow:0 0 0 3px rgba(200,50,50,.12)}
.cm-opt.on{border-color:#C83232;background:#FFF8F5}
.cm-opt.bad{border-color:#E7A9A1}
.cm-opt input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.cm-opt-ico{width:36px;height:36px;border-radius:9px;background:#F6F1EC;color:#8B8580;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,color .15s}
.cm-opt.on .cm-opt-ico{background:#C83232;color:#fff}
.cm-opt-txt{display:flex;flex-direction:column;min-width:0}
.cm-opt-title{font-size:13px;font-weight:600;color:#302D2B;line-height:1.3}
.cm-opt-sub{font-size:11px;color:#9A918B;line-height:1.35}
.cm-box{margin-left:auto;width:18px;height:18px;border:1.5px solid #CFC6BE;border-radius:5px;display:flex;align-items:center;justify-content:center;color:transparent;flex-shrink:0;background:#fff;transition:all .15s}
.cm-opt.on .cm-box{background:#C83232;border-color:#C83232;color:#fff}

.cm-chips{display:flex;flex-wrap:wrap;gap:8px}
.cm-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #E5DED7;border-radius:999px;background:#fff;font-size:12px;font-weight:600;color:#6B635D;cursor:pointer;transition:all .15s;margin:0}
.cm-chip:hover{border-color:#D9B9B2}
.cm-chip:focus-within{box-shadow:0 0 0 3px rgba(200,50,50,.12)}
.cm-chip input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.cm-chip.on{border-color:#C83232;background:#FFF0EB;color:#C83232}
.cm-chip-n{font-size:11px;font-weight:700;background:#F1ECE8;color:#8B8580;border-radius:999px;padding:1px 7px}
.cm-chip.on .cm-chip-n{background:#C83232;color:#fff}

.cm-people{max-height:230px;overflow-y:auto;border:1px solid #E5DED7;border-radius:10px;background:#fff}
.cm-person{position:relative;display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #F4EFEA;cursor:pointer;margin:0;font-weight:400;transition:background .12s}
.cm-person:last-child{border-bottom:0}
.cm-person:hover{background:#FDFBF9}
.cm-person.on{background:#FFF8F5}
.cm-person input{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
.cm-avatar{width:28px;height:28px;border-radius:50%;background:#F1ECE7;color:#746C66;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-person.on .cm-avatar{background:#FFE1D8;color:#C83232}
.cm-person-name{font-size:12.5px;font-weight:600;color:#302D2B;line-height:1.3}
.cm-person-rol{font-size:11px;color:#9A918B}

.cm-reach{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;padding:7px 12px;border-radius:999px;background:#F6F1EC;color:#5D5752;font-size:12px;font-weight:600}
.cm-reach svg{color:#C83232}

.cm-counter{display:block;margin-top:6px;text-align:right;font-size:11px;color:#9A918B}
.cm-counter.warn{color:#A16D25;font-weight:600}

.cm-prev{border:1px solid #EEE8E2;border-radius:12px;background:#fff;overflow:hidden}
.cm-prev-head{padding:14px 18px 10px}
.cm-prev-tabs{display:flex;gap:6px;padding:0 18px 12px}
.cm-prev-tab{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid #E5DED7;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#8B8580;cursor:pointer;transition:all .15s}
.cm-prev-tab:hover{border-color:#D9B9B2}
.cm-prev-tab.on{background:#FFF0EB;border-color:#EFC7BC;color:#C83232}
.cm-prev-stage{padding:18px;background:#F7F4EF;border-top:1px solid #F1ECE8}

.cm-wa{background:#EAE2D6;border-radius:10px;padding:16px 14px;min-height:150px}
.cm-wa-bubble{position:relative;max-width:92%;background:#DCF8C6;border-radius:10px 10px 2px 10px;padding:9px 12px 7px;margin-left:auto;box-shadow:0 1px 1px rgba(0,0,0,.12)}
.cm-wa-title{display:block;font-size:13px;font-weight:700;color:#1F2A1C;margin-bottom:3px;overflow-wrap:anywhere}
.cm-wa-text{margin:0;font-size:13px;line-height:1.45;color:#263322;white-space:pre-wrap;overflow-wrap:anywhere}
.cm-wa-time{display:block;text-align:right;margin-top:4px;font-size:10px;color:#6B8266}

.cm-mail{background:#fff;border:1px solid #E5DED7;border-radius:10px;overflow:hidden}
.cm-mail-head{padding:12px 14px;border-bottom:1px solid #F1ECE8;display:flex;flex-direction:column;gap:3px}
.cm-mail-meta{font-size:11px;color:#9A918B}
.cm-mail-subject{font-size:13.5px;font-weight:700;color:#302D2B;margin-top:4px;overflow-wrap:anywhere}
.cm-mail-body{padding:14px;font-size:12.5px;line-height:1.55;color:#4D4742;white-space:pre-wrap;overflow-wrap:anywhere;min-height:90px}
.cm-mail-sign{padding:10px 14px;border-top:1px solid #F1ECE8;background:#FBFAF8;font-size:11px;color:#9A918B}
.cm-ghost{color:#B5ADA6 !important;font-style:italic;font-weight:400 !important}

.cm-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid #F1ECE8}
.cm-foot-note{margin-right:auto;font-size:11.5px;color:#9A918B}
.cm-foot .btn{display:inline-flex;align-items:center;gap:7px}

.cm-confirm{margin-top:18px;border:1px solid #EFC7BC;border-radius:12px;background:#FFF8F5;padding:16px 18px}
.cm-confirm-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.cm-confirm-ico{width:36px;height:36px;border-radius:9px;background:#C83232;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-confirm-title{margin:0;font-size:14px;font-weight:700;color:#302D2B}
.cm-confirm-sub{margin:2px 0 0;font-size:11.5px;color:#766E69}
.cm-confirm-list{margin:0 0 14px;padding:0;list-style:none;border:1px solid #F0DDD6;border-radius:10px;background:#fff}
.cm-confirm-list li{display:flex;justify-content:space-between;gap:16px;padding:9px 12px;border-bottom:1px solid #F7EEEA;font-size:12.5px;color:#5D5752}
.cm-confirm-list li:last-child{border-bottom:0}
.cm-confirm-list strong{color:#302D2B;text-align:right;overflow-wrap:anywhere}
.cm-confirm-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.cm-confirm-actions .btn{display:inline-flex;align-items:center;gap:7px}
`;

function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

function Seccion({
  icono,
  titulo,
  ayuda,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cm-sec">
      <header className="cm-sec-head">
        <span className="cm-sec-ico">{icono}</span>
        <div>
          <h4 className="cm-sec-title">{titulo}</h4>
          {ayuda && <p className="cm-sec-help">{ayuda}</p>}
        </div>
      </header>
      <div className="cm-sec-body">{children}</div>
    </section>
  );
}

function EstadoVacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div
      className="state-box"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#FFF0EB",
          color: "#C83232",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <MailIcon size={20} />
      </div>
      <strong style={{ fontSize: 14, color: "#302D2B" }}>{titulo}</strong>
      <span style={{ fontSize: 12, color: "#766E69", maxWidth: 380 }}>{texto}</span>
    </div>
  );
}

// =====================================================================
// Página
// =====================================================================

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Comunicado | null>(null);
  const [aEliminar, setAEliminar] = useState<Comunicado | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function recargar() {
    setComunicados(await listarComunicados());
  }

  useEffect(() => {
    let vigente = true;
    Promise.all([listarComunicados(), listarContactos()])
      .then(([coms, conts]) => {
        if (!vigente) return;
        setComunicados(coms);
        setContactos(conts);
      })
      .catch((e: Error) => vigente && setError(e.message || "No se pudieron cargar los comunicados."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(""), 4500);
    return () => clearTimeout(t);
  }, [mensaje]);

  // Más recientes primero + búsqueda
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return comunicados
      .filter((c) => !q || normalizar(`${c.titulo} ${c.asunto} ${c.mensaje}`).includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }, [comunicados, busqueda]);

  const enviados = comunicados.filter((c) => c.estado === "Enviado");
  const borradores = comunicados.filter((c) => c.estado === "Borrador").length;
  // Cada persona recibe un mensaje por cada canal usado
  const entregados = enviados.reduce((total, c) => total + c.personas * c.canales.length, 0);

  function abrirNuevo() {
    setEditando(null);
    setAbierto(true);
  }
  function abrirEditar(c: Comunicado) {
    setEditando(c);
    setAbierto(true);
  }
  function cerrar() {
    setAbierto(false);
    setEditando(null);
  }

  /** Devuelve el mensaje de error si falla; null si todo salió bien. */
  async function guardar(datos: ComunicadoForm, enviarAhora: boolean): Promise<string | null> {
    try {
      if (editando) await actualizarComunicado(editando.id, datos, enviarAhora);
      else await crearComunicado(datos, enviarAhora);
      await recargar();
      setMensaje(
        enviarAhora
          ? "Comunicado enviado correctamente."
          : editando?.estado === "Enviado"
            ? "Los cambios del comunicado se guardaron correctamente."
            : "Borrador guardado correctamente."
      );
      cerrar();
      return null;
    } catch (e) {
      return (e as Error).message || "No se pudo guardar el comunicado.";
    }
  }

  async function confirmarEliminacion() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      await eliminarComunicado(aEliminar.id);
      await recargar();
      setMensaje("Comunicado eliminado correctamente.");
    } catch (e) {
      setError((e as Error).message || "No se pudo eliminar el comunicado.");
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  return (
    <DashboardLayout active="comunicados">
      <div className="page-header">
        <div>
          <p className="eyebrow">OPERACIONES · COMUNICADOS</p>
          <h1>Comunicados</h1>
          <p>
            Gestiona y registra los avisos oficiales del edificio, enviados a los residentes por WhatsApp y
            correo electrónico.
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo} disabled={cargando}>
          <PlusIcon size={17} />
          Nuevo comunicado
        </button>
      </div>

      {mensaje && <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>{mensaje}</div>}
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-icon"><MailIcon size={20} /></div>
          <div><span>Comunicados enviados</span><strong>{cargando ? "…" : enviados.length}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><FileIcon size={20} /></div>
          <div><span>Borradores guardados</span><strong>{cargando ? "…" : borradores}</strong></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon soft"><CheckIcon size={20} /></div>
          <div><span>Mensajes entregados</span><strong>{cargando ? "…" : entregados}</strong></div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-toolbar">
          <div>
            <h3>Historial de comunicados</h3>
            <p>Registro cronológico, del más reciente al más antiguo.</p>
          </div>
          <div className="search-box">
            <SearchIcon size={17} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título, asunto o mensaje..."
              aria-label="Buscar comunicado"
            />
          </div>
        </div>

        {cargando ? (
          <div className="state-box">Cargando comunicados…</div>
        ) : filtrados.length === 0 ? (
          comunicados.length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay comunicados registrados"
              texto="Crea el primero con el botón «Nuevo comunicado» para informar a los residentes."
            />
          ) : (
            <EstadoVacio
              titulo="Sin resultados"
              texto="No se encontraron comunicados que coincidan con la búsqueda."
            />
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Comunicado</th>
                  <th>Destinatarios</th>
                  <th>Canales</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.titulo}</strong>
                      <span className="com-desc">{c.mensaje || "Sin mensaje"}</span>
                    </td>
                    <td>{textoDestinatarios(c.destinatarios, c.personas)}</td>
                    <td>
                      <div className="com-tags">
                        {c.canales.length === 0 ? <span className="com-vacio">—</span> : c.canales.map((canal) => <span key={canal} className="tag">{canal}</span>)}
                      </div>
                    </td>
                    <td>{fechaCorta(c.fecha)}</td>
                    <td>
                      <span className={c.estado === "Enviado" ? "status status-success" : "status status-neutral"}>
                        <span />
                        {c.estado}
                      </span>
                    </td>
                    <td>
                      <div className="com-row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)} aria-label={`Editar ${c.titulo}`} title="Editar">
                          <EditIcon size={15} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAEliminar(c)} aria-label={`Eliminar ${c.titulo}`} title="Eliminar">
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && comunicados.length > 0 && (
          <div className="pagination">
            <span>Mostrando {filtrados.length} de {comunicados.length} comunicados</span>
          </div>
        )}
      </section>

      <Modal open={abierto} title={editando ? "Editar comunicado" : "Nuevo comunicado"} size="lg" onClose={cerrar}>
        <ComunicadoFormulario inicial={editando} contactos={contactos} onGuardar={guardar} onCancel={cerrar} />
      </Modal>

      <Modal open={aEliminar !== null} title="Eliminar comunicado" onClose={() => !eliminando && setAEliminar(null)}>
        <div className="confirm-body">
          <p style={{ margin: "0 0 10px" }}>
            ¿Seguro que deseas eliminar el comunicado <strong>{aEliminar?.titulo}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#766E69" }}>
            Dejará de aparecer en el historial. Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="modal-actions" style={{ padding: "0 24px 22px" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setAEliminar(null)} disabled={eliminando}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={confirmarEliminacion} disabled={eliminando}>
            {eliminando ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// =====================================================================
// Formulario con vista previa
// =====================================================================

const ETIQUETA_CAMPO: Record<keyof ErroresComunicado, string> = {
  titulo: "el título",
  asunto: "el asunto del correo",
  mensaje: "el mensaje",
  canales: "un canal de envío",
  destinatarios: "los destinatarios",
};

const alternar = <T,>(lista: T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const CANALES_INFO: Record<Canal, { titulo: string; detalle: string; icono: React.ReactNode }> = {
  WhatsApp: {
    titulo: "WhatsApp",
    detalle: "Título y mensaje",
    icono: <ChatIcon size={18} />,
  },
  Correo: {
    titulo: "Correo electrónico",
    detalle: "Incluye asunto",
    icono: <MailIcon size={18} />,
  },
};

function ComunicadoFormulario({
  inicial,
  contactos,
  onGuardar,
  onCancel,
}: {
  inicial: Comunicado | null;
  contactos: Contacto[];
  onGuardar: (datos: ComunicadoForm, enviarAhora: boolean) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [asunto, setAsunto] = useState(inicial?.asunto ?? "");
  const [mensaje, setMensaje] = useState(inicial?.mensaje ?? "");
  const [canales, setCanales] = useState<Canal[]>(inicial?.canales ?? []);
  const [modo, setModo] = useState<ModoDestinatarios>(inicial?.destinatarios.modo ?? "todos");
  const [cargos, setCargos] = useState<Rol[]>(inicial?.destinatarios.cargos ?? []);
  const [personas, setPersonas] = useState<number[]>(inicial?.destinatarios.personas ?? []);
  const [vista, setVista] = useState<Canal>("WhatsApp");
  const [errores, setErrores] = useState<ErroresComunicado>({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState<"borrador" | "enviar" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [hora] = useState(horaActual);

  const esEnviado = inicial?.estado === "Enviado";
  const destinatarios = { modo, cargos, personas };
  const alcance = resolverDestinatarios(destinatarios, contactos).length;
  const usaCorreo = canales.includes("Correo");

  function limpiar(campo: keyof ErroresComunicado) {
    setErrores((a) => ({ ...a, [campo]: undefined }));
    setErrorGeneral("");
  }

  async function guardar(enviarAhora: boolean, confirmado = false) {
    const datos: ComunicadoForm = {
      titulo: titulo.trim(),
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      canales,
      destinatarios,
    };
    const estricto = enviarAhora || esEnviado;
    const encontrados = validarComunicado(datos, estricto);
    setErrores(encontrados);
    const faltan = (Object.keys(encontrados) as (keyof ErroresComunicado)[]).map((k) => ETIQUETA_CAMPO[k]);
    if (faltan.length > 0) {
      setConfirmando(false);
      setErrorGeneral(
        `${estricto ? "Para enviar el comunicado" : "Para guardar el borrador"} falta: ${faltan.join(", ")}.`
      );
      return;
    }

    // Envío inmediato: primero se pide confirmación
    if (enviarAhora && !confirmado) {
      setConfirmando(true);
      return;
    }

    setGuardando(enviarAhora ? "enviar" : "borrador");
    const falla = await onGuardar(datos, enviarAhora);
    setGuardando(null);
    if (falla) {
      setConfirmando(false);
      setErrorGeneral(falla);
    }
  }

  const cercaDelLimite = mensaje.length >= MENSAJE_MAX * 0.9;

  return (
    <form className="modal-form" noValidate onSubmit={(e) => e.preventDefault()}>
      <style>{ESTILOS_FORM}</style>

      <div className="cm-grid">
        {/* ---------- Columna izquierda: formulario ---------- */}
        <div className="cm-col">
          <Seccion
            icono={<PencilDocIcon size={17} />}
            titulo="Contenido del comunicado"
            ayuda="Redacta el aviso que recibirán los residentes."
          >
            <label className={`field ${errores.titulo ? "has-error" : ""}`}>
              <span>Título <b>*</b></span>
              <input
                value={titulo}
                maxLength={80}
                onChange={(e) => { setTitulo(e.target.value); limpiar("titulo"); }}
                placeholder="Ej. Corte de agua programado"
                autoComplete="off"
              />
              {errores.titulo && <span className="field-error">{errores.titulo}</span>}
            </label>

            {usaCorreo && (
              <label className={`field ${errores.asunto ? "has-error" : ""}`}>
                <span>Asunto del correo <b>*</b></span>
                <input
                  value={asunto}
                  maxLength={120}
                  onChange={(e) => { setAsunto(e.target.value); limpiar("asunto"); }}
                  placeholder="Ej. Corte de agua – sábado 7 de noviembre"
                  autoComplete="off"
                />
                {errores.asunto && <span className="field-error">{errores.asunto}</span>}
              </label>
            )}

            <label className={`field ${errores.mensaje ? "has-error" : ""}`}>
              <span>Mensaje <b>*</b></span>
              <textarea
                rows={6}
                value={mensaje}
                maxLength={MENSAJE_MAX}
                onChange={(e) => { setMensaje(e.target.value); limpiar("mensaje"); }}
                placeholder="Escribe aquí el aviso para los residentes..."
              />
              <span className={`cm-counter ${cercaDelLimite ? "warn" : ""}`}>
                {mensaje.length} / {MENSAJE_MAX} caracteres
              </span>
              {errores.mensaje && <span className="field-error">{errores.mensaje}</span>}
            </label>
          </Seccion>

          <Seccion
            icono={<SendIcon size={17} />}
            titulo="Canales de envío"
            ayuda="Selecciona por dónde se enviará el comunicado."
          >
            <div>
              <div className="cm-options">
                {(["WhatsApp", "Correo"] as Canal[]).map((canal) => {
                  const activo = canales.includes(canal);
                  const info = CANALES_INFO[canal];
                  return (
                    <label
                      key={canal}
                      className={`cm-opt ${activo ? "on" : ""} ${errores.canales ? "bad" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => {
                          setCanales(alternar(canales, canal));
                          limpiar("canales");
                          limpiar("asunto");
                        }}
                      />
                      <span className="cm-opt-ico">{info.icono}</span>
                      <span className="cm-opt-txt">
                        <span className="cm-opt-title">{info.titulo}</span>
                        <span className="cm-opt-sub">{info.detalle}</span>
                      </span>
                      <span className="cm-box"><TinyCheck /></span>
                    </label>
                  );
                })}
              </div>
              {errores.canales && <p className="cm-error">{errores.canales}</p>}
            </div>
          </Seccion>

          <Seccion
            icono={<UsersIcon size={17} />}
            titulo="Destinatarios"
            ayuda="Define quiénes recibirán el comunicado."
          >
            <div>
              <label className="cm-label" htmlFor="com-destinatarios">
                Enviar a <b>*</b>
              </label>
              <div className="field" style={{ margin: 0 }}>
                <select
                  id="com-destinatarios"
                  value={modo}
                  onChange={(e) => { setModo(e.target.value as ModoDestinatarios); limpiar("destinatarios"); }}
                >
                  <option value="todos">Todos los usuarios</option>
                  <option value="cargo">Por cargo</option>
                  <option value="especificas">Personas específicas</option>
                </select>
              </div>
            </div>

            {modo === "cargo" && (
              <div>
                <p className="cm-label">Selecciona los cargos</p>
                <div className="cm-chips">
                  {ROLES.map((rol) => {
                    const activo = cargos.includes(rol);
                    return (
                      <label key={rol} className={`cm-chip ${activo ? "on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => { setCargos(alternar(cargos, rol)); limpiar("destinatarios"); }}
                        />
                        {ETIQUETA_ROL[rol]}
                        <span className="cm-chip-n">{contactos.filter((c) => c.rol === rol).length}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {modo === "especificas" && (
              <div>
                <p className="cm-label">Selecciona las personas</p>
                <div className="cm-people">
                  {contactos.map((c) => {
                    const activo = personas.includes(c.id);
                    return (
                      <label key={c.id} className={`cm-person ${activo ? "on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => { setPersonas(alternar(personas, c.id)); limpiar("destinatarios"); }}
                        />
                        <span className="cm-avatar">{iniciales(c.nombre)}</span>
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span className="cm-person-name">{c.nombre}</span>
                          <span className="cm-person-rol">{c.rol}</span>
                        </span>
                        <span className="cm-box"><TinyCheck /></span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <span className="cm-reach">
                <UsersIcon size={15} />
                Llegará a {alcance} {alcance === 1 ? "persona" : "personas"}
              </span>
              {errores.destinatarios && <p className="cm-error">{errores.destinatarios}</p>}
            </div>
          </Seccion>
        </div>

        {/* ---------- Columna derecha: vista previa ---------- */}
        <aside className="cm-sticky" aria-label="Vista previa del comunicado">
          <div className="cm-prev">
            <div className="cm-prev-head">
              <h4 className="cm-sec-title">Vista previa</h4>
              <p className="cm-sec-help">Así verán el comunicado los destinatarios.</p>
            </div>

            <div className="cm-prev-tabs" role="tablist">
              {(["WhatsApp", "Correo"] as Canal[]).map((canal) => (
                <button
                  key={canal}
                  type="button"
                  role="tab"
                  aria-selected={vista === canal}
                  className={`cm-prev-tab ${vista === canal ? "on" : ""}`}
                  onClick={() => setVista(canal)}
                >
                  {canal === "WhatsApp" ? <ChatIcon size={14} /> : <MailIcon size={14} />}
                  {canal === "Correo" ? "Correo electrónico" : "WhatsApp"}
                </button>
              ))}
            </div>

            <div className="cm-prev-stage">
              {vista === "WhatsApp" ? (
                <div className="cm-wa">
                  <div className="cm-wa-bubble">
                    <strong className={`cm-wa-title ${titulo.trim() ? "" : "cm-ghost"}`}>
                      {titulo.trim() || "Sin título"}
                    </strong>
                    <p className={`cm-wa-text ${mensaje.trim() ? "" : "cm-ghost"}`}>
                      {mensaje.trim() || "Escribe el mensaje para ver cómo llega"}
                    </p>
                    <span className="cm-wa-time">{hora} ✓✓</span>
                  </div>
                </div>
              ) : (
                <div className="cm-mail">
                  <div className="cm-mail-head">
                    <span className="cm-mail-meta">De: Administración · Edificio Central</span>
                    <span className="cm-mail-meta">
                      Para: {alcance} {alcance === 1 ? "destinatario" : "destinatarios"}
                    </span>
                    <strong className={`cm-mail-subject ${asunto.trim() ? "" : "cm-ghost"}`}>
                      {asunto.trim() || "Sin asunto"}
                    </strong>
                  </div>
                  <div className={`cm-mail-body ${mensaje.trim() ? "" : "cm-ghost"}`}>
                    {mensaje.trim() || "Escribe el mensaje para ver cómo llega"}
                  </div>
                  <div className="cm-mail-sign">Edificio Central · Administración</div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {errorGeneral && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{errorGeneral}</div>}

      {confirmando ? (
        <div className="cm-confirm" role="alertdialog" aria-labelledby="cm-confirm-title">
          <div className="cm-confirm-head">
            <span className="cm-confirm-ico"><SendIcon size={17} /></span>
            <div>
              <h4 className="cm-confirm-title" id="cm-confirm-title">¿Enviar este comunicado ahora?</h4>
              <p className="cm-confirm-sub">Una vez enviado no se puede retirar. Revisa los datos antes de continuar.</p>
            </div>
          </div>

          <ul className="cm-confirm-list">
            <li><span>Título</span><strong>{titulo.trim()}</strong></li>
            <li>
              <span>Canales</span>
              <strong>{canales.map((c) => (c === "Correo" ? "Correo electrónico" : "WhatsApp")).join(" + ")}</strong>
            </li>
            <li>
              <span>Destinatarios</span>
              <strong>{alcance} {alcance === 1 ? "persona" : "personas"}</strong>
            </li>
          </ul>

          <div className="cm-confirm-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmando(false)} disabled={guardando !== null}>
              Volver a editar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => guardar(true, true)} disabled={guardando !== null}>
              <SendIcon size={15} />
              {guardando === "enviar" ? "Enviando..." : "Sí, enviar ahora"}
            </button>
          </div>
        </div>
      ) : (
        <div className="cm-foot">
          <span className="cm-foot-note">Los campos marcados con * son obligatorios.</span>

          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={guardando !== null}>
            Cancelar
          </button>
          {esEnviado ? (
            <button type="button" className="btn btn-primary" onClick={() => guardar(false)} disabled={guardando !== null}>
              {guardando === "borrador" ? "Guardando..." : "Guardar cambios"}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => guardar(false)} disabled={guardando !== null}>
                {guardando === "borrador" ? "Guardando..." : "Guardar borrador"}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => guardar(true)} disabled={guardando !== null}>
                <SendIcon size={15} />
                Enviar ahora
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}