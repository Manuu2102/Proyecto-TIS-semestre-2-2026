"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  /** Texto extra resaltado (consecuencias de la acción). */
  warning?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "danger" = botón rojo (eliminar, borrar); "primary" = acción importante pero no destructiva. */
  tone?: "danger" | "primary";
};

type Pendiente = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Modal de confirmación reutilizable.
 *
 *   const [confirmar, modalConfirmar] = useConfirm();
 *   if (!(await confirmar({ title: "...", message: "..." }))) return;
 *   ...
 *   return <>{...}{modalConfirmar}</>;
 *
 * Se puede abrir encima de otro Modal: Escape solo cierra la confirmación.
 */
export function useConfirm() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const pendienteRef = useRef<Pendiente | null>(null);

  const responder = useCallback((ok: boolean) => {
    pendienteRef.current?.resolve(ok);
    pendienteRef.current = null;
    setPendiente(null);
  }, []);

  const confirmar = useCallback(
    (opciones: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        pendienteRef.current?.resolve(false);
        const nuevo = { ...opciones, resolve };
        pendienteRef.current = nuevo;
        setPendiente(nuevo);
      }),
    []
  );

  // Escape en fase de captura: cancela la confirmación sin cerrar el modal de abajo
  useEffect(() => {
    if (!pendiente) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      responder(false);
    };
    window.addEventListener("keydown", fn, true);
    return () => window.removeEventListener("keydown", fn, true);
  }, [pendiente, responder]);

  const cancelar = useCallback(() => responder(false), [responder]);

  const modal = (
    <Modal
      open={pendiente !== null}
      title={pendiente?.title ?? ""}
      eyebrow="CONFIRMACIÓN"
      size="sm"
      onClose={cancelar}
    >
      <div className="confirm-body">
        {pendiente?.message}
        {pendiente?.warning && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            {pendiente.warning}
          </div>
        )}
      </div>
      <div className="modal-actions" style={{ padding: "0 24px 22px" }}>
        <button type="button" className="btn btn-secondary" onClick={cancelar}>
          {pendiente?.cancelText ?? "Cancelar"}
        </button>
        <button
          type="button"
          className={pendiente?.tone === "primary" ? "btn btn-primary" : "btn btn-danger"}
          onClick={() => responder(true)}
          autoFocus
        >
          {pendiente?.confirmText ?? "Sí, continuar"}
        </button>
      </div>
    </Modal>
  );

  return [confirmar, modal] as const;
}
