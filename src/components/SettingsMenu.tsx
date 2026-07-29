"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AccountSettingsModal } from "@/components/AccountSettingsModal";
import { GithubStarButton } from "@/components/GithubStarButton";

const MENU_ITEM =
  "focus-ring flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ink/5";

/**
 * Bouton "Réglages" déroulant du header (desktop). Un seul item aujourd'hui
 * ("Compte"), structuré en dropdown pour accueillir d'autres réglages plus
 * tard sans redesign. Même pattern portal/ancrage que AccountMenu — voir son
 * commentaire dans AuthHeader.tsx sur pourquoi le portal est nécessaire.
 */
export function SettingsMenu({ buttonClassName }: { buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

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
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClassName}
      >
        Réglages <span className="text-muted">{open ? "▲" : "▼"}</span>
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
              className="fixed z-50 w-48 rounded-lg border border-border bg-bg p-1 shadow-[var(--shadow-popover)]"
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowAccountModal(true);
                }}
                className={MENU_ITEM}
              >
                Compte
              </button>
              <GithubStarButton label="★ GitHub" buttonClassName={MENU_ITEM} />
            </div>
          </>,
          document.body,
        )}

      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}
    </>
  );
}
