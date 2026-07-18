"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Bouton + modale explicative sur la clé Google Places et les quotas.
 * Auto-suffisant : gère son propre état d'ouverture, se pose n'importe où.
 *
 * `includeSetup` :
 *  - `true`  (défaut) → inclut les étapes de création de la clé (page d'inscription).
 *  - `false` → variante « déjà connecté » : on saute la création de clé, on ne
 *    garde que la config des quotas et l'explication communautaire.
 */
export function ApiKeyHelpButton({
  className = "",
  includeSetup = true,
  label = "Où trouver sa clé API ?",
  buttonClassName,
}: {
  className?: string;
  includeSetup?: boolean;
  label?: string;
  /** Remplace le style par défaut (lien souligné). `className` reste ajouté ensuite. */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const base =
    buttonClassName ??
    "text-left text-xs font-medium underline underline-offset-2 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${base} ${className}`}>
        {label}
      </button>
      {open && <ApiKeyHelpModal includeSetup={includeSetup} onClose={() => setOpen(false)} />}
    </>
  );
}

function ApiKeyHelpModal({
  includeSetup,
  onClose,
}: {
  includeSetup: boolean;
  onClose: () => void;
}) {
  // Numérotation des sections : décalée d'un cran quand la création de clé est masquée.
  const quotaStep = includeSetup ? 2 : 1;
  const communityStep = includeSetup ? 3 : 2;

  // Portal vers <body> : sinon la modale reste dans le contexte d'empilement du
  // <header> (backdrop-blur) et passe SOUS la carte MapLibre rendue après lui.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {includeSetup
              ? "Où trouver sa clé Google Places API ?"
              : "Rester 100 % gratuit"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Chaque compte utilise sa propre clé : les recherches sont facturées sur ton propre
          quota Google Cloud, pas sur un compte partagé. C&apos;est ce qui permet à Artisa de
          rester gratuit. Avec la configuration ci-dessous, tu peux rester{" "}
          <strong>entièrement dans la franchise gratuite mensuelle</strong> de Google.
        </p>

        {/* Étapes de création de la clé — inutiles une fois connecté */}
        {includeSetup && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">1. Créer la clé</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-black/70 dark:text-white/70">
            <li>
              Ouvre la{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Google Cloud Console
              </a>{" "}
              et connecte-toi avec un compte Google.
            </li>
            <li>
              En haut, crée un projet (ou sélectionne-en un existant).
            </li>
            <li>
              Active la facturation :{" "}
              <span className="whitespace-nowrap font-medium">Billing → Link a billing account</span>{" "}
              (une carte bancaire est demandée, mais rien n&apos;est prélevé tant que tu restes
              dans la franchise gratuite).
            </li>
            <li>
              Active l&apos;API :{" "}
              <span className="font-medium">APIs &amp; Services → Library</span>, cherche{" "}
              <span className="font-mono text-xs">Places API (New)</span> et clique{" "}
              <span className="font-medium">Enable</span>.{" "}
              <strong>Bien la version « (New) »</strong>, pas l&apos;ancienne « Places API ».
            </li>
            <li>
              Crée la clé :{" "}
              <span className="font-medium">
                APIs &amp; Services → Credentials → Create credentials → API key
              </span>
              . Copie la clé affichée.
            </li>
            <li>
              Recommandé — restreins la clé (bouton{" "}
              <span className="font-medium">Edit API key</span>) :{" "}
              <span className="font-medium">API restrictions → Restrict key → Places API (New)</span>
              . Ainsi, si la clé fuite, elle ne sert qu&apos;à ça.
            </li>
            <li>Colle enfin la clé dans le champ « Clé API Google Places » du formulaire.</li>
          </ol>
        </section>
        )}

        {/* Quotas */}
        <section className="mt-5">
          <h3 className="text-sm font-semibold">
            {quotaStep}. Régler la limite pour rester gratuit
          </h3>
          <p className="mt-2 text-sm text-black/70 dark:text-white/70">
            Chaque fois qu&apos;un artisan est découvert pour la première fois (son nom, son
            téléphone, son lien Google Maps), Google facture <strong>1 requête</strong>. Google
            en offre <strong>1 000 gratuites par mois</strong>, soit{" "}
            <strong>≈ 33 par jour</strong>. Il suffit donc de dire à Google : « ne dépasse jamais
            33 par jour » — et tu ne paieras jamais rien.
          </p>
          <p className="mt-2 text-sm text-black/70 dark:text-white/70">
            Dans la console, va dans{" "}
            <span className="font-medium">APIs &amp; Services → Places API (New) → Quotas</span>,
            trouve la ligne <span className="font-mono text-xs">GetPlaceRequest (per day)</span>,
            clique dessus (l&apos;icône crayon) et mets la valeur :
          </p>
          <div className="mt-3 rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
            <p className="font-mono text-xs font-semibold">GetPlaceRequest = 33 / jour</p>
            <p className="mt-1 text-black/60 dark:text-white/60">
              Concrètement, cette limite te laisse découvrir jusqu&apos;à{" "}
              <strong>33 artisans encore jamais trouvés par la communauté chaque jour</strong>,
              toujours gratuitement. Une fois ces 33 atteints, Google met simplement en pause les
              nouvelles découvertes jusqu&apos;au lendemain — rien n&apos;est facturé, rien
              n&apos;est cassé.
            </p>
          </div>
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            Cette limite ne concerne <strong>que les artisans jamais découverts</strong>. Tous
            ceux déjà enregistrés (par toi ou un autre membre) restent consultables à volonté,
            sans jamais compter dans ce plafond ni rien coûter.
          </p>
        </section>

        {/* Communauté / cache */}
        <section className="mt-5">
          <h3 className="text-sm font-semibold">
            {communityStep}. La communauté rend l&apos;app gratuite
          </h3>
          <p className="mt-2 text-sm text-black/70 dark:text-white/70">
            Google n&apos;est appelé qu&apos;à la <strong>toute première</strong> exploration
            d&apos;une commune. Les résultats sont ensuite enregistrés dans une base partagée, si
            bien que le membre suivant les lit gratuitement — sans consommer son quota. Plus la
            communauté explore de communes, moins chacun a besoin d&apos;appeler Google.
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-black/70 dark:text-white/70">
            <li>
              <span className="font-medium">Les artisans trouvés</span> — nom, téléphone, lien
              Google Maps, présence ou non d&apos;un site web. Mis en cache pour ne jamais
              re-interroger Google sur cette commune.
            </li>
            <li>
              <span className="font-medium">Les communes déjà cherchées</span> (et la date) —
              pour distinguer « jamais explorée » de « explorée, aucun artisan sans site », et
              éviter de payer une recherche inutile.
            </li>
          </ul>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Aucune donnée personnelle n&apos;est partagée : seules ces informations publiques
            d&apos;entreprises (issues de Google Places) le sont.
          </p>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black"
          >
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
