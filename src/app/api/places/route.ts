import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

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

  if (!isFresh) {
    if (!googleApiKey) {
      return NextResponse.json(
        { error: "Aucune clé Google Places associée à ton compte." },
        { status: 400 }
      );
    }
    const refresh = await refreshCommune(communeCode, lat, lng, googleApiKey);
    if (!refresh.ok) {
      return NextResponse.json({ error: refresh.error }, { status: 502 });
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

  return NextResponse.json({ artisans: artisans ?? [] });
}

type RefreshResult = { ok: true } | { ok: false; error: string };

async function refreshCommune(
  communeCode: string,
  lat: number,
  lng: number,
  apiKey: string
): Promise<RefreshResult> {
  const supabase = createServiceRoleClient();

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
        maxResultCount: MAX_DETAILS_PER_SEARCH,
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

    for (const candidate of candidates) {
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${candidate.id}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "displayName,nationalPhoneNumber,googleMapsUri,websiteUri",
        },
      });

      if (!detailsRes.ok) {
        console.error("Erreur Place Details:", await detailsRes.text());
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
    }

    await supabase
      .from("commune_search_cache")
      .upsert({ commune_code: communeCode, searched_at: new Date().toISOString() });

    return { ok: true };
  } catch (err) {
    console.error("Erreur lors du rafraîchissement Google Places:", err);
    return { ok: false, error: "Impossible de contacter Google Places. Réessaie plus tard." };
  }
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
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    httpStatus === 429
  ) {
    return "Quota Google atteint pour aujourd'hui. Les communes déjà explorées restent consultables ; réessaie demain.";
  }
  if (lower.includes("referer") || lower.includes("referrer") || httpStatus === 403) {
    return "Ta clé Google Places est refusée (restrictions ou permissions). Vérifie sa configuration.";
  }
  return "Erreur Google Places lors de la recherche. Réessaie plus tard.";
}
