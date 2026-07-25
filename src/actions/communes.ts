"use server";

import { createClient } from "@/lib/supabase/server";
import type { CommuneProperties } from "@/lib/types";

// Mémorise qu'une commune a été consultée par l'utilisateur connecté, pour le
// menu "Mes artisans" (upsert : revisiter une commune déjà connue rafraîchit
// juste viewed_at). No-op si non connecté (ne devrait pas arriver : ArtisanPanel
// n'est rendu qu'après connexion).
export async function recordViewedCommune(commune: CommuneProperties) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from("user_viewed_communes").upsert(
    {
      user_id: user.id,
      commune_code: commune.code,
      commune_nom: commune.nom,
      commune_code_postal: commune.codePostal,
      commune_population: commune.population,
      commune_lat: commune.lat,
      commune_lng: commune.lng,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,commune_code" }
  );

  if (error) {
    console.error("recordViewedCommune failed:", error.message);
  }
}

// Retire une commune du menu "Mes artisans" : supprime uniquement le lien
// user <-> commune. La commune et ses artisans restent en cache partagé,
// toujours consultables gratuitement par n'importe quel utilisateur (y
// compris celui-ci, en la rouvrant depuis la carte).
export async function removeViewedCommune(communeCode: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  const { error } = await supabase
    .from("user_viewed_communes")
    .delete()
    .eq("user_id", user.id)
    .eq("commune_code", communeCode);

  return { error: error?.message ?? null };
}

export async function listViewedCommunes(): Promise<CommuneProperties[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("user_viewed_communes")
    .select("commune_code, commune_nom, commune_code_postal, commune_population, commune_lat, commune_lng")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false });

  return (data ?? []).map((row) => ({
    code: row.commune_code,
    nom: row.commune_nom,
    codePostal: row.commune_code_postal,
    population: row.commune_population,
    lat: row.commune_lat,
    lng: row.commune_lng,
  }));
}
