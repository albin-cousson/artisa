"use client";

import { useState } from "react";
import type { Artisan, CommuneProperties } from "@/lib/types";
import { listViewedCommunes } from "@/actions/communes";
import { getCalledArtisanIds } from "@/actions/calls";

// Les artisans d'une commune dépliée : chargés à la demande depuis /api/places
// (déjà cachés côté serveur, donc pas de nouvel appel Google) — tous ceux sans
// site web sont montrés, il n'y a plus de notion de déblocage partiel.
type CommuneArtisans = Artisan[] | "loading" | "error";

interface UnlockedArtisansMenuProps {
  onOpenCommune: (commune: CommuneProperties) => void;
}

export function UnlockedArtisansMenu({ onOpenCommune }: UnlockedArtisansMenuProps) {
  const [open, setOpen] = useState(false);
  const [communes, setCommunes] = useState<CommuneProperties[]>([]);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [artisansByCommune, setArtisansByCommune] = useState<Record<string, CommuneArtisans>>({});
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());

  function toggleMenu() {
    // La liste est relue à chaque ouverture : de nouvelles communes ont pu
    // être consultées depuis le panneau sans passer par ce composant.
    if (!open) listViewedCommunes().then(setCommunes);
    setOpen((value) => !value);
  }

  function toggleCommune(commune: CommuneProperties) {
    if (expandedCode === commune.code) {
      setExpandedCode(null);
      return;
    }
    setExpandedCode(commune.code);

    const current = artisansByCommune[commune.code];
    if (current && current !== "error") return;

    setArtisansByCommune((prev) => ({ ...prev, [commune.code]: "loading" }));

    const params = new URLSearchParams({
      code: commune.code,
      lat: String(commune.lat),
      lng: String(commune.lng),
    });

    fetch(`/api/places?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setArtisansByCommune((prev) => ({ ...prev, [commune.code]: "error" }));
          return;
        }
        const artisans = data.artisans as Artisan[];
        setArtisansByCommune((prev) => ({ ...prev, [commune.code]: artisans }));
        getCalledArtisanIds(artisans.map((artisan) => artisan.id)).then((ids) =>
          setCalledIds((prev) => new Set([...prev, ...ids]))
        );
      })
      .catch(() => {
        setArtisansByCommune((prev) => ({ ...prev, [commune.code]: "error" }));
      });
  }

  return (
    <div className="absolute left-4 top-4 z-10 w-72 max-w-[calc(100%-2rem)]">
      <button
        onClick={toggleMenu}
        className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-white/95 px-3 py-2 text-sm font-medium shadow-md backdrop-blur hover:bg-white dark:border-white/10 dark:bg-neutral-900/95 dark:hover:bg-neutral-900"
      >
        Mes artisans{open && communes.length > 0 ? ` (${communes.length})` : ""}
        <span className="text-black/50 dark:text-white/50">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-black/10 bg-white/95 shadow-md backdrop-blur dark:border-white/10 dark:bg-neutral-900/95">
          {communes.length === 0 && (
            <p className="p-3 text-sm text-black/50 dark:text-white/50">
              Aucune commune consultée pour l&apos;instant. Clique sur un point de la carte pour
              commencer.
            </p>
          )}

          {communes.map((commune) => {
            const artisans = artisansByCommune[commune.code];
            const expanded = expandedCode === commune.code;

            return (
              <div
                key={commune.code}
                className="border-b border-black/5 last:border-b-0 dark:border-white/5"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    onClick={() => toggleCommune(commune)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium hover:underline"
                  >
                    <span className="text-xs text-black/40 dark:text-white/40">
                      {expanded ? "▾" : "▸"}
                    </span>
                    <span className="truncate">{commune.nom}</span>
                  </button>
                  <button
                    onClick={() => onOpenCommune(commune)}
                    className="shrink-0 rounded-md border border-black/15 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                  >
                    Ouvrir
                  </button>
                </div>

                {expanded && (
                  <div className="flex flex-col gap-1 px-3 pb-2 pl-8">
                    {artisans === "loading" && (
                      <p className="text-xs text-black/50 dark:text-white/50">Chargement...</p>
                    )}
                    {artisans === "error" && (
                      <p className="text-xs text-red-600">Impossible de charger les artisans.</p>
                    )}
                    {Array.isArray(artisans) && artisans.length === 0 && (
                      <p className="text-xs text-black/50 dark:text-white/50">
                        Aucun artisan sans site web ici.
                      </p>
                    )}
                    {Array.isArray(artisans) &&
                      artisans.map((artisan) => (
                        <div key={artisan.id} className="text-xs">
                          <span className="flex items-center gap-1">
                            <span className="truncate font-medium">{artisan.display_name}</span>
                            {calledIds.has(artisan.id) && (
                              <span
                                title="Déjà appelé"
                                className="shrink-0 text-green-600 dark:text-green-500"
                              >
                                ☎✓
                              </span>
                            )}
                          </span>
                          <div className="flex gap-3 text-black/60 dark:text-white/60">
                            {artisan.national_phone_number && (
                              <a
                                href={`tel:${artisan.national_phone_number}`}
                                className="hover:underline"
                              >
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
                                Fiche Google
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
