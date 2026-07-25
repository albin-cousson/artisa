// Registre des modes de recherche d'artisans : source unique pour l'UI
// (sélecteur + badge) et pour la validation côté API (/api/places).
export interface ArtisanModeDef {
  id: string;
  icon: string;
  label: string;
  /** Affiché dans le sélecteur pour expliquer ce que montre le mode. */
  description: string;
}

export const ARTISAN_MODES = [
  {
    id: "no_website",
    icon: "🚫",
    label: "Sans site web",
    description: "Artisans qui n'ont pas de site du tout — le mode par défaut d'Artisa.",
  },
  {
    id: "site_down",
    icon: "🔴",
    label: "Site down",
    description: "Artisans qui ont un site, mais inaccessible (erreur, timeout).",
  },
  {
    id: "non_responsive",
    icon: "📴",
    label: "Non responsive",
    description: "Artisans dont le site est en ligne mais pas adapté mobile.",
  },
] as const satisfies readonly ArtisanModeDef[];

export type ArtisanModeId = (typeof ARTISAN_MODES)[number]["id"];

export const DEFAULT_MODE_ID: ArtisanModeId = "no_website";

export function isArtisanModeId(value: string): value is ArtisanModeId {
  return ARTISAN_MODES.some((mode) => mode.id === value);
}

export function getArtisanMode(id: string): ArtisanModeDef {
  return ARTISAN_MODES.find((mode) => mode.id === id) ?? ARTISAN_MODES[0];
}
