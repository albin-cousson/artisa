"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Se connecter</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-medium text-accent underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
