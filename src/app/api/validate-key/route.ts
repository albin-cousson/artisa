import { NextResponse, type NextRequest } from "next/server";

/**
 * Valide une clé Google Places API (New) avant l'inscription.
 *
 * L'appel Google doit être fait côté serveur (les endpoints Places API (New)
 * ne renvoient pas les en-têtes CORS nécessaires à un appel navigateur). On
 * fait UNE requête Nearby Search minimale (FieldMask `places.id`, rayon 1 m
 * en plein océan pour ne remonter aucun lieu) : ce qui nous intéresse n'est
 * pas le résultat mais le code d'erreur renvoyé par Google.
 */
export async function POST(request: NextRequest) {
  let apiKey: string | undefined;
  try {
    ({ apiKey } = (await request.json()) as { apiKey?: string });
  } catch {
    return NextResponse.json({ valid: false, error: "Requête invalide." }, { status: 400 });
  }

  const key = apiKey?.trim();
  if (!key) {
    return NextResponse.json({ valid: false, error: "Clé manquante." }, { status: 400 });
  }

  // Pré-filtre de format : les clés Google API commencent par « AIza » et font
  // 39 caractères. On rejette tout ce qui n'y ressemble pas AVANT d'appeler
  // Google — ça donne un message clair et ça évite que cet endpoint public
  // serve de proxy pour des requêtes arbitraires.
  if (key.length > 100 || !/^AIza[0-9A-Za-z_-]{35}$/.test(key)) {
    return NextResponse.json({
      valid: false,
      error: "Cette clé ne ressemble pas à une clé Google (elle commence normalement par « AIza »). Vérifie que tu l'as copiée en entier.",
    });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        includedTypes: ["electrician"],
        maxResultCount: 1,
        // Rayon minimal en plein Atlantique : requête valide mais 0 résultat,
        // ce qui minimise le coût tout en exerçant la clé.
        locationRestriction: {
          circle: { center: { latitude: 0, longitude: 0 }, radius: 1 },
        },
      }),
    });

    if (res.ok) {
      return NextResponse.json({ valid: true });
    }

    // Google renvoie un corps JSON { error: { status, message } } sur échec.
    const body = (await res.json().catch(() => null)) as {
      error?: { status?: string; message?: string };
    } | null;
    const status = body?.error?.status ?? "";
    const message = body?.error?.message ?? "";

    return NextResponse.json({ valid: false, error: explain(res.status, status, message) });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Impossible de contacter Google pour vérifier la clé. Réessaie." },
      { status: 502 }
    );
  }
}

function explain(httpStatus: number, googleStatus: string, message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
    return "Cette clé est invalide. Vérifie que tu l'as bien copiée en entier.";
  }
  if (
    googleStatus === "PERMISSION_DENIED" ||
    lower.includes("has not been used") ||
    lower.includes("is disabled") ||
    lower.includes("not enabled")
  ) {
    return 'La clé fonctionne mais « Places API (New) » n\'est pas activée sur son projet Google Cloud (APIs & Services → Library → Places API (New) → Enable).';
  }
  if (lower.includes("referer") || lower.includes("referrer") || lower.includes("restrictions")) {
    return "Cette clé est restreinte et n'autorise pas Places API (New). Retire les restrictions d'application, ou restreins la clé à « Places API (New) » uniquement.";
  }
  if (httpStatus === 403 || googleStatus === "PERMISSION_DENIED") {
    return "Accès refusé par Google pour cette clé (API non activée ou clé restreinte).";
  }
  return message || "Clé refusée par Google.";
}
