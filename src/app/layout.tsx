import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { AuthHeader } from "@/components/AuthHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artisa — Trouve les artisans sans site web",
  description:
    "Carte interactive des communes de France pour repérer les artisans sans site web à démarcher : téléphone et fiche Google, prêts à appeler.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Laisse le contenu passer sous l'encoche : on récupère l'espace via les
  // env(safe-area-inset-*) sur le header et les overlays.
  viewportFit: "cover",
  // La barre du navigateur épouse le thème (bg clair / bg sombre).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1a18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-full flex-col">
        {/* Résout le thème (choix stocké, sinon système) avant le premier paint
            pour éviter tout flash. ThemeToggle prend le relais ensuite. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
          }}
        />
        <AuthProvider>
          <AuthHeader />
          <div className="min-h-0 flex-1">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
