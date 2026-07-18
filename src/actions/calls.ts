"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Renvoie les artisans (parmi artisanIds) déjà marqués comme appelés par
 * l'utilisateur connecté. Tableau vide si non connecté (ne devrait pas
 * arriver : ArtisanPanel n'est rendu qu'après connexion).
 */
export async function getCalledArtisanIds(artisanIds: string[]): Promise<string[]> {
  if (artisanIds.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("user_artisan_calls")
    .select("artisan_id")
    .eq("user_id", user.id)
    .in("artisan_id", artisanIds);

  return (data ?? []).map((row) => row.artisan_id);
}

export async function setArtisanCalled(artisanId: string, called: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  const { error } = called
    ? await supabase
        .from("user_artisan_calls")
        .upsert({ user_id: user.id, artisan_id: artisanId }, { onConflict: "user_id,artisan_id" })
    : await supabase
        .from("user_artisan_calls")
        .delete()
        .eq("user_id", user.id)
        .eq("artisan_id", artisanId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
