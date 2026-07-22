"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type ModalSize = "sm" | "md" | "lg";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Largeur max du panneau. */
  size?: ModalSize;
  /** Classes ajoutées au panneau. */
  className?: string;
  /** id de l'élément titre, pour aria-labelledby. */
  labelledBy?: string;
}

/*
 * Modale de base : backdrop teinté, panneau centré, fermeture au clic extérieur
 * et à Échap. Rendue via portal sur <body> — sinon elle reste dans le contexte
 * d'empilement du <header> (backdrop-blur) et passe SOUS la carte MapLibre.
 */
export function Modal({ onClose, children, size = "sm", className, labelledBy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "animate-modal-in w-full rounded-lg bg-bg p-6 text-ink shadow-[var(--shadow-overlay)] outline-none",
          SIZES[size],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
