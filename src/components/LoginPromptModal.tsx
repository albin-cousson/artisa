"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button, buttonVariants } from "@/components/ui/Button";

interface LoginPromptModalProps {
  onClose: () => void;
}

export function LoginPromptModal({ onClose }: LoginPromptModalProps) {
  return (
    <Modal onClose={onClose} labelledBy="login-prompt-title">
      <h2 id="login-prompt-title" className="text-lg font-semibold">
        Connecte-toi pour voir les artisans
      </h2>
      <p className="mt-2 text-sm text-muted">
        Voir les artisans d&apos;une commune demande un compte. C&apos;est gratuit : il te
        suffit d&apos;ajouter ta propre clé Google Places.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Link href="/signup" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Créer un compte
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Se connecter
        </Link>
      </div>
    </Modal>
  );
}
