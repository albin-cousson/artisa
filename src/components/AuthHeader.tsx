"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ApiKeyHelpButton } from "@/components/ApiKeyHelpModal";
import { GithubStarButton } from "@/components/GithubStarButton";
import { QuotaBadge } from "@/components/QuotaBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, buttonVariants } from "@/components/ui/Button";

const SECONDARY = buttonVariants({ variant: "secondary", size: "sm" });
// Ligne de menu déroulant (mobile) : pleine largeur, cible tactile ≥ 44px.
const MENU_ITEM =
  "focus-ring flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ink/5";

export function AuthHeader() {
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <header className="relative z-20 flex items-center justify-between border-b border-border bg-bg/90 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <span className="text-lg font-semibold tracking-tight">Artisa</span>
      <div className="flex items-center gap-2 text-sm sm:gap-3">
        <ThemeToggle />
        {loading ? null : user ? (
          <>
            {/* Desktop : actions à plat */}
            <div className="hidden items-center gap-3 sm:flex">
              <span className="text-muted">{user.email}</span>
              <QuotaBadge />
              <ApiKeyHelpButton
                includeSetup={false}
                label="Aide & quotas"
                buttonClassName={SECONDARY}
              />
              <GithubStarButton buttonClassName={SECONDARY} className="text-sm" />
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Se déconnecter
              </Button>
            </div>
            {/* Mobile : repli dans un menu compte */}
            <div className="sm:hidden">
              <AccountMenu email={user.email ?? ""} onSignOut={handleSignOut} />
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Se connecter
            </Link>
            <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Créer un compte
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

// Menu compte mobile : un bouton « … » ouvre un panneau avec l'email et les
// actions secondaires (aide, GitHub, déconnexion), qui débordent sinon la barre
// sur petit écran.
//
// Le panneau (backdrop + popover) est porté sur <body> via createPortal, comme
// Modal : le <header> a `backdrop-blur`, qui crée un contexte d'empilement CSS
// ET devient le containing block de tout descendant `position: fixed`. Sans le
// portal, le popover reste piégé dans ce contexte et se peint SOUS la carte
// MapLibre (peinte après le header dans le DOM) malgré son z-index — le clic
// fonctionne, mais rien n'est visible. Le portal évite complètement le piège.
function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
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
        aria-label="Menu du compte"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-ink transition-colors hover:bg-primary-wash/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent coarse:h-11 coarse:w-11"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {open &&
        anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop invisible : ferme au tap/clic extérieur via un
                événement React normal, fiable sur tous les navigateurs. */}
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
            />
            <div
              role="menu"
              style={{ top: anchor.top, right: anchor.right }}
              className="fixed z-50 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg p-1 shadow-[var(--shadow-popover)]"
            >
              <p className="truncate px-3 py-2 text-xs text-muted" title={email}>
                {email}
              </p>
              <div className="px-3 py-1">
                <QuotaBadge />
              </div>
              <div className="my-1 h-px bg-border" />
              <ApiKeyHelpButton
                includeSetup={false}
                label="Aide & quotas"
                buttonClassName={MENU_ITEM}
              />
              <GithubStarButton label="★ GitHub" buttonClassName={MENU_ITEM} />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className={MENU_ITEM}
              >
                Se déconnecter
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
