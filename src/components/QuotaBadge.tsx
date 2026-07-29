"use client";

import { useEffect, useState } from "react";
import { getQuotaStatus, setDailyQuotaLimit } from "@/actions/quota";
import { DEFAULT_DAILY_QUOTA, QUOTA_UPDATED_EVENT, type QuotaStatus } from "@/lib/quota";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/**
 * Badge "toujours visible" du quota Google restant aujourd'hui (voir
 * GOOGLE-PLACES-QUOTAS.md). Cliquer ouvre le réglage de la limite
 * journalière, par défaut 33 mais personnalisable par compte.
 */
export function QuotaBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getQuotaStatus().then(setStatus);
  }, []);

  // Rafraîchi en instantané quand /api/places consomme du quota (ArtisanPanel),
  // sans recharger la page ni re-fetcher via une action serveur.
  useEffect(() => {
    function onUpdate(e: Event) {
      setStatus((e as CustomEvent<QuotaStatus>).detail);
    }
    window.addEventListener(QUOTA_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(QUOTA_UPDATED_EVENT, onUpdate);
  }, []);

  if (!status) return null;

  const remaining = Math.max(0, status.limit - status.used);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Quota Google Places restant aujourd'hui"
        className={cn(
          "focus-ring inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium tabular",
          remaining === 0 ? "border-danger/30 text-danger" : "text-muted hover:text-ink",
          className,
        )}
      >
        {remaining}/{status.limit} auj.
      </button>
      {open && (
        <QuotaSettingsModal
          status={status}
          onClose={() => setOpen(false)}
          onSaved={(limit) => setStatus((prev) => (prev ? { ...prev, limit } : prev))}
        />
      )}
    </>
  );
}

function QuotaSettingsModal({
  status,
  onClose,
  onSaved,
}: {
  status: QuotaStatus;
  onClose: () => void;
  onSaved: (limit: number) => void;
}) {
  const [value, setValue] = useState(String(status.limit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setDailyQuotaLimit(Number(value));
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(Math.floor(Number(value)));
    onClose();
  }

  return (
    <Modal onClose={onClose} size="sm" labelledBy="quota-settings-title">
      <h2 id="quota-settings-title" className="text-base font-semibold">
        Quota Google quotidien
      </h2>
      <p className="mt-2 text-sm text-muted">
        Utilisé aujourd&apos;hui : <strong>{status.used}</strong>. Restant :{" "}
        <strong>{Math.max(0, status.limit - status.used)}</strong>.
      </p>

      <label className="mt-4 block text-sm font-medium text-ink">
        Limite journalière
        <Input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1"
        />
      </label>

      <p className="mt-2 text-xs text-muted">
        Valeur par défaut recommandée : {DEFAULT_DAILY_QUOTA}, pour rester dans la franchise
        gratuite mensuelle de Google. Modifiable si tu as réglé une autre limite dans la console
        Google Cloud (APIs &amp; Services → Places API (New) → Quotas → GetPlaceRequest).
      </p>
      <p className="mt-2 text-xs text-danger">
        Attention : dépasser cette valeur peut ne pas être gratuit. Même si la communauté rend
        Artisa gratuit pour la plupart des communes, il se peut que ta commune ou ses artisans ne
        soient pas encore enregistrés dans la base communautaire — dans ce cas, chaque nouvelle
        recherche consomme réellement ton propre quota Google.
      </p>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Modal>
  );
}
