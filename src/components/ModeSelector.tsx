"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTISAN_MODES, RELIABILITY_INFO, type ArtisanModeDef, type ArtisanModeId } from "@/lib/artisanModes";
import { useArtisanMode } from "@/lib/modeContext";
import { cn } from "@/lib/cn";

const PRIMARY_MODES = ARTISAN_MODES.filter((m) => m.tier === "primary");
const SECONDARY_MODES = ARTISAN_MODES.filter((m) => m.tier === "secondary");

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
              className="fixed z-50 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-bg p-1 shadow-[var(--shadow-popover)]"
            >
              <p className="px-3 pb-2 pt-1.5 text-xs text-muted">
                Fiabilité :{" "}
                {(["high", "medium", "low"] as const).map((level, i) => (
                  <span key={level}>
                    {i > 0 && " · "}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs font-medium",
                        RELIABILITY_INFO[level].pillClassName,
                      )}
                    >
                      {RELIABILITY_INFO[level].pillLabel}
                    </span>
                  </span>
                ))}
              </p>

              {PRIMARY_MODES.map((m) => (
                <ModeItem key={m.id} mode={m} active={m.id === mode} onSelect={setMode} onClose={() => setOpen(false)} />
              ))}

              <p className="mt-1 border-t border-border px-3 pb-1 pt-2 text-xs font-medium text-muted">
                Signaux techniques
              </p>
              {SECONDARY_MODES.map((m) => (
                <ModeItem key={m.id} mode={m} active={m.id === mode} onSelect={setMode} onClose={() => setOpen(false)} />
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function ModeItem({
  mode,
  active,
  onSelect,
  onClose,
}: {
  mode: ArtisanModeDef;
  active: boolean;
  onSelect: (id: ArtisanModeId) => void;
  onClose: () => void;
}) {
  const reliability = RELIABILITY_INFO[mode.reliability];

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={() => {
        onSelect(mode.id as ArtisanModeId);
        onClose();
      }}
      className={cn(
        "focus-ring flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-ink/5",
        active && "bg-primary-wash/60",
      )}
    >
      <span className="flex w-full items-center gap-1.5 text-sm font-medium text-ink">
        <span aria-hidden="true">{mode.icon}</span> {mode.label}
        <span
          title={reliability.explanation}
          className={cn(
            "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium",
            reliability.pillClassName,
          )}
        >
          {reliability.pillLabel}
        </span>
      </span>
      <span className="text-xs text-muted">{mode.description}</span>
    </button>
  );
}
