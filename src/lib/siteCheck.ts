import type { SupabaseClient } from "@supabase/supabase-js";

// Indépendant du cache/quota Google Places : on fetch directement le site de
// l'artisan, aucune requête Google impliquée.
const CHECK_TTL_DAYS = 14;
const FETCH_TIMEOUT_MS = 8000;

export interface SiteCheckResult {
  isReachable: boolean;
  hasViewportMeta: boolean | null;
  httpStatus: number | null;
  error: string | null;
}

const VIEWPORT_META_RE = /<meta[^>]+name=["']viewport["'][^>]*>/i;

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

async function checkSite(url: string): Promise<SiteCheckResult> {
  if (!isSafeUrl(url)) {
    return { isReachable: false, hasViewportMeta: null, httpStatus: null, error: "URL non autorisée" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArtisaBot/1.0)" },
    });

    if (!res.ok) {
      return { isReachable: false, hasViewportMeta: null, httpStatus: res.status, error: null };
    }

    const html = await res.text();
    return {
      isReachable: true,
      hasViewportMeta: VIEWPORT_META_RE.test(html),
      httpStatus: res.status,
      error: null,
    };
  } catch (err) {
    return {
      isReachable: false,
      hasViewportMeta: null,
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
  const { data: existingChecks } = await supabase
    .from("artisan_site_checks")
    .select("artisan_id, checked_at")
    .in("artisan_id", ids);

  const freshCutoff = Date.now() - CHECK_TTL_DAYS * 24 * 60 * 60 * 1000;
  const freshIds = new Set(
    (existingChecks ?? [])
      .filter((c) => new Date(c.checked_at).getTime() >= freshCutoff)
      .map((c) => c.artisan_id)
  );

  const toCheck = withSite.filter((a) => !freshIds.has(a.id));
  if (toCheck.length === 0) return;

  await Promise.allSettled(
    toCheck.map(async (artisan) => {
      const result = await checkSite(artisan.website_uri);
      await supabase.from("artisan_site_checks").upsert(
        {
          artisan_id: artisan.id,
          checked_at: new Date().toISOString(),
          is_reachable: result.isReachable,
          has_viewport_meta: result.hasViewportMeta,
          http_status: result.httpStatus,
          error: result.error,
        },
        { onConflict: "artisan_id" }
      );
    })
  );
}
