"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// La validation de la clé (format + appel Google) se fait côté client via
// /api/validate-key, comme à l'inscription (src/app/signup/page.tsx) — cette
// action ne fait qu'enregistrer une clé déjà validée.
export async function updateGoogleApiKey(apiKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  const { error } = await supabase.auth.updateUser({
    data: { google_places_api_key: apiKey.trim() },
  });

  return { error: error?.message ?? null };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" as const };
  }

  if (newPassword.length < 6) {
    return { error: "Le mot de passe doit faire au moins 6 caractères." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  return { error: error?.message ?? null };
}

// Suppression irréversible du compte : ré-authentifie d'abord avec le mot de
// passe retapé (confirmation d'identité avant une action destructrice), puis
// supprime via la service role key (seule l'API admin peut supprimer un
// compte, le SDK client ne le permet pas). Les lignes liées (communes vues,
// artisans appelés, quota) partent en cascade — cf. migrations `on delete
// cascade`. Les artisans/communes en cache partagé ne sont pas touchés.
export async function deleteAccount(password: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "unauthenticated" as const };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (signInError) {
    return { error: "Mot de passe incorrect." };
  }

  const adminSupabase = createServiceRoleClient();
  const { error } = await adminSupabase.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();

  return { error: null };
}
