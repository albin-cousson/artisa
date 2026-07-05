"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">Vérifie ta boîte mail</h1>
        <p className="text-black/60 dark:text-white/60">
          Un email de confirmation vient de t&apos;être envoyé. Clique sur le lien pour activer
          ton compte, puis connecte-toi.
        </p>
        <Link href="/login" className="font-medium underline">
          Retour à la connexion
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-black/30"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>
      <p className="text-sm text-black/60 dark:text-white/60">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
