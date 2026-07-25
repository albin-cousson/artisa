import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// Valeur recommandée dans GOOGLE-PLACES-QUOTAS.md et ApiKeyHelpModal pour
// rester 100 % dans la franchise gratuite mensuelle (1000 GetPlaceRequest/mois
// ÷ 30). Chaque compte peut la personnaliser s'il a réglé une autre limite
// dans sa console Google Cloud.
export const DEFAULT_DAILY_QUOTA = 33;
export const MIN_DAILY_QUOTA = 1;
// Plafond de saisie : la franchise gratuite mensuelle totale, au cas où
// quelqu'un désactive volontairement le garde-fou journalier.
export const MAX_DAILY_QUOTA = 1000;

export interface QuotaStatus {
  used: number;
  limit: number;
}

/**
 * Début (instant UTC) du jour calendaire à Los Angeles contenant `date`.
 * C'est la fenêtre de remise à zéro des quotas journaliers Google Cloud
 * (minuit heure Pacifique, PST ou PDT selon la saison) — pas minuit dans le
 * fuseau du visiteur. `% 24` protège contre le quirk Intl qui rend parfois
 * l'heure "24" à minuit pile avec hour12: false.
 */
export function pacificDayStart(date: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);

  const year = get("year");
  const month = get("month") - 1;
  const day = get("day");

  const asIfUtc = Date.UTC(year, month, day, get("hour") % 24, get("minute"), get("second"));
  const offsetMs = asIfUtc - date.getTime();
  const midnightAsIfUtc = Date.UTC(year, month, day, 0, 0, 0);
  return new Date(midnightAsIfUtc - offsetMs);
}

export async function countQuotaUsedToday(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("google_places_quota_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", pacificDayStart().toISOString());

  return count ?? 0;
}

export function getDailyQuotaLimit(user: Pick<User, "user_metadata">): number {
  const raw = user.user_metadata?.google_places_daily_quota;
  const n = Number(raw);
  return Number.isFinite(n) && n >= MIN_DAILY_QUOTA ? Math.floor(n) : DEFAULT_DAILY_QUOTA;
}

// Événement client pour rafraîchir QuotaBadge en instantané après un appel à
// /api/places, sans que ce dernier ait besoin de connaître le composant.
export const QUOTA_UPDATED_EVENT = "artisa:quota-updated";

export function notifyQuotaUpdated(quota: QuotaStatus) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuotaStatus>(QUOTA_UPDATED_EVENT, { detail: quota }));
}
