"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ApiKeyHelpButton } from "@/components/ApiKeyHelpModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Vérifie la clé auprès de Google avant de créer le compte : évite qu'un
    // compte démarre avec une clé cassée (commune faussement "vide" ensuite).
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: googleApiKey }),
      });
      const result = (await res.json()) as { valid: boolean; error?: string };
      if (!result.valid) {
        setLoading(false);
        setError(result.error ?? "Clé Google Places invalide.");
        return;
      }
    } catch {
      setLoading(false);
      setError("Impossible de vérifier la clé pour le moment. Réessaie.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { google_places_api_key: googleApiKey },
        // Utilise l'origine réelle (localhost en dev, domaine de prod en prod)
        // au lieu du "Site URL" fixe du dashboard Supabase, pour que le lien du
        // mail de confirmation pointe toujours vers le bon environnement.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // La confirmation d'email est désactivée : signUp ouvre directement une
    // session. On redirige vers le compte avec un flag pour afficher la pop-up
    // de bienvenue. (On ne remet pas setLoading(false) : la navigation suit.)
    router.push("/?welcome=1");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Clé API Google Places
          <Input
            mono
            type="text"
            required
            value={googleApiKey}
            onChange={(e) => setGoogleApiKey(e.target.value)}
          />
          <span className="text-xs font-normal text-muted">
            Ta propre clé (Google Cloud Console → APIs &amp; Services → Credentials, avec
            &quot;Places API (New)&quot; activée) : les recherches se font avec ton propre quota,
            c&apos;est ce qui permet d&apos;utiliser Artisa gratuitement.
          </span>
          <ApiKeyHelpButton className="mt-1" />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-accent underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
