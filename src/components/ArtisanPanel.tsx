"use client";

import { useCallback, useEffect, useState } from "react";
import type { Artisan, CommuneProperties } from "@/lib/types";
import { recordViewedCommune } from "@/actions/communes";
import { getCalledArtisanIds, setArtisanCalled } from "@/actions/calls";

interface ArtisanPanelProps {
  commune: CommuneProperties;
  onClose: () => void;
}

// Suppose que l'utilisateur est connecté : CommunesMap n'ouvre ce panneau
// qu'après vérification de la session (sinon LoginPromptModal).
export function ArtisanPanel({ commune, onClose }: ArtisanPanelProps) {
  const [artisans, setArtisans] = useState<Artisan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [togglingCalledId, setTogglingCalledId] = useState<string | null>(null);

  const loadArtisans = useCallback(() => {
    setArtisans(null);
    setError(null);

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
      })
      .catch(() => setError("Impossible de charger les artisans."));
  }, [commune.code, commune.lat, commune.lng]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch initial : les setState passent le state en "chargement" avant la réponse réseau
    loadArtisans();
  }, [loadArtisans]);

  useEffect(() => {
    if (!artisans) return;
    recordViewedCommune(commune);
    if (artisans.length === 0) return;
    const ids = artisans.map((artisan) => artisan.id);
    getCalledArtisanIds(ids).then((calledIds) => setCalledIds(new Set(calledIds)));
  }, [artisans, commune]);

  function handleToggleCalled(artisanId: string, called: boolean) {
    setTogglingCalledId(artisanId);
    setArtisanCalled(artisanId, called).then((result) => {
      setTogglingCalledId(null);
      if (result.error) return;
      setCalledIds((prev) => {
        const next = new Set(prev);
        if (called) next.add(artisanId);
        else next.delete(artisanId);
        return next;
      });
    });
  }

  return (
    <aside className="absolute right-0 top-0 z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold">{commune.nom}</h2>
          <p className="text-xs text-black/50 dark:text-white/50">
            {commune.codePostal ?? commune.code}
            {commune.population ? ` · ${commune.population.toLocaleString("fr-FR")} hab.` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          Fermer
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Artisans sans site web repérés dans cette commune :
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!error && artisans === null && (
          <p className="text-sm text-black/50 dark:text-white/50">Recherche en cours...</p>
        )}

        {artisans?.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aucun artisan sans site web trouvé ici pour l&apos;instant.
          </p>
        )}

        {artisans?.map((artisan) => (
          <div
            key={artisan.id}
            className="rounded-lg border border-black/10 p-3 dark:border-white/10"
          >
            <span className="font-medium">{artisan.display_name}</span>

            <div className="mt-1 flex flex-col gap-0.5 text-sm text-black/70 dark:text-white/70">
              {artisan.national_phone_number && (
                <a href={`tel:${artisan.national_phone_number}`} className="hover:underline">
                  {artisan.national_phone_number}
                </a>
              )}
              {artisan.google_maps_uri && (
                <a
                  href={artisan.google_maps_uri}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Voir la fiche Google
                </a>
              )}
            </div>

            <label className="mt-2 flex items-center gap-1.5 text-xs text-black/70 dark:text-white/70">
              <input
                type="checkbox"
                checked={calledIds.has(artisan.id)}
                disabled={togglingCalledId === artisan.id}
                onChange={(e) => handleToggleCalled(artisan.id, e.target.checked)}
              />
              Déjà appelé
            </label>
          </div>
        ))}
      </div>
    </aside>
  );
}
