import type { ArtisanModeId } from "@/lib/artisanModes";
import type { ArtisanSiteCheckRow } from "@/lib/artisanModes";

// Version camelCase de ArtisanSiteCheckRow exposée au front (via /api/places)
// pour expliquer, artisan par artisan, ce qui lui manque et pourquoi il a été
// ciblé par le mode actif — pas seulement le résultat du mode courant.
export interface SiteCheckSummary {
  isReachable: boolean;
  isHttps: boolean | null;
  hasViewportMeta: boolean | null;
  hasSeoTags: boolean | null;
  hasSocialLinks: boolean | null;
  hasBookingWidget: boolean | null;
  hasContactForm: boolean | null;
  hasClickablePhone: boolean | null;
  hasEcommerce: boolean | null;
  hasChatbot: boolean | null;
  hasAnalytics: boolean | null;
  hasReviewWidget: boolean | null;
  hasObsoleteTech: boolean | null;
  httpStatus: number | null;
  error: string | null;
}

export function toSiteCheckSummary(row: ArtisanSiteCheckRow): SiteCheckSummary {
  return {
    isReachable: row.is_reachable,
    isHttps: row.is_https,
    hasViewportMeta: row.has_viewport_meta,
    hasSeoTags: row.has_seo_tags,
    hasSocialLinks: row.has_social_links,
    hasBookingWidget: row.has_booking_widget,
    hasContactForm: row.has_contact_form,
    hasClickablePhone: row.has_clickable_phone,
    hasEcommerce: row.has_ecommerce,
    hasChatbot: row.has_chatbot,
    hasAnalytics: row.has_analytics,
    hasReviewWidget: row.has_review_widget,
    hasObsoleteTech: row.has_obsolete_tech,
    httpStatus: row.http_status,
    error: row.error,
  };
}

/**
 * Explication spécifique à cet artisan de pourquoi il apparaît dans le mode
 * actif — pas juste la description générique du mode (voir ARTISAN_MODES).
 */
export function getTargetReason(
  mode: ArtisanModeId,
  artisan: { website_uri: string | null; siteCheck?: SiteCheckSummary }
): string {
  if (mode === "no_website") {
    return "Aucun site web n'est renseigné sur la fiche Google de cet artisan.";
  }

  const check = artisan.siteCheck;
  if (!check) return "Diagnostic indisponible pour cet artisan.";

  const site = artisan.website_uri ?? "ce site";

  switch (mode) {
    case "site_down": {
      const detail = check.error
        ? ` (${check.error})`
        : check.httpStatus
          ? ` (code HTTP ${check.httpStatus})`
          : "";
      return `Le site ${site} ne répond pas correctement${detail}.`;
    }
    case "non_responsive":
      return `Le site ${site} est en ligne mais n'a pas de balise viewport : il ne s'adapte pas aux écrans mobiles.`;
    case "no_https":
      return `Le site ${site} est servi en http:// non sécurisé (pas de HTTPS).`;
    case "no_seo_tags":
      return `Le site ${site} n'a pas de titre et/ou de description meta valides (balise absente, texte générique, description trop courte, ou page marquée « noindex »).`;
    case "no_social_links":
      return `Aucun lien vers un réseau social (Facebook, Instagram, LinkedIn) n'a été trouvé sur ${site}.`;
    case "no_booking_widget":
      return `Aucun outil de prise de rendez-vous en ligne (Calendly, Doctolib...) n'a été détecté sur ${site}.`;
    case "no_contact_form":
      return `Aucun formulaire de contact n'a été détecté sur ${site}.`;
    case "no_clickable_phone":
      return `Le numéro de téléphone n'est pas cliquable (pas de lien tel:) sur ${site}.`;
    case "no_ecommerce":
      return `Aucun système de vente en ligne (Shopify, WooCommerce, Stripe...) n'a été détecté sur ${site}.`;
    case "no_chatbot":
      return `Aucun chatbot ou widget de discussion en ligne n'a été détecté sur ${site}.`;
    case "no_analytics":
      return `Aucun script de suivi analytics (Google Analytics, Meta Pixel...) n'a été détecté sur ${site}.`;
    case "no_review_widget":
      return `Aucun widget de collecte d'avis (Trustpilot, Avis Vérifiés...) n'a été détecté sur ${site}.`;
    case "obsolete_tech":
      return `Une technologie obsolète (Flash ou jQuery très ancien) a été détectée sur ${site}.`;
    default:
      return "Diagnostic indisponible pour cet artisan.";
  }
}

export interface SignalSummaryEntry {
  key: string;
  label: string;
  status: "ok" | "issue" | "unknown";
}

// Libellé + polarité de chaque signal pour le détail complet : "goodWhenTrue"
// indique si `true` est le résultat souhaitable (faux uniquement pour
// hasObsoleteTech, où la présence de la techno est le problème).
const SIGNAL_LABELS: Array<{ key: keyof SiteCheckSummary; label: string; goodWhenTrue: boolean }> = [
  { key: "isHttps", label: "Connexion sécurisée (HTTPS)", goodWhenTrue: true },
  { key: "hasViewportMeta", label: "Adapté aux mobiles (responsive)", goodWhenTrue: true },
  { key: "hasSeoTags", label: "Titre + description SEO valides", goodWhenTrue: true },
  { key: "hasSocialLinks", label: "Liens réseaux sociaux", goodWhenTrue: true },
  { key: "hasBookingWidget", label: "Prise de RDV en ligne", goodWhenTrue: true },
  { key: "hasContactForm", label: "Formulaire de contact", goodWhenTrue: true },
  { key: "hasClickablePhone", label: "Téléphone cliquable", goodWhenTrue: true },
  { key: "hasEcommerce", label: "Vente en ligne", goodWhenTrue: true },
  { key: "hasChatbot", label: "Chatbot / discussion en ligne", goodWhenTrue: true },
  { key: "hasAnalytics", label: "Suivi analytics", goodWhenTrue: true },
  { key: "hasReviewWidget", label: "Collecte d'avis", goodWhenTrue: true },
  { key: "hasObsoleteTech", label: "Technologies obsolètes détectées", goodWhenTrue: false },
];

/** Détail complet (✓/✗/?) de tous les signaux connus pour cet artisan, pas seulement celui du mode actif. */
export function getSignalSummary(check: SiteCheckSummary): SignalSummaryEntry[] {
  if (!check.isReachable) {
    return [
      {
        key: "isReachable",
        label: check.error ? `Site injoignable (${check.error})` : "Site injoignable",
        status: "issue",
      },
    ];
  }

  return SIGNAL_LABELS.map(({ key, label, goodWhenTrue }) => {
    const value = check[key] as boolean | null;
    const status: SignalSummaryEntry["status"] =
      value === null || value === undefined ? "unknown" : value === goodWhenTrue ? "ok" : "issue";
    return { key, label, status };
  });
}
