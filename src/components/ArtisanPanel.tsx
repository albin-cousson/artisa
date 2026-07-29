"use client";

import { useCallback, useEffect, useState } from "react";
import type { Artisan, CommuneProperties } from "@/lib/types";
import { recordViewedCommune } from "@/actions/communes";
import { isMobilePhone } from "@/lib/phone";
import { notifyQuotaUpdated } from "@/lib/quota";
import { useArtisanMode } from "@/lib/modeContext";
import { getArtisanMode } from "@/lib/artisanModes";
import { getSignalSummary, getTargetReason } from "@/lib/artisanDiagnostics";
import { cn } from "@/lib/cn";

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
  const [query, setQuery] = useState("");
  const [expandedDiagnosticId, setExpandedDiagnosticId] = useState<string | null>(null);
  const { mode } = useArtisanMode();
  const modeDef = getArtisanMode(mode);

  // Liste affichée : filtrée par nom recherché et/ou aux mobiles (06/07).
  const visibleArtisans =
    artisans === null
      ? null
      : artisans.filter((artisan) => {
          if (mobileOnly && !isMobilePhone(artisan.national_phone_number)) return false;
          if (query.trim() && !artisan.display_name.toLowerCase().includes(query.trim().toLowerCase()))
            return false;
          return true;
        });

  const loadArtisans = useCallback(() => {
    setArtisans(null);
    setError(null);
    setNotice(null);
    setQuery("");

    const params = new URLSearchParams({
      code: commune.code,
      lat: String(commune.lat),
      lng: String(commune.lng),
      mode,
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
  }, [commune.code, commune.lat, commune.lng, mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)fetch : les setState passent le state en "chargement" avant la réponse réseau, y compris quand le mode change
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
          <p className="text-sm text-muted">
            <span aria-hidden="true">{modeDef.icon}</span> Artisans « {modeDef.label} » repérés :
          </p>
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

        {artisans && artisans.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un artisan par nom…"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-bg p-3">
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={loadArtisans}
              className="focus-ring shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5"
            >
              Réessayer
            </button>
          </div>
        )}
        {!error && notice && <p className="text-sm text-accent">{notice}</p>}

        {!error && artisans === null && (
          <p className="text-sm text-muted">Recherche des artisans…</p>
        )}

        {artisans?.length === 0 && (
          <p className="text-sm text-muted">
            Aucun artisan « {modeDef.label} » ici pour le moment. Tente une commune voisine.
          </p>
        )}

        {artisans && artisans.length > 0 && visibleArtisans?.length === 0 && (
          <p className="text-sm text-muted">
            Aucun mobile (06/07) ici. Décoche le filtre pour voir aussi les numéros fixes.
          </p>
        )}

        {visibleArtisans?.map((artisan) => {
          const called = calledIds.has(artisan.id);
          const diagnosticOpen = expandedDiagnosticId === artisan.id;
          const signals = artisan.siteCheck ? getSignalSummary(artisan.siteCheck) : null;
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

              <p className="mt-1 text-xs text-muted">{getTargetReason(mode, artisan)}</p>

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

              {signals && (
                <button
                  type="button"
                  onClick={() => setExpandedDiagnosticId(diagnosticOpen ? null : artisan.id)}
                  className="focus-ring mt-1.5 text-xs font-medium text-accent hover:underline"
                >
                  {diagnosticOpen ? "Masquer le détail ▲" : "Voir le détail du diagnostic ▼"}
                </button>
              )}

              {signals && diagnosticOpen && (
                <ul className="mt-1.5 flex flex-col gap-1 rounded-md border border-border bg-bg p-2">
                  {signals.map((signal) => (
                    <li key={signal.key} className="flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden="true"
                        className={cn(
                          signal.status === "ok" && "text-success-ink",
                          signal.status === "issue" && "text-danger",
                          signal.status === "unknown" && "text-muted",
                        )}
                      >
                        {signal.status === "ok" ? "✓" : signal.status === "issue" ? "✗" : "?"}
                      </span>
                      <span className="text-ink">{signal.label}</span>
                    </li>
                  ))}
                </ul>
              )}

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
