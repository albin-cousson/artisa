"use client";

import { useEffect, useRef, useState } from "react";
import type { Artisan, CommuneProperties } from "@/lib/types";
import { listViewedCommunes, removeViewedCommune } from "@/actions/communes";
import { isMobilePhone } from "@/lib/phone";
import { capitalize, normalizeForSearch } from "@/lib/text";
import { useArtisanMode } from "@/lib/modeContext";
import { getArtisanMode } from "@/lib/artisanModes";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type PendingRemoval =
  | { type: "commune"; communeCode: string; label: string }
  | { type: "artisan"; communeCode: string; artisanId: string; label: string };

// Les artisans d'une commune dépliée : chargés à la demande depuis /api/places
// (déjà cachés côté serveur, donc pas de nouvel appel Google) — tous ceux sans
// site web sont montrés, il n'y a plus de notion de déblocage partiel.
type CommuneArtisans = Artisan[] | "loading" | "error";

interface UnlockedArtisansMenuProps {
  onOpenCommune: (commune: CommuneProperties) => void;
  /** État "déjà appelé" partagé avec ArtisanPanel (voir useCalledArtisans). */
  calledIds: Set<string>;
  togglingId: string | null;
  onMarkCalledIds: (artisanIds: string[]) => void;
  onToggleCalled: (artisanId: string, called: boolean) => void;
}

export function UnlockedArtisansMenu({
  onOpenCommune,
  calledIds,
  togglingId,
  onMarkCalledIds,
  onToggleCalled,
}: UnlockedArtisansMenuProps) {
  const [open, setOpen] = useState(false);
  const [communes, setCommunes] = useState<CommuneProperties[]>([]);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [artisansByCommune, setArtisansByCommune] = useState<Record<string, CommuneArtisans>>({});
  const [mobileOnly, setMobileOnly] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [communeQuery, setCommuneQuery] = useState("");
  const [artisanQuery, setArtisanQuery] = useState("");
  const [modeChangeNotice, setModeChangeNotice] = useState<string | null>(null);
  const { mode } = useArtisanMode();
  const isFirstModeRender = useRef(true);

  // Les artisans déjà chargés correspondent au mode précédent : on les vide
  // et referme la commune dépliée, plutôt que d'afficher des résultats
  // périmés tant qu'on ne re-clique pas dessus. On prévient explicitement
  // l'utilisateur quand ça vide quelque chose, pour ne pas donner
  // l'impression d'une perte de données silencieuse.
  useEffect(() => {
    if (isFirstModeRender.current) {
      isFirstModeRender.current = false;
      return;
    }

    if (Object.keys(artisansByCommune).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resynchronise le cache local avec un changement externe (le mode global), pas une dérivation de state interne
      setModeChangeNotice("Mode changé — liste réactualisée.");
    }
    setArtisansByCommune({});
    setExpandedCode(null);
    // artisansByCommune volontairement absent des deps : on ne veut réagir
    // qu'au changement de mode, pas re-déclencher ce nettoyage à chaque mise
    // à jour du cache qu'il vient lui-même de produire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const visibleCommunes = communeQuery.trim()
    ? communes.filter((c) => normalizeForSearch(c.nom).includes(normalizeForSearch(communeQuery.trim())))
    : communes;

  function toggleMenu() {
    // La liste est relue à chaque ouverture : de nouvelles communes ont pu
    // être consultées depuis le panneau sans passer par ce composant.
    if (!open) listViewedCommunes().then(setCommunes);
    setOpen((value) => !value);
  }

  // Retire uniquement le lien user <-> commune : la commune et ses artisans
  // restent en cache partagé, toujours consultables gratuitement par
  // n'importe quel utilisateur (y compris celui-ci depuis la carte).
  function confirmRemoval() {
    if (!pendingRemoval) return;

    if (pendingRemoval.type === "commune") {
      removeViewedCommune(pendingRemoval.communeCode);
      setCommunes((prev) => prev.filter((c) => c.code !== pendingRemoval.communeCode));
    } else {
      // Retire uniquement le lien user <-> artisan ("déjà appelé") : l'artisan
      // reste dans le cache partagé de la commune, toujours consultable par tous.
      onToggleCalled(pendingRemoval.artisanId, false);
      setArtisansByCommune((prev) => {
        const current = prev[pendingRemoval.communeCode];
        if (!Array.isArray(current)) return prev;
        return {
          ...prev,
          [pendingRemoval.communeCode]: current.filter((a) => a.id !== pendingRemoval.artisanId),
        };
      });
    }

    setPendingRemoval(null);
  }

  function toggleCommune(commune: CommuneProperties) {
    setArtisanQuery("");
    setModeChangeNotice(null);

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
      mode,
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
        onMarkCalledIds(artisans.map((artisan) => artisan.id));
      })
      .catch(() => {
        setArtisansByCommune((prev) => ({ ...prev, [commune.code]: "error" }));
      });
  }

  return (
    <div className="absolute left-[max(1rem,env(safe-area-inset-left))] top-4 z-10 w-72 max-w-[calc(100%-2rem)]">
      <button
        onClick={toggleMenu}
        className="focus-ring flex w-full items-center justify-between rounded-lg border border-border bg-bg/95 px-3 py-2 text-sm font-medium text-ink shadow-[var(--shadow-popover)] backdrop-blur hover:bg-bg coarse:min-h-11"
      >
        <span aria-hidden="true">{getArtisanMode(mode).icon}</span> Mes artisans « {getArtisanMode(mode).label} »
        {open && communes.length > 0 ? ` (${communes.length})` : ""}
        <span className="text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-bg/95 text-ink shadow-[var(--shadow-popover)] backdrop-blur">
          {modeChangeNotice && (
            <p className="border-b border-border bg-primary-wash/40 px-3 py-2 text-xs text-ink">
              {modeChangeNotice}
            </p>
          )}

          {communes.length === 0 && (
            <p className="p-3 text-sm text-muted">
              Aucune commune consultée pour l&apos;instant. Clique sur un point de la carte pour
              commencer.
            </p>
          )}

          {communes.length > 0 && (
            <div className="sticky top-0 flex flex-col gap-2 border-b border-border bg-bg/95 p-3 backdrop-blur">
              <input
                type="search"
                value={communeQuery}
                onChange={(e) => setCommuneQuery(e.target.value)}
                placeholder="Chercher dans mes communes…"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  className="accent-[var(--primary-strong)]"
                  checked={mobileOnly}
                  onChange={(e) => setMobileOnly(e.target.checked)}
                />
                Mobiles uniquement (06/07)
              </label>
            </div>
          )}

          {communes.length > 0 && visibleCommunes.length === 0 && (
            <p className="p-3 text-sm text-muted">Aucune commune ne correspond à cette recherche.</p>
          )}

          {visibleCommunes.map((commune) => {
            const artisans = artisansByCommune[commune.code];
            const expanded = expandedCode === commune.code;

            return (
              <div key={commune.code} className="border-b border-border last:border-b-0">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    onClick={() => toggleCommune(commune)}
                    className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm font-medium hover:underline coarse:min-h-11"
                  >
                    <span className="text-xs text-muted">{expanded ? "▾" : "▸"}</span>
                    <span className="truncate">{commune.nom}</span>
                  </button>
                  <button
                    onClick={() => onOpenCommune(commune)}
                    className="focus-ring shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-primary-wash/60 coarse:min-h-9"
                  >
                    Ouvrir
                  </button>
                  <button
                    onClick={() =>
                      setPendingRemoval({
                        type: "commune",
                        communeCode: commune.code,
                        label: commune.nom,
                      })
                    }
                    aria-label={`Retirer ${commune.nom} de mes artisans`}
                    className="focus-ring shrink-0 rounded-md border border-border px-2 py-1.5 text-xs text-danger hover:bg-danger/10 coarse:min-h-9"
                  >
                    Retirer
                  </button>
                </div>

                {expanded && (
                  <div className="flex flex-col gap-1 px-3 pb-2 pl-8">
                    {artisans === "loading" && (
                      <p className="text-xs text-muted">Recherche des artisans…</p>
                    )}
                    {artisans === "error" && (
                      <p className="text-xs text-danger">Impossible de charger les artisans.</p>
                    )}
                    {Array.isArray(artisans) && artisans.length > 0 && (
                      <input
                        type="search"
                        value={artisanQuery}
                        onChange={(e) => setArtisanQuery(e.target.value)}
                        placeholder="Chercher un artisan par nom…"
                        className="mb-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                    )}
                    {Array.isArray(artisans) &&
                      (() => {
                        const shown = artisans.filter((a) => {
                          if (mobileOnly && !isMobilePhone(a.national_phone_number)) return false;
                          if (
                            artisanQuery.trim() &&
                            !normalizeForSearch(a.display_name).includes(normalizeForSearch(artisanQuery.trim()))
                          )
                            return false;
                          return true;
                        });

                        if (artisans.length === 0) {
                          return (
                            <p className="text-xs text-muted">
                              Aucun artisan « {getArtisanMode(mode).label} » ici.
                            </p>
                          );
                        }
                        if (shown.length === 0) {
                          return <p className="text-xs text-muted">Aucun artisan ne correspond à ce filtre.</p>;
                        }
                        return shown.map((artisan) => {
                          const called = calledIds.has(artisan.id);
                          return (
                            <div
                              key={artisan.id}
                              className={
                                called
                                  ? "rounded-md bg-success-wash px-1.5 py-1 text-xs"
                                  : "px-1.5 py-1 text-xs"
                              }
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <label className="flex min-w-0 items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    className="accent-[var(--primary-strong)]"
                                    checked={called}
                                    disabled={togglingId === artisan.id}
                                    onChange={(e) => onToggleCalled(artisan.id, e.target.checked)}
                                  />
                                  <span
                                    className={
                                      called
                                        ? "truncate font-medium text-success-ink"
                                        : "truncate font-medium"
                                    }
                                  >
                                    {artisan.display_name}
                                    {artisan.category && (
                                      <span className="font-normal text-muted"> · {capitalize(artisan.category)}</span>
                                    )}
                                  </span>
                                </label>
                                <button
                                  onClick={() =>
                                    setPendingRemoval({
                                      type: "artisan",
                                      communeCode: commune.code,
                                      artisanId: artisan.id,
                                      label: artisan.display_name,
                                    })
                                  }
                                  aria-label={`Retirer ${artisan.display_name} de mes artisans`}
                                  className="focus-ring shrink-0 text-muted hover:text-danger"
                                >
                                  Retirer
                                </button>
                              </div>
                              <div className="flex gap-3 pl-6">
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
                                    Fiche Google
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pendingRemoval && (
        <Modal
          onClose={() => setPendingRemoval(null)}
          size="sm"
          labelledBy="confirm-removal-title"
        >
          <h2 id="confirm-removal-title" className="text-base font-semibold">
            Retirer « {pendingRemoval.label} » de mes artisans ?
          </h2>
          <p className="mt-2 text-sm text-muted">
            {pendingRemoval.type === "commune"
              ? "Elle ne sera plus affichée dans « Mes artisans », mais reste consultable gratuitement par tout le monde, y compris toi depuis la carte."
              : "Il ne sera plus affiché dans « Mes artisans », mais reste consultable gratuitement par tout le monde dans cette commune."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingRemoval(null)}>
              Annuler
            </Button>
            <Button onClick={confirmRemoval}>Retirer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
