"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const GITHUB_REPO_URL = "https://github.com/albin-cousson/artisa";

/**
 * Bouton "★ GitHub" + modale de remerciement.
 * On ouvre une modale (plutôt qu'un lien direct) car GitHub ne permet pas de
 * mettre une étoile via une simple URL : l'utilisateur doit cliquer le bouton
 * « Star » sur la page du dépôt (et être connecté à GitHub). La modale explique
 * donc où cliquer avant de rediriger.
 */
export function GithubStarButton({
  className = "",
  buttonClassName,
  label = "★ GitHub",
}: {
  className?: string;
  buttonClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const base =
    buttonClassName ??
    "text-left text-xs font-medium underline underline-offset-2 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${base} ${className}`}>
        {label}
      </button>
      {open && <GithubStarModal onClose={() => setOpen(false)} />}
    </>
  );
}

function GithubStarModal({ onClose }: { onClose: () => void }) {
  // Portal vers <body> pour passer au-dessus de la carte MapLibre.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Soutiens Artisa ⭐</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-black/70 dark:text-white/70">
          Artisa est gratuit et open source. Mettre une <strong>étoile</strong> au projet sur
          GitHub m&apos;aiderait énormément à le faire connaître et à continuer de l&apos;améliorer.
          Merci beaucoup ! 🙏
        </p>

        <div className="mt-4 rounded-md border border-black/10 bg-black/[0.02] p-3 text-xs text-black/60 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/60">
          <p className="font-medium text-black/70 dark:text-white/70">Comment faire ?</p>
          <p className="mt-1">
            GitHub ne permet pas de voter en un seul lien. Sur la page du dépôt, clique sur le
            bouton <span className="font-semibold">★ Star</span> en haut à droite (il faut être
            connecté à ton compte GitHub — c&apos;est gratuit).
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Plus tard
          </button>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black"
          >
            Ouvrir GitHub ⭐
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
