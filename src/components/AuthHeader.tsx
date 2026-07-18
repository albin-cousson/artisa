"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ApiKeyHelpButton } from "@/components/ApiKeyHelpModal";
import { GithubStarButton } from "@/components/GithubStarButton";

const HEADER_BUTTON_CLASS =
  "rounded-md border border-black/15 px-3 py-1.5 font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

export function AuthHeader() {
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <span className="text-lg font-semibold tracking-tight">Artisa</span>
      <div className="flex items-center gap-3 text-sm">
        {loading ? null : user ? (
          <>
            <span className="hidden text-black/60 sm:inline dark:text-white/60">
              {user.email}
            </span>
            <ApiKeyHelpButton
              includeSetup={false}
              label="Aide & quotas"
              buttonClassName={HEADER_BUTTON_CLASS}
            />
            <GithubStarButton buttonClassName={HEADER_BUTTON_CLASS} className="text-sm" />
            <button onClick={handleSignOut} className={HEADER_BUTTON_CLASS}>
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-black px-3 py-1.5 font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              Créer un compte
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
