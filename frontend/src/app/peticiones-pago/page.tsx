"use client";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { CameraIcon, CheckIcon, EyeIcon } from "../../../components/Icons";
import { api, apiArchivoUrl, apiPost, apiPutForm } from "../../../lib/api";
import { MUTED, bs, fechaLarga, nombrePeriodo } from "../../../lib/mi-cuenta";

// =====================================================================
// Tipos (lo que devuelve el backend)
// =====================================================================

type EstadoPeticion = "en_revision" | "aprobada" | "rechazada";

// GET /expensas/peticiones
type Peticion = {
  id: string;
  id_pago_expensa: string;
  departamento: number | null;
  estado: EstadoPeticion;
  motivo_rechazo: string | null;
  enviada: string; // ISO
  fecha_revision: string | null;
  foto: { mime: string; peso: number };
  deuda: { periodo: string; vencimiento: string; monto: number; mora: number; total: number };
  copropietario: { id: string; nombre: string };
  revisor: { id: string; nombre: string } | null;
};

// =====================================================================
// LLAMADAS AL BACKEND
// =====================================================================

// BACKEND: GET /expensas/peticiones?estado=en_revision|aprobada|rechazada
const cargarPeticionesApi = (estado: EstadoPeticion) => api<Peticion[]>(`/expensas/peticiones?estado=${estado}`);

// BACKEND: GET /expensas/peticiones/{id}/foto → foto del comprobante
const cargarFotoApi = (id: string) => apiArchivoUrl(`/expensas/peticiones/${id}/foto`);

// BACKEND: POST /expensas/peticiones/{id}/aprobar → la deuda queda pagada
const aprobarApi = (id: string) => apiPost(`/expensas/peticiones/${id}/aprobar`);

// BACKEND: POST /expensas/peticiones/{id}/rechazar { motivo } → la deuda vuelve a pendiente o vencida
const rechazarApi = (id: string, motivo: string) => apiPost(`/expensas/peticiones/${id}/rechazar`, { motivo });

// BACKEND: GET /expensas/qr → QR de cobro del edificio (tabla edificio); 404 si no hay
const cargarQrApi = () => apiArchivoUrl("/expensas/qr");

// BACKEND: PUT /expensas/qr (multipart, campo "qr") → carga o reemplaza el QR
const subirQrApi = (archivo: File) => {
  const form = new FormData();
  form.append("qr", archivo);
  return apiPutForm("/expensas/qr", form);
};

// =====================================================================
// Utilidades de presentación
// =====================================================================

const PESTANAS: { valor: EstadoPeticion; texto: string }[] = [
  { valor: "en_revision", texto: "En revisión" },
  { valor: "aprobada", texto: "Aprobadas" },
  { valor: "rechazada", texto: "Rechazadas" },
];

const ESTADO_PETICION: Record<EstadoPeticion, { clase: string; texto: string }> = {
  en_revision: { clase: "status status-info", texto: "En revisión" },
  aprobada: { clase: "status status-success", texto: "Aprobada" },
  rechazada: { clase: "status status-danger", texto: "Rechazada" },
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const TIPOS_QR = ["image/png", "image/jpeg", "image/webp"];
const MAXIMO_QR = 5 * 1024 * 1024;

// =====================================================================
// QR de cobro del edificio
// =====================================================================

function PanelQr() {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinQr, setSinQr] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let creada: string | null = null;
    cargarQrApi()
      .then((u) => {
        creada = u;
        setUrl(u);
        setSinQr(false);
      })
      .catch(() => {
        // 404: el edificio todavía no tiene QR
        setUrl(null);
        setSinQr(true);
      })
      .finally(() => setCargando(false));
    return () => {
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [version]);

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || subiendo) return;
    setMensaje(null);
    if (!TIPOS_QR.includes(archivo.type)) {
      setMensaje({ tipo: "error", texto: "El QR debe ser una imagen PNG, JPG o WEBP." });
      return;
    }
    if (archivo.size > MAXIMO_QR) {
      setMensaje({ tipo: "error", texto: "La imagen supera los 5 MB." });
      return;
    }
    setSubiendo(true);
    try {
      await subirQrApi(archivo);
      setMensaje({ tipo: "ok", texto: "QR actualizado. Los copropietarios ya ven el nuevo QR al pagar." });
      setVersion((v) => v + 1);
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo subir el QR." });
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section className="panel" style={{ flex: "1 1 280px" }}>
      <div className="panel-toolbar">
        <div>
          <h3>QR de cobro del edificio</h3>
          <p>Es el QR que ven los copropietarios al pagar sus expensas.</p>
        </div>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 220, height: 220, display: "grid", placeItems: "center",
            border: "1px dashed #E6DDD6", borderRadius: 12, background: "#FFFBF9",
          }}
        >
          {cargando ? (
            <span style={MUTED}>Cargando…</span>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="QR de cobro del edificio" style={{ width: 200, height: 200, objectFit: "contain" }} />
          ) : (
            <span style={{ ...MUTED, textAlign: "center", padding: 16 }}>Todavía no hay un QR cargado.</span>
          )}
        </div>
        <label className="upload-photo-btn" style={{ opacity: subiendo ? 0.6 : 1, pointerEvents: subiendo ? "none" : "auto" }}>
          <CameraIcon size={17} />
          {subiendo ? "Subiendo…" : sinQr ? "Subir QR" : "Reemplazar QR"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subir} disabled={subiendo} />
        </label>
        <span className="field-hint">PNG, JPG o WEBP, hasta 5 MB.</span>
        {mensaje && (
          <div className={`alert ${mensaje.tipo === "ok" ? "alert-success" : "alert-error"}`} style={{ width: "100%" }}>
            {mensaje.texto}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// Página
// =====================================================================

// Admin: revisa los comprobantes que envían los copropietarios y carga el QR de cobro
export default function PeticionesPagoPage() {
  const [estado, setEstado] = useState<EstadoPeticion>("en_revision");
  const [peticiones, setPeticiones] = useState<Peticion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [version, setVersion] = useState(0);

  // Modal del comprobante
  const [abierta, setAbierta] = useState<Peticion | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");

  useEffect(() => {
    cargarPeticionesApi(estado)
      .then((p) => {
        setPeticiones(p);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las peticiones."))
      .finally(() => setCargando(false));
  }, [estado, version]);

  // La foto se pide al abrir el modal y se libera al cerrarlo
  useEffect(() => {
    if (!abierta) return;
    let creada: string | null = null;
    cargarFotoApi(abierta.id)
      .then((u) => {
        creada = u;
        setFotoUrl(u);
      })
      .catch((e) => setErrorFoto(e instanceof Error ? e.message : "No se pudo cargar la foto."));
    return () => {
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [abierta]);

  function cambiarPestana(valor: EstadoPeticion) {
    if (valor === estado) return;
    setCargando(true);
    setEstado(valor);
  }

  function abrir(p: Peticion) {
    setAbierta(p);
    setFotoUrl(null);
    setErrorFoto("");
    setRechazando(false);
    setMotivo("");
    setErrorAccion("");
  }
  const cerrar = useCallback(() => {
    if (!procesando) setAbierta(null);
  }, [procesando]);

  async function aprobar() {
    if (!abierta || procesando) return;
    setProcesando(true);
    setErrorAccion("");
    try {
      await aprobarApi(abierta.id);
      setAviso(`Pago aprobado: Dpto. ${abierta.departamento ?? "—"}, ${nombrePeriodo(abierta.deuda.periodo)}. La deuda quedó pagada.`);
      setAbierta(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo aprobar.");
    } finally {
      setProcesando(false);
    }
  }

  async function rechazar() {
    if (!abierta || procesando) return;
    if (!motivo.trim()) {
      setErrorAccion("Escribe el motivo del rechazo: se le envía al copropietario.");
      return;
    }
    setProcesando(true);
    setErrorAccion("");
    try {
      await rechazarApi(abierta.id, motivo.trim());
      setAviso(`Comprobante rechazado: Dpto. ${abierta.departamento ?? "—"}, ${nombrePeriodo(abierta.deuda.periodo)}.`);
      setAbierta(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : "No se pudo rechazar.");
    } finally {
      setProcesando(false);
    }
  }

  const enRevision = estado === "en_revision";

  return (
    <DashboardLayout active="peticiones-pago">
      <div className="page-header">
        <div>
          <p className="eyebrow">FINANZAS</p>
          <h1>Peticiones de pago</h1>
          <p>Revisa los comprobantes que envían los copropietarios y administra el QR de cobro del edificio.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {aviso && <div className="alert alert-success" style={{ marginBottom: 16 }}>{aviso}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* Peticiones */}
        <section className="panel" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div className="panel-toolbar">
            <div>
              <h3>Comprobantes enviados</h3>
              <p>Al aprobar, la deuda queda pagada. Al rechazar, vuelve a pendiente (o vencida, con su mora).</p>
            </div>
          </div>
          <div className="role-tabs" role="tablist" aria-label="Filtrar por estado">
            {PESTANAS.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="tab"
                aria-selected={estado === t.valor}
                className={`role-tab ${estado === t.valor ? "active" : ""}`}
                onClick={() => cambiarPestana(t.valor)}
              >
                {t.texto}
              </button>
            ))}
          </div>

          {cargando ? (
            <div className="empty-state">Cargando…</div>
          ) : peticiones.length === 0 ? (
            <div className="empty-state">
              {enRevision ? "No hay comprobantes por revisar." : "No hay peticiones en esta lista."}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Enviada</th>
                    <th>Departamento</th>
                    <th>Período</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>{enRevision ? "Acción" : "Revisión"}</th>
                  </tr>
                </thead>
                <tbody>
                  {peticiones.map((p) => (
                    <tr key={p.id}>
                      <td>{fechaHora(p.enviada)}</td>
                      <td>
                        <strong>Dpto. {p.departamento ?? "—"}</strong>
                        <small>{p.copropietario.nombre}</small>
                      </td>
                      <td>{nombrePeriodo(p.deuda.periodo)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="money" style={{ fontWeight: 500 }}>{bs(p.deuda.total)}</span>
                        {p.deuda.mora > 0 && <small style={{ display: "block", ...MUTED, fontSize: 10 }}>incluye mora {bs(p.deuda.mora)}</small>}
                      </td>
                      <td><span className={ESTADO_PETICION[p.estado].clase}>{ESTADO_PETICION[p.estado].texto}</span></td>
                      <td style={{ textAlign: "right" }}>
                        {enRevision ? (
                          <button className="btn btn-primary btn-sm" onClick={() => abrir(p)}>
                            <EyeIcon size={16} /> Revisar
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => abrir(p)}>
                              <EyeIcon size={16} /> Ver
                            </button>
                            <small style={MUTED}>
                              {p.revisor?.nombre ?? "—"}{p.fecha_revision ? ` · ${fechaHora(p.fecha_revision)}` : ""}
                            </small>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* QR */}
        <PanelQr />
      </div>

      {/* Modal del comprobante */}
      <Modal open={abierta !== null} title="Comprobante de pago" onClose={cerrar}>
        {abierta && (
          <div className="modal-form">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
              <div
                style={{
                  minHeight: 260, display: "grid", placeItems: "center",
                  border: "1px solid #EFE7E1", borderRadius: 12, background: "#FAF7F4", overflow: "hidden",
                }}
              >
                {fotoUrl ? (
                  <a href={fotoUrl} target="_blank" rel="noopener noreferrer" title="Abrir en otra pestaña">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoUrl} alt="Foto del comprobante" style={{ maxWidth: "100%", maxHeight: 380, objectFit: "contain", display: "block" }} />
                  </a>
                ) : errorFoto ? (
                  <p className="field-error">{errorFoto}</p>
                ) : (
                  <span style={MUTED}>Cargando foto…</span>
                )}
              </div>

              <div className="role-list" style={{ padding: 0 }}>
                <div><span>Departamento</span><b>Dpto. {abierta.departamento ?? "—"}</b></div>
                <div><span>Copropietario</span><b>{abierta.copropietario.nombre}</b></div>
                <div><span>Período</span><b>{nombrePeriodo(abierta.deuda.periodo)}</b></div>
                <div><span>Vencimiento</span><b>{fechaLarga(abierta.deuda.vencimiento)}</b></div>
                <div><span>Expensa y extras</span><b>{bs(abierta.deuda.monto)}</b></div>
                <div><span>Mora</span><b>{bs(abierta.deuda.mora)}</b></div>
                <div><span><strong>Total a cobrar</strong></span><b style={{ color: "#B03030", fontSize: 13 }}>{bs(abierta.deuda.total)}</b></div>
                <div><span>Enviada</span><b>{fechaHora(abierta.enviada)}</b></div>
                <div><span>Estado</span><b><span className={ESTADO_PETICION[abierta.estado].clase}>{ESTADO_PETICION[abierta.estado].texto}</span></b></div>
                {abierta.motivo_rechazo && <div><span>Motivo del rechazo</span><b>{abierta.motivo_rechazo}</b></div>}
              </div>
            </div>

            {abierta.estado === "en_revision" && rechazando && (
              <label className="field" style={{ marginTop: 16 }}>
                <span>Motivo del rechazo</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={255}
                  placeholder="Ej. El monto del comprobante no coincide con la deuda."
                  disabled={procesando}
                />
                <span className="field-hint">Se le envía por correo al copropietario.</span>
              </label>
            )}

            {errorAccion && <div className="alert alert-error" style={{ marginTop: 12 }}>{errorAccion}</div>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cerrar} disabled={procesando}>
                {abierta.estado === "en_revision" ? "Cancelar" : "Cerrar"}
              </button>
              {abierta.estado === "en_revision" && !rechazando && (
                <>
                  <button className="btn btn-ghost" onClick={() => setRechazando(true)} disabled={procesando}>Rechazar</button>
                  <button className="btn btn-primary" onClick={aprobar} disabled={procesando}>
                    <CheckIcon size={16} /> {procesando ? "Aprobando…" : "Aprobar pago"}
                  </button>
                </>
              )}
              {abierta.estado === "en_revision" && rechazando && (
                <>
                  <button className="btn btn-ghost" onClick={() => setRechazando(false)} disabled={procesando}>Volver</button>
                  <button className="btn btn-primary" onClick={rechazar} disabled={procesando || !motivo.trim()}>
                    {procesando ? "Rechazando…" : "Confirmar rechazo"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
