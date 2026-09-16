"use client";

import { useEffect } from "react";
import { Icon } from "./Icons";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">FORMULARIO</p>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <Icon size={20}>
              <path d="m6 6 12 12M18 6 6 18" />
            </Icon>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
