"use server";

import { createClient } from "@/lib/supabase/server";
import {
  MAX_DAILY_QUOTA,
  MIN_DAILY_QUOTA,
  countQuotaUsedToday,
  getDailyQuotaLimit,
  type QuotaStatus,
} from "@/lib/quota";

// null si non connecté (ne devrait pas arriver : QuotaBadge n'est rendu
// qu'après connexion, voir AuthHeader).
export async function getQuotaStatus(): Promise<QuotaStatus | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const used = await countQuotaUsedToday(supabase, user.id);
  return { used, limit: getDailyQuotaLimit(user) };
}

export async function setDailyQuotaLimit(limit: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  if (!Number.isFinite(limit) || limit < MIN_DAILY_QUOTA || limit > MAX_DAILY_QUOTA) {
    return { error: `La limite doit être un nombre entre ${MIN_DAILY_QUOTA} et ${MAX_DAILY_QUOTA}.` };
  }

  const { error } = await supabase.auth.updateUser({
    data: { google_places_daily_quota: Math.floor(limit) },
  });

  return { error: error?.message ?? null };
}
