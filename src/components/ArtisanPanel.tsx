"use client";

import { useCallback, useEffect, useState } from "react";
import type { Artisan, CommuneProperties } from "@/lib/types";
import { recordViewedCommune } from "@/actions/communes";
import { isMobilePhone } from "@/lib/phone";
import { notifyQuotaUpdated } from "@/lib/quota";

interface ArtisanPanelProps {
  commune: CommuneProperties;
  onClose: () => void;
  /** État "déjà appelé" partagé avec "Mes artisans" (voir useCalledArtisans). */
  calledIds: Set<string>;
  togglingId: string | null;
  onMarkCalledIds: (artisanIds: string[]) => void;
  onToggleCalled: (artisanId: string, called: boolean) => void;
}

// Suppose que l'utilisateur est connecté : CommunesMap n'ouvre ce panneau
// qu'après vérification de la session (sinon LoginPromptModal).
export function ArtisanPanel({
  commune,
  onClose,
  calledIds,
  togglingId,
  onMarkCalledIds,
  onToggleCalled,
}: ArtisanPanelProps) {
  const [artisans, setArtisans] = useState<Artisan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [mobileOnly, setMobileOnly] = useState(false);

  // Liste affichée : filtrée aux mobiles (06/07) quand la case est cochée.
  const visibleArtisans =
    artisans === null
      ? null
      : mobileOnly
        ? artisans.filter((artisan) => isMobilePhone(artisan.national_phone_number))
        : artisans;

  const loadArtisans = useCallback(() => {
    setArtisans(null);
    setError(null);
    setNotice(null);

    const params = new URLSearchParams({
      code: commune.code,
      lat: String(commune.lat),
      lng: String(commune.lng),
    });

    fetch(`/api/places?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setArtisans(data.artisans);
        setNotice(data.quotaNotice ?? null);
        setQuota(data.quota ?? null);
        if (data.quota) notifyQuotaUpdated(data.quota);
      })
      .catch(() =>
        setError("Impossible de charger les artisans. Vérifie ta connexion, puis rouvre la commune."),
      );
  }, [commune.code, commune.lat, commune.lng]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial : les setState passent le state en "chargement" avant la réponse réseau
    loadArtisans();
  }, [loadArtisans]);

  useEffect(() => {
    if (!artisans) return;
    recordViewedCommune(commune);
    if (artisans.length === 0) return;
    onMarkCalledIds(artisans.map((artisan) => artisan.id));
    // onMarkCalledIds vient de useCalledArtisans (identité stable, useCallback
    // sans dépendances) : l'omettre évite de re-fetcher à chaque re-render de
    // CommunesMap sans jamais rater un changement réel de commune/artisans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisans, commune]);

  return (
    <aside className="animate-panel-in absolute right-0 top-0 z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-bg text-ink shadow-[var(--shadow-overlay)]">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-bg px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{commune.nom}</h2>
          <p className="font-mono text-xs text-muted tabular">
            {commune.codePostal ?? commune.code}
            {commune.population ? ` · ${commune.population.toLocaleString("fr-FR")} hab.` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="focus-ring inline-flex items-center rounded-md px-3 py-1.5 text-sm text-ink hover:bg-ink/5 coarse:min-h-11"
        >
          Fermer
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Artisans sans site web repérés :</p>
          {artisans && artisans.length > 0 && (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                className="accent-[var(--primary-strong)]"
                checked={mobileOnly}
                onChange={(e) => setMobileOnly(e.target.checked)}
              />
              Mobiles (06/07)
            </label>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {!error && notice && <p className="text-sm text-accent">{notice}</p>}

        {!error && artisans === null && (
          <p className="text-sm text-muted">Recherche des artisans…</p>
        )}

        {artisans?.length === 0 && (
          <p className="text-sm text-muted">
            Aucun artisan sans site web ici pour le moment. Tente une commune voisine.
          </p>
        )}

        {artisans && artisans.length > 0 && visibleArtisans?.length === 0 && (
          <p className="text-sm text-muted">
            Aucun mobile (06/07) ici. Décoche le filtre pour voir aussi les numéros fixes.
          </p>
        )}

        {visibleArtisans?.map((artisan) => {
          const called = calledIds.has(artisan.id);
          return (
            <div
              key={artisan.id}
              className={
                called
                  ? "rounded-lg border border-success-ink/20 bg-success-wash p-3"
                  : "rounded-lg border border-border p-3"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{artisan.display_name}</span>
                {called && (
                  <span className="shrink-0 rounded-full bg-success-wash px-2 py-0.5 text-xs font-medium text-success-ink">
                    Déjà appelé
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-col gap-0.5 text-sm">
                {artisan.national_phone_number && (
                  <a
                    href={`tel:${artisan.national_phone_number}`}
                    className="font-mono text-ink tabular hover:underline"
                  >
                    {artisan.national_phone_number}
                  </a>
                )}
                {artisan.google_maps_uri && (
                  <a
                    href={artisan.google_maps_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Voir la fiche Google
                  </a>
                )}
              </div>

              <label className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  className="accent-[var(--primary-strong)]"
                  checked={called}
                  disabled={togglingId === artisan.id}
                  onChange={(e) => onToggleCalled(artisan.id, e.target.checked)}
                />
                Déjà appelé
              </label>
            </div>
          );
        })}

        {notice &&
          (() => {
            const remaining = quota ? quota.limit - quota.used : null;
            const quotaExhausted = remaining !== null && remaining <= 0;
            return (
              <button
                type="button"
                onClick={loadArtisans}
                disabled={quotaExhausted}
                className="focus-ring mt-1 inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent coarse:min-h-11"
              >
                {quotaExhausted ? "Quota atteint" : "Charger le reste"}
              </button>
            );
          })()}
      </div>
    </aside>
  );
}
