import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cible du lien de confirmation d'email (et magic link / reset). Supabase
// redirige ici avec un ?code=... (flux PKCE) qu'on échange contre une session
// posée dans les cookies, puis on renvoie l'utilisateur sur l'app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` permet de rediriger vers une page précise après confirmation.
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code manquant ou invalide/expiré : retour à la connexion avec un indicateur.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
