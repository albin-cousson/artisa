"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

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
    "focus-ring rounded-sm text-left text-xs font-medium text-muted underline underline-offset-2 hover:text-ink";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(base, className)}>
        {label}
      </button>
      {open && <GithubStarModal onClose={() => setOpen(false)} />}
    </>
  );
}

function GithubStarModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} labelledBy="github-star-title">
      <div className="flex items-start justify-between gap-4">
        <h2 id="github-star-title" className="text-lg font-semibold">
          Soutiens Artisa ⭐
        </h2>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="focus-ring -mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-ink/5"
        >
          ✕
        </button>
      </div>

      <p className="mt-3 text-sm text-ink">
        Artisa est gratuit et open source. Mettre une <strong>étoile</strong> au projet sur
        GitHub m&apos;aiderait énormément à le faire connaître et à continuer de l&apos;améliorer.
        Merci beaucoup ! 🙏
      </p>

      <div className="mt-4 rounded-md border border-border bg-surface p-3 text-xs text-muted">
        <p className="font-medium text-ink">Comment faire ?</p>
        <p className="mt-1">
          GitHub ne permet pas de voter en un seul lien. Sur la page du dépôt, clique sur le
          bouton <span className="font-semibold">★ Star</span> en haut à droite (il faut être
          connecté à ton compte GitHub — c&apos;est gratuit).
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Plus tard
        </button>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          Ouvrir GitHub ⭐
        </a>
      </div>
    </Modal>
  );
}
