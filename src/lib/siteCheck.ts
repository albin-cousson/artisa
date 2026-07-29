import type { SupabaseClient } from "@supabase/supabase-js";
import https from "node:https";

// Indépendant du cache/quota Google Places : on fetch directement le site de
// l'artisan, aucune requête Google impliquée.
const CHECK_TTL_DAYS = 14;
const FETCH_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;

export interface SiteCheckResult {
  isReachable: boolean;
  isHttps: boolean;
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

const VIEWPORT_META_RE = /<meta[^>]+name=["']viewport["'][^>]*>/i;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const META_TAG_RE = /<meta\b[^>]*>/gi;
const META_CONTENT_RE = /content=["']([^"']*)["']/i;

// Une meta description trop courte (ex. "Accueil" ou un fragment tronqué) n'a
// aucune valeur SEO réelle même si la balise existe techniquement.
const MIN_DESCRIPTION_LENGTH = 40;

// Titres laissés par défaut par un CMS/thème, jamais le vrai nom d'une
// activité : à traiter comme l'absence de titre pour le SEO.
const GENERIC_TITLE_RE =
  /^(accueil|home|untitled|document|sans titre|nouvelle page|new page|index|index of \/|wordpress|just another wordpress site|site en construction|under construction|coming soon|test|page not found|404|template|mon site|my site)$/i;

// Renvoie le `content` du premier <meta> dont un attribut donné vaut une
// valeur donnée — indépendamment de l'ordre des attributs dans le tag (ex.
// `<meta content="..." name="description">` est aussi courant que l'inverse ;
// une regex séquentielle unique rate systématiquement l'un des deux ordres).
function findMetaContent(html: string, attr: "name" | "http-equiv", value: string): string | null {
  const attrRe = new RegExp(`${attr}=["']${value}["']`, "i");
  for (const tag of html.match(META_TAG_RE) ?? []) {
    if (!attrRe.test(tag)) continue;
    const content = META_CONTENT_RE.exec(tag);
    if (content) return content[1];
  }
  return null;
}
const SOCIAL_LINKS_RE = /(facebook\.com|instagram\.com|linkedin\.com)/i;
const BOOKING_WIDGET_RE = /(calendly\.com|doctolib\.fr|simplybook|resengo)/i;
const CONTACT_FORM_RE = /<form\b/i;
const CONTACT_FORM_FIELD_RE = /type=["']email["']|name=["'][^"']*(mail|message)[^"']*["']/i;
const CLICKABLE_PHONE_RE = /href=["']tel:/i;
const ECOMMERCE_RE = /(cdn\.shopify\.com|woocommerce|js\.stripe\.com|checkout\.stripe\.com)/i;
const CHATBOT_RE = /(widget\.intercom\.io|js\.driftt\.com|client\.crisp\.chat|embed\.tawk\.to|tidio)/i;
const ANALYTICS_RE = /(gtag\.js|googletagmanager\.com|google-analytics\.com|fbevents\.js)/i;
const REVIEW_WIDGET_RE = /(trustpilot|avis-verifies|avisverifies)/i;
const OBSOLETE_TECH_RE = /<object\b|jquery[.-]1\.\d/i;

// `website_uri` vient de la fiche Google Business de l'artisan — un tiers
// malveillant pourrait y mettre n'importe quelle URL. On ne fetch donc que du
// http(s) vers un hôte qui n'a pas la forme d'une adresse locale/privée
// (protection SSRF de base ; ne couvre pas le DNS rebinding vers une IP
// privée derrière un nom d'hôte public).
const BLOCKED_HOSTNAME_RE = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1?\]|\[fc|\[fd)/i;

function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (BLOCKED_HOSTNAME_RE.test(parsed.hostname)) return false;
  return true;
}

function safeResolveUrl(target: string, base: string): string | null {
  try {
    return new URL(target, base).toString();
  } catch {
    return null;
  }
}

const UNREACHABLE_RESULT: Omit<SiteCheckResult, "httpStatus" | "error"> = {
  isReachable: false,
  isHttps: false,
  hasViewportMeta: null,
  hasSeoTags: null,
  hasSocialLinks: null,
  hasBookingWidget: null,
  hasContactForm: null,
  hasClickablePhone: null,
  hasEcommerce: null,
  hasChatbot: null,
  hasAnalytics: null,
  hasReviewWidget: null,
  hasObsoleteTech: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Un aléa réseau ou un défi anti-bot ponctuel (ex. Anubis) peut faire échouer
// une tentative isolée sur un site par ailleurs bien en ligne. On retente une
// fois avant de conclure — seul un échec persistant sur les deux tentatives
// est mis en cache.
async function checkSite(url: string): Promise<SiteCheckResult> {
  let lastResult: SiteCheckResult | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await checkSiteOnce(url);
    if (result.isReachable) return result;

    lastResult = result;
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }

  return lastResult!;
}

interface PageResponse {
  status: number;
  ok: boolean;
  /** URL réellement chargée après d'éventuelles redirections HTTP (3xx) —
   * c'est elle qui détermine le vrai statut HTTPS, pas l'URL de départ. */
  url: string;
  text(): Promise<string>;
}

const PAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ArtisaBot/1.0)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

async function fetchPage(url: string, signal: AbortSignal): Promise<PageResponse> {
  return fetch(url, { signal, redirect: "follow", headers: PAGE_HEADERS });
}

// Codes TLS spécifiques à une chaîne de certificat incomplète côté serveur
// (l'intermédiaire manque) — les navigateurs la reconstituent automatiquement
// (AIA chasing / magasin de certs plus large), Node non. On ne relâche la
// vérification que pour CES codes précis, jamais pour un cert expiré, auto-
// signé pour un autre domaine, etc. : le site répond quand même en clair, on
// veut juste éviter un faux "down" sur une simple négligence de config.
const CHAIN_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);

function isChainVerificationError(err: unknown): boolean {
  const code =
    (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  return typeof code === "string" && CHAIN_ERROR_CODES.has(code);
}

function fetchPageRelaxedTls(url: string, timeoutMs: number, signal: AbortSignal): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: PAGE_HEADERS, timeout: timeoutMs, rejectUnauthorized: false, signal },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            // https.get() ne suit pas les redirections (contrairement à
            // fetch) : l'URL "finale" reste celle demandée dans ce fallback.
            url,
            text: async () => Buffer.concat(chunks).toString("utf-8"),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
  });
}

async function fetchPageWithChainFallback(url: string, signal: AbortSignal): Promise<PageResponse> {
  try {
    return await fetchPage(url, signal);
  } catch (err) {
    if (!isChainVerificationError(err)) throw err;
    return fetchPageRelaxedTls(url, FETCH_TIMEOUT_MS, signal);
  }
}

async function checkSiteOnce(url: string): Promise<SiteCheckResult> {
  const fallbackIsHttps = url.startsWith("https://");

  if (!isSafeUrl(url)) {
    return { ...UNREACHABLE_RESULT, isHttps: fallbackIsHttps, httpStatus: null, error: "URL non autorisée" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let res = await fetchPageWithChainFallback(url, controller.signal);
    // `fetch` suit déjà les redirections HTTP (3xx) — très courant pour
    // http://... → https://... — donc l'URL réellement chargée (res.url)
    // reflète le vrai statut HTTPS, contrairement à l'URL de départ stockée
    // en base (souvent encore en http:// même quand le site redirige bien).
    let finalUrl = res.url || url;

    if (!res.ok) {
      // 401/403/429 prouvent que le serveur répond (souvent une protection
      // anti-bot type Cloudflare qui fingerprint le client HTTP au-delà des
      // headers — curl et le fetch de Node obtiennent des réponses
      // différentes avec des headers identiques) : ce n'est pas "down". On ne
      // peut juste pas lire son contenu, donc les signaux dépendants restent
      // inconnus (null) plutôt que faussement "absents".
      const isBotBlocked = res.status === 401 || res.status === 403 || res.status === 429;
      return {
        ...UNREACHABLE_RESULT,
        isReachable: isBotBlocked,
        isHttps: finalUrl.startsWith("https://"),
        httpStatus: res.status,
        error: isBotBlocked
          ? "Site accessible mais bloque les requêtes automatisées (protection anti-bot)"
          : null,
      };
    }

    let html = await res.text();

    // Suit une seule page-relais meta-refresh (ex. liens "site web" réexportés
    // depuis Google Maps, google.com/url?url=http://vrai-site.fr&... : pas de
    // redirection HTTP, juste cette page-relais que `fetch` ne suit jamais
    // tout seul) : le wrapper lui-même n'est pas le site de l'artisan, ses
    // signaux (HTTPS compris) doivent venir de la page réelle.
    const refreshContent = findMetaContent(html, "http-equiv", "refresh");
    const refreshUrl = refreshContent ? /url=(.+)$/i.exec(refreshContent)?.[1]?.trim() : null;
    if (refreshUrl) {
      const target = safeResolveUrl(refreshUrl, finalUrl);
      if (target && isSafeUrl(target)) {
        const redirectedRes = await fetchPageWithChainFallback(target, controller.signal);
        if (redirectedRes.ok) {
          finalUrl = target;
          res = redirectedRes;
          html = await redirectedRes.text();
        }
      }
    }

    const isHttps = finalUrl.startsWith("https://");
    const title = TITLE_RE.exec(html)?.[1]?.trim();
    const description = findMetaContent(html, "name", "description")?.trim();
    const hasContactForm = CONTACT_FORM_RE.test(html) && CONTACT_FORM_FIELD_RE.test(html);

    // Un titre/description présents mais génériques (thème par défaut, texte
    // trop court) ou une page explicitement marquée noindex ne servent à rien
    // pour le SEO : traités comme "pas de SEO" au même titre qu'une balise
    // absente.
    const hasValidTitle = Boolean(title) && !GENERIC_TITLE_RE.test(title!);
    const hasValidDescription = Boolean(description) && description!.length >= MIN_DESCRIPTION_LENGTH;
    const robotsContent = findMetaContent(html, "name", "robots");
    const hasNoindex = robotsContent ? /noindex/i.test(robotsContent) : false;

    return {
      isReachable: true,
      isHttps,
      hasViewportMeta: VIEWPORT_META_RE.test(html),
      hasSeoTags: hasValidTitle && hasValidDescription && !hasNoindex,
      hasSocialLinks: SOCIAL_LINKS_RE.test(html),
      hasBookingWidget: BOOKING_WIDGET_RE.test(html),
      hasContactForm,
      hasClickablePhone: CLICKABLE_PHONE_RE.test(html),
      hasEcommerce: ECOMMERCE_RE.test(html),
      hasChatbot: CHATBOT_RE.test(html),
      hasAnalytics: ANALYTICS_RE.test(html),
      hasReviewWidget: REVIEW_WIDGET_RE.test(html),
      hasObsoleteTech: OBSOLETE_TECH_RE.test(html),
      httpStatus: res.status,
      error: null,
    };
  } catch (err) {
    return {
      ...UNREACHABLE_RESULT,
      isHttps: fallbackIsHttps,
      httpStatus: null,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Vérifie (avec cache `CHECK_TTL_DAYS`) le site de chaque artisan de la liste
 * qui en a un. Les vérifications manquantes/périmées sont lancées en
 * parallèle. Ne modifie pas `artisans` : écrit dans `artisan_site_checks`.
 */
export async function ensureSiteChecks(
  supabase: SupabaseClient,
  artisans: Array<{ id: string; website_uri: string | null }>
): Promise<void> {
  const withSite = artisans.filter(
    (a): a is { id: string; website_uri: string } => a.website_uri !== null
  );
  if (withSite.length === 0) return;

  const ids = withSite.map((a) => a.id);
  const { data: existingChecks, error: selectError } = await supabase
    .from("artisan_site_checks")
    .select("artisan_id, checked_at, is_https")
    .in("artisan_id", ids);

  if (selectError) {
    console.error("Lecture artisan_site_checks échouée (migration manquante ?):", selectError.message);
  }

  const freshCutoff = Date.now() - CHECK_TTL_DAYS * 24 * 60 * 60 * 1000;
  const freshIds = new Set(
    (existingChecks ?? [])
      // is_https est toujours renseigné par le code actuel (même pour un
      // site injoignable) : une ligne où il est encore null vient d'un
      // upsert antérieur à ce champ (ou d'un échec silencieux de l'upsert,
      // ex. migration pas encore appliquée) — on la retraite plutôt que de
      // la considérer "fraîche" jusqu'à expiration du cache.
      .filter((c) => new Date(c.checked_at).getTime() >= freshCutoff && c.is_https !== null)
      .map((c) => c.artisan_id)
  );

  const toCheck = withSite.filter((a) => !freshIds.has(a.id));
  if (toCheck.length === 0) return;

  await Promise.allSettled(
    toCheck.map(async (artisan) => {
      const result = await checkSite(artisan.website_uri);
      const { error: upsertError } = await supabase.from("artisan_site_checks").upsert(
        {
          artisan_id: artisan.id,
          checked_at: new Date().toISOString(),
          is_reachable: result.isReachable,
          is_https: result.isHttps,
          has_viewport_meta: result.hasViewportMeta,
          has_seo_tags: result.hasSeoTags,
          has_social_links: result.hasSocialLinks,
          has_booking_widget: result.hasBookingWidget,
          has_contact_form: result.hasContactForm,
          has_clickable_phone: result.hasClickablePhone,
          has_ecommerce: result.hasEcommerce,
          has_chatbot: result.hasChatbot,
          has_analytics: result.hasAnalytics,
          has_review_widget: result.hasReviewWidget,
          has_obsolete_tech: result.hasObsoleteTech,
          http_status: result.httpStatus,
          error: result.error,
        },
        { onConflict: "artisan_id" }
      );

      // Ne jamais échouer en silence : une colonne manquante (migration pas
      // appliquée) ferait échouer TOUT l'upsert sans qu'aucun mode ne
      // fonctionne pour cet artisan, sans aucune trace nulle part.
      if (upsertError) {
        console.error(`Échec upsert artisan_site_checks pour ${artisan.id}:`, upsertError.message);
      }
    })
  );
}
