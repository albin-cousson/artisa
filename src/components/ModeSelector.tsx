"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTISAN_MODES } from "@/lib/artisanModes";
import { useArtisanMode } from "@/lib/modeContext";
import { cn } from "@/lib/cn";

/**
 * Sélecteur de mode de recherche, toujours visible : le bouton lui-même sert
 * d'indicateur (icône + libellé du mode actif), cliquer ouvre la liste des
 * modes disponibles (voir src/lib/artisanModes.ts pour le registre).
 */
export function ModeSelector({ buttonClassName }: { buttonClassName?: string }) {
  const { mode, setMode } = useArtisanMode();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const current = ARTISAN_MODES.find((m) => m.id === mode) ?? ARTISAN_MODES[0];

  useEffect(() => {
    if (!open) return;

    function updateAnchor() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    updateAnchor();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateAnchor);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateAnchor);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Mode de recherche"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5",
          buttonClassName,
        )}
      >
        <span aria-hidden="true">{current.icon}</span>
        {current.label}
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open &&
        anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
            />
            <div
              role="menu"
              style={{ top: anchor.top, right: anchor.right }}
              className="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg p-1 shadow-[var(--shadow-popover)]"
            >
              {ARTISAN_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m.id === mode}
                  onClick={() => {
                    setMode(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "focus-ring flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-ink/5",
                    m.id === mode && "bg-primary-wash/60",
                  )}
                >
                  <span className="text-sm font-medium text-ink">
                    <span aria-hidden="true">{m.icon}</span> {m.label}
                  </span>
                  <span className="text-xs text-muted">{m.description}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
