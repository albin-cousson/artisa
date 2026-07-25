"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { updateGoogleApiKey, updatePassword, deleteAccount } from "@/actions/account";
import { ApiKeyHelpButton } from "@/components/ApiKeyHelpModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type FieldMessage = { type: "error" | "success"; text: string } | null;

export function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();

  const [apiKey, setApiKey] = useState((user?.user_metadata?.google_places_api_key as string) ?? "");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState<FieldMessage>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<FieldMessage>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSaveApiKey() {
    setApiKeySaving(true);
    setApiKeyMessage(null);

    // Même validation qu'à l'inscription (src/app/signup/page.tsx) : on
    // n'enregistre jamais une clé sans l'avoir vérifiée auprès de Google.
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const result = (await res.json()) as { valid: boolean; error?: string };
      if (!result.valid) {
        setApiKeySaving(false);
        setApiKeyMessage({ type: "error", text: result.error ?? "Clé Google Places invalide." });
        return;
      }
    } catch {
      setApiKeySaving(false);
      setApiKeyMessage({ type: "error", text: "Impossible de vérifier la clé pour le moment. Réessaie." });
      return;
    }

    const result = await updateGoogleApiKey(apiKey);
    setApiKeySaving(false);
    setApiKeyMessage(
      result.error ? { type: "error", text: result.error } : { type: "success", text: "Clé enregistrée." }
    );
  }

  async function handleSavePassword() {
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Les deux mots de passe ne correspondent pas." });
      return;
    }

    setPasswordSaving(true);
    const result = await updatePassword(newPassword);
    setPasswordSaving(false);

    if (result.error) {
      setPasswordMessage({ type: "error", text: result.error });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage({ type: "success", text: "Mot de passe modifié." });
  }

  return (
    <>
      <Modal
        onClose={onClose}
        size="md"
        className="max-h-[85vh] overflow-y-auto"
        labelledBy="account-settings-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="account-settings-title" className="text-lg font-semibold">
            Mon compte
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="focus-ring -mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-ink/5"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm text-muted">{user?.email}</p>

        <section className="mt-5">
          <h3 className="text-sm font-semibold">Clé API Google Places</h3>
          <Input
            mono
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-2"
          />
          <ApiKeyHelpButton className="mt-1" includeSetup={false} label="Aide & quotas" />
          {apiKeyMessage && (
            <p className={`mt-2 text-sm ${apiKeyMessage.type === "error" ? "text-danger" : "text-success-ink"}`}>
              {apiKeyMessage.text}
            </p>
          )}
          <Button
            size="sm"
            onClick={handleSaveApiKey}
            disabled={apiKeySaving || !apiKey.trim()}
            className="mt-3"
          >
            {apiKeySaving ? "Vérification…" : "Enregistrer la clé"}
          </Button>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Mot de passe</h3>
          <div className="mt-2 flex flex-col gap-2">
            <Input
              type="password"
              placeholder="Nouveau mot de passe"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirme le mot de passe"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {passwordMessage && (
            <p className={`mt-2 text-sm ${passwordMessage.type === "error" ? "text-danger" : "text-success-ink"}`}>
              {passwordMessage.text}
            </p>
          )}
          <Button
            size="sm"
            onClick={handleSavePassword}
            disabled={passwordSaving || newPassword.length < 6}
            className="mt-3"
          >
            {passwordSaving ? "Modification…" : "Modifier le mot de passe"}
          </Button>
        </section>

        <section className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-danger">Zone dangereuse</h3>
          <p className="mt-2 text-xs text-muted">
            Supprime définitivement ton compte et tout ce qui t&apos;est lié (communes vues,
            artisans marqués appelés, quota). Les artisans et communes restent dans la base
            partagée pour les autres utilisateurs.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="focus-ring mt-3 rounded-md border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          >
            Supprimer mon compte
          </button>
        </section>
      </Modal>

      {showDeleteConfirm && (
        <DeleteAccountModal
          onClose={() => setShowDeleteConfirm(false)}
          onDeleted={() => {
            router.push("/");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount(password);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <Modal onClose={onClose} size="sm" labelledBy="delete-account-title">
      <h2 id="delete-account-title" className="text-base font-semibold text-danger">
        Supprimer définitivement ton compte ?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Cette action est irréversible. Retape ton mot de passe pour confirmer.
      </p>
      <Input
        type="password"
        autoFocus
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-3"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <button
          onClick={handleDelete}
          disabled={deleting || !password}
          className="focus-ring inline-flex items-center justify-center rounded-md bg-danger px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {deleting ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </Modal>
  );
}
