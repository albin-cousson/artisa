"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

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
    <Modal onClose={() => setOpen(false)} className="text-center" labelledBy="welcome-title">
      <div className="text-4xl">🎉</div>
      <h2 id="welcome-title" className="mt-3 text-lg font-semibold">
        Bienvenue sur Artisa
      </h2>
      <p className="mt-2 text-sm text-muted">
        Ton compte est prêt. Clique sur une commune pour voir ses artisans à démarcher.
      </p>
      <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
        Commencer
      </Button>
    </Modal>
  );
}
