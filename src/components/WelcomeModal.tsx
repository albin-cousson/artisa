"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Pop-up de bienvenue affichée après une inscription réussie. Déclenchée par le
// flag `?welcome=1` posé par la page signup, qu'on retire de l'URL à l'ouverture
// pour qu'un rafraîchissement ne la réaffiche pas.
export function WelcomeModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      setOpen(true);
      router.replace("/");
    }
  }, [searchParams, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">🎉</div>
        <h2 className="mt-3 text-lg font-semibold">Félicitations&nbsp;!</h2>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Ton compte a été créé avec succès. Clique sur une commune pour découvrir ses artisans.
        </p>
        <button
          onClick={() => setOpen(false)}
          className="mt-4 w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black"
        >
          Commencer
        </button>
      </div>
    </div>
  );
}
