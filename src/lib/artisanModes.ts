export type ReliabilityLevel = "high" | "medium" | "low";

// Pastille tokenisée (voir DESIGN.md) plutôt qu'une couleur hors charte : vert
// succès existant pour "fiable", neutre bordé pour "heuristique" (pas de
// troisième couleur "warning" dans le design system), rouge danger existant
// pour "à vérifier".
export const RELIABILITY_INFO: Record<
  ReliabilityLevel,
  { pillLabel: string; pillClassName: string; label: string; explanation: string }
> = {
  high: {
    pillLabel: "Fiable",
    pillClassName: "bg-success-wash text-success-ink",
    label: "Fiabilité haute",
    explanation: "Détection directe (champ ou test binaire), très peu de faux positifs/négatifs.",
  },
  medium: {
    pillLabel: "Heuristique",
    pillClassName: "border border-border text-muted",
    label: "Fiabilité moyenne",
    explanation: "Détection heuristique (regex sur le site) : peut manquer des cas ou se tromper occasionnellement.",
  },
  low: {
    pillLabel: "À vérifier",
    pillClassName: "border border-danger/30 text-danger",
    label: "Fiabilité faible",
    explanation: "Signal indirect ou échantillon limité : à vérifier manuellement avant d'agir dessus.",
  },
};

// Registre des modes de recherche d'artisans : source unique pour l'UI
// (sélecteur + badge) et pour la validation/filtrage côté API (/api/places).
export interface ArtisanModeDef {
  id: string;
  icon: string;
  label: string;
  /** Affiché dans le sélecteur pour expliquer ce que montre le mode. */
  description: string;
  reliability: ReliabilityLevel;
  /** "primary" = mis en avant (le signal historique d'Artisa) ; "secondary" = signaux techniques additionnels, regroupés à part. */
  tier: "primary" | "secondary";
}

export const ARTISAN_MODES = [
  {
    id: "no_website",
    icon: "🚫",
    label: "Sans site web",
    description: "Artisans qui n'ont pas de site du tout — le mode par défaut d'Artisa.",
    reliability: "high",
    tier: "primary",
  },
  {
    id: "site_down",
    icon: "🔴",
    label: "Site down",
    description: "Artisans qui ont un site, mais inaccessible (erreur, timeout).",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "non_responsive",
    icon: "📴",
    label: "Non responsive",
    description: "Artisans dont le site est en ligne mais pas adapté mobile.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_https",
    icon: "🔓",
    label: "Pas de HTTPS",
    description: "Site en ligne servi en http:// non sécurisé.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_seo_tags",
    icon: "🏷️",
    label: "Pas de SEO de base",
    description: "Titre ou meta description absents.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_social_links",
    icon: "📵",
    label: "Pas de réseaux sociaux",
    description: "Aucun lien Facebook/Instagram/LinkedIn trouvé sur le site.",
    reliability: "medium",
    tier: "secondary",
  },
  {
    id: "no_booking_widget",
    icon: "📅",
    label: "Pas de RDV en ligne",
    description: "Aucun widget de prise de rendez-vous détecté (Calendly, Doctolib...).",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_contact_form",
    icon: "📨",
    label: "Pas de formulaire de contact",
    description: "Aucun formulaire de contact détecté sur le site.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_clickable_phone",
    icon: "☎️",
    label: "Numéro non cliquable",
    description: "Pas de lien tel: sur le site (mauvais pour mobile).",
    reliability: "medium",
    tier: "secondary",
  },
  {
    id: "no_ecommerce",
    icon: "🛒",
    label: "Pas de vente en ligne",
    description: "Aucun widget e-commerce détecté (Shopify, WooCommerce, Stripe...).",
    reliability: "medium",
    tier: "secondary",
  },
  {
    id: "no_chatbot",
    icon: "💬",
    label: "Pas de chatbot",
    description: "Aucun chatbot/agent de discussion détecté.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_analytics",
    icon: "📊",
    label: "Pas de tracking analytics",
    description: "Aucun script Google Analytics/Ads ou Meta Pixel détecté.",
    reliability: "high",
    tier: "secondary",
  },
  {
    id: "no_review_widget",
    icon: "⭐",
    label: "Pas de collecte d'avis",
    description: "Aucun widget d'avis (Trustpilot, Avis Vérifiés...) détecté.",
    reliability: "medium",
    tier: "secondary",
  },
  {
    id: "obsolete_tech",
    icon: "🕹️",
    label: "Techno obsolète",
    description: "Flash ou jQuery très ancien détecté sur le site.",
    reliability: "medium",
    tier: "secondary",
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

export interface ArtisanSiteCheckRow {
  is_reachable: boolean;
  has_viewport_meta: boolean | null;
  is_https: boolean | null;
  has_seo_tags: boolean | null;
  has_social_links: boolean | null;
  has_booking_widget: boolean | null;
  has_contact_form: boolean | null;
  has_clickable_phone: boolean | null;
  has_ecommerce: boolean | null;
  has_chatbot: boolean | null;
  has_analytics: boolean | null;
  has_review_widget: boolean | null;
  has_obsolete_tech: boolean | null;
  http_status: number | null;
  error: string | null;
}

// Modes filtrables par un simple test d'égalité sur une colonne de
// artisan_site_checks (en plus d'exiger un site accessible). "site_down" et
// "non_responsive" restent des cas particuliers, gérés à part dans la route.
export const SIMPLE_MODE_CHECK_FIELDS: Partial<
  Record<ArtisanModeId, { field: keyof ArtisanSiteCheckRow; expected: boolean }>
> = {
  no_https: { field: "is_https", expected: false },
  no_seo_tags: { field: "has_seo_tags", expected: false },
  no_social_links: { field: "has_social_links", expected: false },
  no_booking_widget: { field: "has_booking_widget", expected: false },
  no_contact_form: { field: "has_contact_form", expected: false },
  no_clickable_phone: { field: "has_clickable_phone", expected: false },
  no_ecommerce: { field: "has_ecommerce", expected: false },
  no_chatbot: { field: "has_chatbot", expected: false },
  no_analytics: { field: "has_analytics", expected: false },
  no_review_widget: { field: "has_review_widget", expected: false },
  obsolete_tech: { field: "has_obsolete_tech", expected: true },
};
