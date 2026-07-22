"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/*
 * Bascule clair/sombre. L'état effectif est posé sur <html data-theme> avant le
 * paint par le script inline de layout.tsx ; ce composant le lit au montage, le
 * bascule au clic (persisté dans localStorage) et suit le système tant que
 * l'utilisateur n'a pas fait de choix manuel.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      // Ne suit le système que si aucun choix manuel n'a été enregistré.
      if (localStorage.getItem("theme")) return;
      const next: Theme = mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      setTheme(next);
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage indisponible (mode privé strict) : le choix ne persistera
      // pas, mais la bascule fonctionne pour la session en cours.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink transition-colors hover:bg-primary-wash/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent coarse:h-11 coarse:w-11"
    >
      {/* Rien tant que le thème n'est pas lu (évite un mismatch d'hydratation) */}
      {theme === null ? null : isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
