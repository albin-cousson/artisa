import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Types de métiers d'artisans recherchés. Nearby Search (New) accepte plusieurs
// types dans un seul appel (résultats = union des types), donc pas besoin d'une
// requête par métier. À vérifier/ajuster selon la liste "Table A" actuelle de
// la doc Google Places : https://developers.google.com/maps/documentation/places/web-service/place-types
const ARTISAN_TYPES = [
  "electrician",
  "plumber",
  "painter",
  "roofing_contractor",
  "locksmith",
  "general_contractor",
  "moving_company",
  "hvac_contractor",
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
    await refreshCommune(communeCode, lat, lng);
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

  const artisanIds = (artisans ?? []).map((a) => a.id);
  const { data: ratings } = artisanIds.length
    ? await supabase.from("artisan_ratings").select("*").in("artisan_id", artisanIds)
    : { data: [] };

  const ratingsByArtisan = new Map((ratings ?? []).map((r) => [r.artisan_id, r]));

  const artisansWithRating = (artisans ?? []).map((artisan) => ({
    ...artisan,
    rating: ratingsByArtisan.get(artisan.id) ?? null,
  }));

  return NextResponse.json({ artisans: artisansWithRating });
}

async function refreshCommune(communeCode: string, lat: number, lng: number) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const supabase = createServiceRoleClient();

  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY manquant : impossible d'interroger Google Places.");
    return;
  }

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
      console.error("Erreur Nearby Search:", await nearbyRes.text());
      return;
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
  } catch (err) {
    console.error("Erreur lors du rafraîchissement Google Places:", err);
  }
}
