"use client";

import Link from "next/link";

interface LoginPromptModalProps {
  onClose: () => void;
}

export function LoginPromptModal({ onClose }: LoginPromptModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Connecte-toi pour laisser un avis</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Les avis sont réservés aux membres de la communauté pour garder des évaluations
          fiables. Connecte-toi ou crée un compte gratuitement.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Annuler
          </button>
          <Link
            href="/signup"
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Créer un compte
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
