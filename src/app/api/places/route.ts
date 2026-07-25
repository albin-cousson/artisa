import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { countQuotaUsedToday, getDailyQuotaLimit } from "@/lib/quota";

// Types de métiers d'artisans recherchés. Nearby Search (New) accepte plusieurs
// types dans un seul appel (résultats = union des types), donc pas besoin d'une
// requête par métier. À vérifier/ajuster selon la liste "Table A" actuelle de
// la doc Google Places : https://developers.google.com/maps/documentation/places/web-service/place-types
// "general_contractor" et "hvac_contractor" n'existent pas dans la Table A de
// Google (Place Types (New)) : aucun type HVAC ni "contractor" générique n'y
// figure, ce ne sont pas des noms renommés. Liste limitée à ce que Google expose.
const ARTISAN_TYPES = [
  "electrician",
  "plumber",
  "painter",
  "roofing_contractor",
  "locksmith",
  "moving_company",
];

// Nombre de communes déjà interrogées avant de considérer le cache "frais".
const CACHE_TTL_DAYS = 60;

// Cap volontairement bas : chaque Place Details facturé au tier Enterprise
// (à cause de nationalPhoneNumber/websiteUri) compte dans un quota gratuit
// mensuel limité. Voir le rapport de scaffold pour le détail des coûts.
const MAX_DETAILS_PER_SEARCH = 20;

interface NearbySearchPlace {
  id: string;
}

interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  websiteUri?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const communeCode = searchParams.get("code");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

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

  const isFresh =
    cacheEntry &&
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
      return NextResponse.json(
        {
          error: `Quota Google quotidien atteint (${limit}/${limit} aujourd'hui). Les communes déjà explorées restent consultables ; réessaie après la remise à zéro, vers 9h heure de Paris (minuit en Californie).`,
        },
        { status: 429 }
      );
    }

    const refresh = await refreshCommune(communeCode, lat, lng, googleApiKey, user.id, remaining);
    if (!refresh.ok) {
      return NextResponse.json({ error: refresh.error }, { status: 502 });
    }
    if (refresh.partial) {
      quotaNotice = `Quota Google presque atteint : ${refresh.knownCount}/${MAX_DETAILS_PER_SEARCH} artisans chargés ici pour l'instant, il peut y en avoir d'autres. Reviens charger le reste dès que le quota se régénère.`;
    }
  }

  const { data: artisans, error } = await supabase
    .from("artisans")
    .select("id, place_id, commune_code, display_name, national_phone_number, google_maps_uri, website_uri, category")
    .eq("commune_code", communeCode)
    .is("website_uri", null)
    .order("display_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const quota = {
    used: await countQuotaUsedToday(supabase, user.id),
    limit: getDailyQuotaLimit(user),
  };

  return NextResponse.json({ artisans: artisans ?? [], quotaNotice, quota });
}

type RefreshResult =
  | { ok: true; partial: boolean; knownCount: number }
  | { ok: false; error: string };

async function refreshCommune(
  communeCode: string,
  lat: number,
  lng: number,
  apiKey: string,
  userId: string,
  remainingQuota: number
): Promise<RefreshResult> {
  const supabase = createServiceRoleClient();

  // On ne demande jamais plus de candidats que le quota restant ne permet d'en
  // détailler : mieux vaut une commune partielle et clairement signalée qu'une
  // ville comme Strasbourg qui échoue en silence au milieu de la boucle.
  const requestedCount = Math.min(MAX_DETAILS_PER_SEARCH, remainingQuota);

  try {
    const nearbyRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        includedTypes: ARTISAN_TYPES,
        maxResultCount: requestedCount,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
        },
      }),
    });

    if (!nearbyRes.ok) {
      const body = await nearbyRes.text();
      console.error("Erreur Nearby Search:", body);
      return { ok: false, error: explainGoogleError(nearbyRes.status, body) };
    }

    const nearbyData = (await nearbyRes.json()) as { places?: NearbySearchPlace[] };
    const candidates = nearbyData.places ?? [];

    // Nearby Search est quasi déterministe (même lieu, mêmes types) : sans ce
    // filtre, "Charger le reste" après un rechargement de quota re-dépenserait
    // le quota sur les artisans déjà connus au lieu d'atteindre les nouveaux.
    const { data: existingRows } = await supabase
      .from("artisans")
      .select("place_id")
      .eq("commune_code", communeCode);
    const existingPlaceIds = new Set((existingRows ?? []).map((row) => row.place_id));
    const newCandidates = candidates.filter((candidate) => !existingPlaceIds.has(candidate.id));

    let fetchedCount = 0;
    let quotaHitMidLoop = false;

    for (const candidate of newCandidates) {
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
          quotaHitMidLoop = true;
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
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "place_id" }
      );
      fetchedCount++;
    }

    // Si Google a renvoyé exactement le nombre demandé, il peut en exister
    // d'autres qu'on n'a pas eu le budget d'interroger : la commune n'est PAS
    // entièrement explorée, il ne faut donc pas la figer 60 jours dans le
    // cache avec une liste tronquée.
    const trimmedByBudget = requestedCount < MAX_DETAILS_PER_SEARCH && candidates.length === requestedCount;
    const isComplete = !quotaHitMidLoop && !trimmedByBudget;

    if (isComplete) {
      await supabase
        .from("commune_search_cache")
        .upsert({ commune_code: communeCode, searched_at: new Date().toISOString() });
    }

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
