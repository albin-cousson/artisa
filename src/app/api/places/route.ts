import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { countQuotaUsedToday, getDailyQuotaLimit } from "@/lib/quota";
import {
  DEFAULT_MODE_ID,
  isArtisanModeId,
  SIMPLE_MODE_CHECK_FIELDS,
  type ArtisanModeId,
} from "@/lib/artisanModes";
import { ensureSiteChecks } from "@/lib/siteCheck";
import { toSiteCheckSummary } from "@/lib/artisanDiagnostics";

// Termes de recherche libre (Text Search), plutôt que des types Nearby Search :
// la Table A de Google (Place Types (New)) ne couvre que 6 métiers du bâtiment
// (electrician, plumber, painter, roofing_contractor, locksmith,
// moving_company) — ni coiffeur, ni menuisier, carreleur, maçon, plâtrier,
// vitrier, chauffagiste... Text Search (New) accepte n'importe quelle requête
// texte libre, sans être limité à cette liste (voir searchTradeCandidates).
// Bonus vérifié sur la doc tarifaire Google (juillet 2026, pas encore testé en
// conditions réelles faute de clé ici) : le FieldMask minimal "places.id"
// facture au tier "Text Search Essentials (IDs Only)", gratuit et illimité —
// contrairement à Nearby Search Pro ($32/1000) qui n'a pas cet équivalent.
const TRADE_SEARCH_QUERIES = [
  "électricien",
  "plombier",
  "peintre en bâtiment",
  "couvreur",
  "serrurier",
  "déménageur",
  "menuisier",
  "carreleur",
  "maçon",
  "plâtrier",
  "vitrier",
  "chauffagiste",
  "plaquiste",
  "coiffeur",
];

// Nombre de communes déjà interrogées avant de considérer le cache "frais".
const CACHE_TTL_DAYS = 60;

// Cap volontairement bas : chaque Place Details facturé au tier Enterprise
// (à cause de nationalPhoneNumber/websiteUri) compte dans un quota gratuit
// mensuel limité. Voir le rapport de scaffold pour le détail des coûts.
const MAX_DETAILS_PER_SEARCH = 20;

// Limite documentée par Google pour Text Search (New) : 60 résultats maximum
// par requête, soit 3 pages de 20 (pageSize). Au-delà, l'API n'a plus rien à
// offrir pour ce terme, quel que soit le nombre de tentatives.
const MAX_PAGES_PER_TERM = 3;

interface TextSearchPlace {
  id: string;
}

type TradeSearchResult =
  | { ok: true; term: string; places: TextSearchPlace[]; nextPageToken: string | null }
  | { ok: false; term: string; status: number; body: string };

// Résultat agrégé pour un métier après avoir suivi la pagination live (voir
// searchTermCandidates) : `exhausted` ne veut pas dire "aucun candidat", mais
// "on sait qu'il n'y a rien de plus à découvrir au-delà de ce qu'on a vu" —
// c'est ce qui détermine si la commune peut être marquée "entièrement
// explorée" (voir isComplete dans refreshCommune).
type TermOutcome =
  | { ok: true; term: string; places: TextSearchPlace[]; exhausted: boolean }
  | { ok: false; term: string; status: number; body: string };

interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  websiteUri?: string;
}

// Rotation du métier par lequel commence la répartition équitable du budget
// Place Details (voir allocateDetailsBudget) — décalée d'un cran à chaque
// appel de refreshCommune pour cette commune, pour qu'un même petit groupe de
// métiers ne récupère pas systématiquement les "restes" du tour 2 (voir
// migration 0006, colonne jsonb search_progress).
interface SearchProgress {
  metierOffset?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const communeCode = searchParams.get("code");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const rawMode = searchParams.get("mode");
  const mode: ArtisanModeId = rawMode && isArtisanModeId(rawMode) ? rawMode : DEFAULT_MODE_ID;

  if (!communeCode || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "Paramètres 'code', 'lat' et 'lng' requis." },
      { status: 400 }
    );
  }

  // Connexion obligatoire : chaque compte utilise sa propre clé Google Places
  // (renseignée à l'inscription, cf. src/app/signup/page.tsx), donc pas
  // d'accès anonyme à cette route.
  const authedSupabase = await createClient();
  const {
    data: { user },
  } = await authedSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const googleApiKey = user.user_metadata?.google_places_api_key as string | undefined;

  const supabase = createServiceRoleClient();

  const { data: cacheEntry } = await supabase
    .from("commune_search_cache")
    .select("searched_at")
    .eq("commune_code", communeCode)
    .maybeSingle();

  // searched_at reste null tant que la commune n'est pas entièrement explorée
  // (voir refreshCommune) : une commune en cours de pagination ne doit jamais
  // être considérée "fraîche".
  const isFresh =
    cacheEntry?.searched_at &&
    Date.now() - new Date(cacheEntry.searched_at).getTime() < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  let quotaNotice: string | null = null;

  if (!isFresh) {
    if (!googleApiKey) {
      return NextResponse.json(
        { error: "Aucune clé Google Places associée à ton compte." },
        { status: 400 }
      );
    }

    const used = await countQuotaUsedToday(supabase, user.id);
    const limit = getDailyQuotaLimit(user);
    const remaining = limit - used;

    if (remaining <= 0) {
      // Ne bloque pas l'accès : une commune tronquée par le quota (voir
      // refreshCommune) a déjà des artisans en cache, potentiellement
      // pertinents pour n'importe quel mode — les modes autres que
      // "no_website" ne consomment d'ailleurs aucun quota Google. On saute
      // juste la tentative de nouvel appel, sans cacher ce qui existe déjà.
      quotaNotice = `Quota Google quotidien atteint (${limit}/${limit} aujourd'hui) : les artisans déjà connus pour cette commune restent affichés, mais il peut y en avoir d'autres. Réessaie après la remise à zéro, vers 9h heure de Paris (minuit en Californie).`;
    } else {
      const refresh = await refreshCommune(communeCode, lat, lng, googleApiKey, user.id, remaining);
      if (!refresh.ok) {
        return NextResponse.json({ error: refresh.error }, { status: 502 });
      }
      if (refresh.partial) {
        quotaNotice = `Quota Google presque atteint : ${refresh.knownCount}/${MAX_DETAILS_PER_SEARCH} artisans chargés ici pour l'instant, il peut y en avoir d'autres. Reviens charger le reste dès que le quota se régénère.`;
      }
    }
  }

  let query = supabase
    .from("artisans")
    .select("id, place_id, commune_code, display_name, national_phone_number, google_maps_uri, website_uri, category")
    .eq("commune_code", communeCode)
    .order("display_name");

  // "Sans site web" reste le seul mode filtrable directement en SQL ; les
  // autres modes portent sur la santé du site de l'artisan (voir plus bas),
  // donc on ne peut ici que restreindre aux artisans qui EN ONT un.
  query = mode === "no_website" ? query.is("website_uri", null) : query.not("website_uri", "is", null);

  const { data: artisansRaw, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let artisans = artisansRaw ?? [];

  if (mode !== "no_website" && artisans.length > 0) {
    // Aucune requête Google ici : on fetch directement le site de chaque
    // artisan, avec cache (voir src/lib/siteCheck.ts) — ne consomme pas le
    // quota Google Places suivi plus haut.
    await ensureSiteChecks(supabase, artisans);

    const { data: checks } = await supabase
      .from("artisan_site_checks")
      .select(
        "artisan_id, is_reachable, has_viewport_meta, is_https, has_seo_tags, has_social_links, has_booking_widget, has_contact_form, has_clickable_phone, has_ecommerce, has_chatbot, has_analytics, has_review_widget, has_obsolete_tech, http_status, error"
      )
      .in(
        "artisan_id",
        artisans.map((a) => a.id)
      );
    const checkByArtisanId = new Map((checks ?? []).map((c) => [c.artisan_id, c]));
    const simpleCheck = SIMPLE_MODE_CHECK_FIELDS[mode];

    artisans = artisans
      .filter((artisan) => {
        const check = checkByArtisanId.get(artisan.id);
        if (!check) return false;
        if (mode === "site_down") return !check.is_reachable;
        if (mode === "non_responsive") return check.is_reachable && check.has_viewport_meta === false;
        if (simpleCheck) return check.is_reachable && check[simpleCheck.field] === simpleCheck.expected;
        return false;
      })
      // Diagnostic complet joint à chaque artisan renvoyé, pour expliquer côté
      // front ce qui lui manque précisément (voir src/lib/artisanDiagnostics.ts)
      // — pas seulement pourquoi le mode actif le montre.
      .map((artisan) => ({
        ...artisan,
        siteCheck: toSiteCheckSummary(checkByArtisanId.get(artisan.id)!),
      }));
  }

  const quota = {
    used: await countQuotaUsedToday(supabase, user.id),
    limit: getDailyQuotaLimit(user),
  };

  return NextResponse.json({ artisans, quotaNotice, quota });
}

type RefreshResult =
  | { ok: true; partial: boolean; knownCount: number }
  | { ok: false; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Une page d'une requête texte libre pour un métier (voir TRADE_SEARCH_QUERIES),
// FieldMask minimal pour rester sur le tier gratuit "Essentials (IDs Only)".
// locationBias est une préférence, pas une restriction dure comme le
// locationRestriction de Nearby Search — le rayon reste indicatif, ce qui est
// acceptable ici puisqu'on ne s'en sert que pour prioriser des candidats
// proches de la commune.
async function searchTradeCandidates(
  term: string,
  lat: number,
  lng: number,
  apiKey: string,
  pageToken: string | null
): Promise<TradeSearchResult> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // "nextPageToken" reste sur le tier gratuit Essentials (IDs Only) au
        // même titre que "places.id" — vérifié sur la doc Google (juillet 2026).
        "X-Goog-FieldMask": "places.id,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: term,
        languageCode: "fr",
        pageSize: 20,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
        },
        // Une page suivante doit garder tous les autres paramètres identiques
        // à la requête d'origine, sinon Google renvoie INVALID_ARGUMENT.
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      return { ok: false, term, status: res.status, body: await res.text() };
    }

    const data = (await res.json()) as { places?: TextSearchPlace[]; nextPageToken?: string };
    return { ok: true, term, places: data.places ?? [], nextPageToken: data.nextPageToken ?? null };
  } catch (err) {
    return { ok: false, term, status: 0, body: err instanceof Error ? err.message : "Erreur réseau" };
  }
}

// Un `pageToken` fraîchement émis peut occasionnellement ne pas être encore
// "prêt" côté serveur Google (comportement documenté par la communauté sur
// l'ancienne Places API, non confirmé pour Text Search (New), mais sans coût
// à se prémunir) : un seul retry après un court délai avant d'abandonner,
// plutôt qu'un sleep systématique qui ralentirait chaque page suivante.
async function searchTradeCandidatesWithRetry(
  term: string,
  lat: number,
  lng: number,
  apiKey: string,
  pageToken: string | null
): Promise<TradeSearchResult> {
  const first = await searchTradeCandidates(term, lat, lng, apiKey, pageToken);
  if (first.ok || !pageToken) return first;
  await sleep(2000);
  return searchTradeCandidates(term, lat, lng, apiKey, pageToken);
}

// Pagine EN LIVE, dans la même exécution de refreshCommune, jusqu'à trouver au
// moins un candidat pas encore dans `existingPlaceIds`, ou jusqu'à épuiser les
// `MAX_PAGES_PER_TERM` pages disponibles pour ce métier. Le `nextPageToken`
// n'est jamais persisté au-delà de cet appel : la doc Google indique que "the
// list of places returned is not guaranteed to be consistent for identical
// requests", et un token réutilisé un autre jour a de bonnes chances d'être
// expiré — le seul mécanisme de reprise entre deux appels HTTP séparés est le
// dédoublonnage par place_id (existingPlaceIds), pas la position de pagination.
async function searchTermCandidates(
  term: string,
  lat: number,
  lng: number,
  apiKey: string,
  existingPlaceIds: Set<string>
): Promise<TermOutcome> {
  let pageToken: string | null = null;

  for (let page = 1; page <= MAX_PAGES_PER_TERM; page++) {
    const result = await searchTradeCandidatesWithRetry(term, lat, lng, apiKey, pageToken);
    if (!result.ok) return result;

    const hasNewCandidate = result.places.some((p) => !existingPlaceIds.has(p.id));
    if (hasNewCandidate || !result.nextPageToken) {
      return { ok: true, term, places: result.places, exhausted: result.nextPageToken === null };
    }

    // Page entièrement connue mais il en reste une autre : on continue tout
    // de suite dans ce même appel plutôt que de mémoriser le token pour plus
    // tard (voir commentaire de fonction).
    pageToken = result.nextPageToken;
  }

  // MAX_PAGES_PER_TERM atteint (60 résultats, plafond documenté de Google) :
  // il n'y a rien de plus à trouver pour ce métier, quoi qu'il arrive.
  return { ok: true, term, places: [], exhausted: true };
}

// Répartit `detailsBudget` candidats équitablement entre les métiers qui en
// ont trouvé de nouveaux, plutôt que de vider le premier métier du tableau
// avant de passer au suivant (voir le bug d'origine : "électricien" en tête
// de TRADE_SEARCH_QUERIES asséchait tout le budget avant que "coiffeur",
// dernier de la liste, ne soit jamais servi). Un candidat par métier au tour
// 1 (dans l'ordre de rotation fourni), un 2e au tour 2 si le budget le
// permet, etc.
function allocateDetailsBudget(
  perTermQueues: Map<string, string[]>,
  rotatedTerms: string[],
  detailsBudget: number
): Array<{ id: string; category: string }> {
  const selected: Array<{ id: string; category: string }> = [];
  let round = 0;

  while (selected.length < detailsBudget) {
    let addedThisRound = false;
    for (const term of rotatedTerms) {
      if (selected.length >= detailsBudget) break;
      const queue = perTermQueues.get(term);
      if (!queue || round >= queue.length) continue;
      selected.push({ id: queue[round], category: term });
      addedThisRound = true;
    }
    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

async function refreshCommune(
  communeCode: string,
  lat: number,
  lng: number,
  apiKey: string,
  userId: string,
  remainingQuota: number
): Promise<RefreshResult> {
  const supabase = createServiceRoleClient();

  try {
    // Sans ce filtre, "Charger le reste" après un rechargement de quota
    // re-dépenserait le quota sur les artisans déjà connus au lieu d'atteindre
    // les nouveaux. Calculé AVANT la recherche : sert aussi à décider, par
    // métier, quand une page de résultats n'apporte plus rien de neuf.
    const { data: existingRows } = await supabase
      .from("artisans")
      .select("place_id")
      .eq("commune_code", communeCode);
    const existingPlaceIds = new Set((existingRows ?? []).map((row) => row.place_id));

    const { data: progressRow } = await supabase
      .from("commune_search_cache")
      .select("search_progress")
      .eq("commune_code", communeCode)
      .maybeSingle();
    const progress = (progressRow?.search_progress as SearchProgress | null) ?? {};
    const metierOffset = ((progress.metierOffset ?? 0) % TRADE_SEARCH_QUERIES.length + TRADE_SEARCH_QUERIES.length) % TRADE_SEARCH_QUERIES.length;

    const searchResults = await Promise.all(
      TRADE_SEARCH_QUERIES.map((term) => searchTermCandidates(term, lat, lng, apiKey, existingPlaceIds))
    );

    // Une clé invalide/désactivée fait échouer TOUTES les recherches de la
    // même façon : dans ce cas seulement on remonte une vraie erreur. Un échec
    // isolé sur un seul métier (loggé ci-dessous) ne doit pas priver la commune
    // des métiers qui, eux, ont répondu.
    const failures = searchResults.filter(
      (r): r is Extract<TermOutcome, { ok: false }> => !r.ok
    );
    if (failures.length === searchResults.length) {
      console.error("Toutes les recherches Text Search ont échoué:", failures[0].body);
      return { ok: false, error: explainGoogleError(failures[0].status, failures[0].body) };
    }
    for (const failure of failures) {
      console.error(`Erreur Text Search ("${failure.term}"):`, failure.body);
    }

    // Un même établissement peut ressortir sous plusieurs métiers recherchés
    // (ex. "maçon" et "carreleur") : on dédoublonne par place_id, en gardant le
    // premier métier trouvé (ordre de TRADE_SEARCH_QUERIES) comme "category".
    const seenPlaceIds = new Set<string>();
    const perTermNewCandidates = new Map<string, string[]>();
    let totalNewCandidates = 0;
    for (const result of searchResults) {
      if (!result.ok) continue;
      const queue: string[] = [];
      for (const place of result.places) {
        if (seenPlaceIds.has(place.id) || existingPlaceIds.has(place.id)) continue;
        seenPlaceIds.add(place.id);
        queue.push(place.id);
      }
      if (queue.length > 0) {
        perTermNewCandidates.set(result.term, queue);
        totalNewCandidates += queue.length;
      }
    }

    // Répartition équitable, en tournant le point de départ à chaque appel
    // (voir allocateDetailsBudget) — la recherche elle-même est gratuite et
    // illimitée, seul le détail (Place Details, payant) reste plafonné par le
    // quota du jour.
    const rotatedTerms = [
      ...TRADE_SEARCH_QUERIES.slice(metierOffset),
      ...TRADE_SEARCH_QUERIES.slice(0, metierOffset),
    ];
    const detailsBudget = Math.min(MAX_DETAILS_PER_SEARCH, remainingQuota);
    const selected = allocateDetailsBudget(perTermNewCandidates, rotatedTerms, detailsBudget);

    let fetchedCount = 0;

    for (const candidate of selected) {
      // Journalisé même en cas d'échec juste après : la tentative compte déjà
      // dans le quota Google, qu'elle réussisse ou non.
      await supabase.from("google_places_quota_usage").insert({ user_id: userId });

      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${candidate.id}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "displayName,nationalPhoneNumber,googleMapsUri,websiteUri",
        },
      });

      if (!detailsRes.ok) {
        const body = await detailsRes.text();
        console.error("Erreur Place Details:", body);
        if (isQuotaError(detailsRes.status, body)) {
          // Le quota mesuré côté app était optimiste (autre appareil, autre
          // requête concurrente...) : on s'arrête net plutôt que d'enchaîner
          // des échecs pour chaque candidat restant.
          break;
        }
        continue;
      }

      const details = (await detailsRes.json()) as PlaceDetails;

      await supabase.from("artisans").upsert(
        {
          place_id: candidate.id,
          commune_code: communeCode,
          display_name: details.displayName?.text ?? "Nom inconnu",
          national_phone_number: details.nationalPhoneNumber ?? null,
          google_maps_uri: details.googleMapsUri ?? null,
          website_uri: details.websiteUri ?? null,
          category: candidate.category,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "place_id" }
      );
      fetchedCount++;
    }

    // Complète seulement si CHAQUE nouveau candidat trouvé a bien été traité ET
    // que chaque métier a confirmé qu'il n'y a rien de plus au-delà de ce qui a
    // été vu (voir `exhausted` dans searchTermCandidates) : sinon il reste
    // potentiellement des artisans non découverts (budget du jour atteint, ou
    // pagination pas encore poussée jusqu'au bout pour un métier très demandé
    // genre "plombier" à Paris) — la commune ne doit pas être figée 60 jours.
    const allTermsExhausted = searchResults.every((r) => r.ok && r.exhausted);
    const isComplete = fetchedCount === selected.length && selected.length === totalNewCandidates && allTermsExhausted;

    // search_progress ne retient plus qu'un décalage de rotation (voir
    // allocateDetailsBudget) : la position de pagination elle-même n'est
    // jamais mémorisée entre deux appels (voir searchTermCandidates).
    const newProgress: SearchProgress = {
      metierOffset: (metierOffset + 1) % TRADE_SEARCH_QUERIES.length,
    };
    await supabase.from("commune_search_cache").upsert({
      commune_code: communeCode,
      search_progress: newProgress,
      ...(isComplete ? { searched_at: new Date().toISOString() } : {}),
    });

    return { ok: true, partial: !isComplete, knownCount: existingPlaceIds.size + fetchedCount };
  } catch (err) {
    console.error("Erreur lors du rafraîchissement Google Places:", err);
    return { ok: false, error: "Impossible de contacter Google Places. Réessaie plus tard." };
  }
}

function isQuotaError(httpStatus: number, rawBody: string): boolean {
  const lower = rawBody.toLowerCase();
  return lower.includes("resource_exhausted") || lower.includes("quota") || httpStatus === 429;
}

// Message clair pour l'utilisateur à partir de la réponse d'erreur Google, afin
// que le front n'affiche pas une commune faussement "vide" en cas de clé cassée.
function explainGoogleError(httpStatus: number, rawBody: string): string {
  const lower = rawBody.toLowerCase();

  if (lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
    return "Ta clé Google Places est invalide. Mets-la à jour dans les paramètres de ton compte.";
  }
  if (
    lower.includes("has not been used") ||
    lower.includes("is disabled") ||
    lower.includes("not enabled")
  ) {
    return "« Places API (New) » n'est pas activée sur le projet Google Cloud de ta clé.";
  }
  if (isQuotaError(httpStatus, rawBody)) {
    return "Quota Google atteint pour aujourd'hui. Les communes déjà explorées restent consultables ; réessaie demain.";
  }
  if (lower.includes("referer") || lower.includes("referrer") || httpStatus === 403) {
    return "Ta clé Google Places est refusée (restrictions ou permissions). Vérifie sa configuration.";
  }
  return "Erreur Google Places lors de la recherche. Réessaie plus tard.";
}
