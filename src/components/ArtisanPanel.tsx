"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import type { ArtisanWithRating, CommuneProperties } from "@/lib/types";
import { SmileyBadge } from "@/components/SmileyBadge";
import { ReviewForm } from "@/components/ReviewForm";
import { LoginPromptModal } from "@/components/LoginPromptModal";

interface ArtisanPanelProps {
  commune: CommuneProperties;
  onClose: () => void;
}

export function ArtisanPanel({ commune, onClose }: ArtisanPanelProps) {
  const { user } = useAuth();
  const [artisans, setArtisans] = useState<ArtisanWithRating[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
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

  function handleLeaveReviewClick(artisanId: string) {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    setReviewTargetId(artisanId);
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
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{artisan.display_name}</span>
              <SmileyBadge rating={artisan.rating} />
            </div>

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

            {reviewTargetId === artisan.id ? (
              <ReviewForm artisanId={artisan.id} onDone={() => setReviewTargetId(null)} />
            ) : (
              <button
                onClick={() => handleLeaveReviewClick(artisan.id)}
                className="mt-2 rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Laisser un avis
              </button>
            )}
          </div>
        ))}
      </div>

      {showLoginPrompt && (
        <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />
      )}
    </aside>
  );
}
