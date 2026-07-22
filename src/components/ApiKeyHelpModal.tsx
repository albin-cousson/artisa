"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Bouton + modale explicative sur la clé Google Places et les quotas.
 * Auto-suffisant : gère son propre état d'ouverture, se pose n'importe où.
 *
 * `includeSetup` :
 *  - `true`  (défaut) → inclut les étapes de création de la clé (page d'inscription).
 *  - `false` → variante « déjà connecté » : on saute la création de clé, on ne
 *    garde que la config des quotas et l'explication du cache partagé.
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
    "focus-ring rounded-sm text-left text-xs font-medium text-muted underline underline-offset-2 hover:text-ink";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(base, className)}>
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

  return (
    <Modal
      onClose={onClose}
      size="lg"
      className="max-h-[85vh] overflow-y-auto"
      labelledBy="apikey-help-title"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="apikey-help-title" className="text-lg font-semibold">
          {includeSetup ? "Où trouver sa clé Google Places API ?" : "Rester 100 % gratuit"}
        </h2>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="focus-ring -mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-ink/5"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 text-sm text-muted">
        Chaque compte utilise sa propre clé : les recherches sont facturées sur ton propre
        quota Google Cloud, pas sur un compte partagé. C&apos;est ce qui permet à Artisa de
        rester gratuit. Avec la configuration ci-dessous, tu peux rester{" "}
        <strong>entièrement dans la franchise gratuite mensuelle</strong> de Google.
      </p>

      {/* Étapes de création de la clé — inutiles une fois connecté */}
      {includeSetup && (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">1. Créer la clé</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">
            <li>
              Ouvre la{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline"
              >
                Google Cloud Console
              </a>{" "}
              et connecte-toi avec un compte Google.
            </li>
            <li>En haut, crée un projet (ou sélectionne-en un existant).</li>
            <li>
              Active la facturation :{" "}
              <span className="whitespace-nowrap font-medium">
                Billing → Link a billing account
              </span>{" "}
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
              <span className="font-medium">
                API restrictions → Restrict key → Places API (New)
              </span>
              . Ainsi, si la clé fuite, elle ne sert qu&apos;à ça.
            </li>
            <li>Colle enfin la clé dans le champ « Clé API Google Places » du formulaire.</li>
          </ol>
        </section>
      )}

      {/* Quotas */}
      <section className="mt-5">
        <h3 className="text-sm font-semibold">{quotaStep}. Régler la limite pour rester gratuit</h3>
        <p className="mt-2 text-sm text-ink">
          Chaque fois qu&apos;un artisan est découvert pour la première fois (son nom, son
          téléphone, son lien Google Maps), Google facture <strong>1 requête</strong>. Google
          en offre <strong>1 000 gratuites par mois</strong>, soit{" "}
          <strong>≈ 33 par jour</strong>. Il suffit donc de dire à Google : « ne dépasse jamais
          33 par jour » — et tu ne paieras jamais rien.
        </p>
        <p className="mt-2 text-sm text-ink">
          Dans la console, va dans{" "}
          <span className="font-medium">APIs &amp; Services → Places API (New) → Quotas</span>,
          trouve la ligne{" "}
          <span className="font-mono text-xs">GetPlaceRequest (per day)</span>, clique dessus
          (l&apos;icône crayon) et mets la valeur :
        </p>
        <div className="mt-3 rounded-md border border-border p-3 text-sm">
          <p className="font-mono text-xs font-semibold tabular">GetPlaceRequest = 33 / jour</p>
          <p className="mt-1 text-muted">
            Concrètement, cette limite te laisse découvrir jusqu&apos;à{" "}
            <strong>33 artisans encore jamais trouvés par la communauté chaque jour</strong>,
            toujours gratuitement. Une fois ces 33 atteints, Google met simplement en pause les
            nouvelles découvertes jusqu&apos;au lendemain — rien n&apos;est facturé, rien
            n&apos;est cassé.
          </p>
        </div>
        <p className="mt-3 text-xs text-muted">
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
        <p className="mt-2 text-sm text-ink">
          Google n&apos;est appelé qu&apos;à la <strong>toute première</strong> exploration
          d&apos;une commune. Les résultats sont ensuite enregistrés dans une base partagée, si
          bien que le membre suivant les lit gratuitement — sans consommer son quota. Plus la
          communauté explore de communes, moins chacun a besoin d&apos;appeler Google.
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
          <li>
            <span className="font-medium">Les artisans trouvés</span> — nom, téléphone, lien
            Google Maps, présence ou non d&apos;un site web. Mis en cache pour ne jamais
            re-interroger Google sur cette commune.
          </li>
          <li>
            <span className="font-medium">Les communes déjà cherchées</span> (et la date) — pour
            distinguer « jamais explorée » de « explorée, aucun artisan sans site », et éviter de
            payer une recherche inutile.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted">
          Aucune donnée personnelle n&apos;est partagée : seules ces informations publiques
          d&apos;entreprises (issues de Google Places) le sont.
        </p>
      </section>

      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>J&apos;ai compris</Button>
      </div>
    </Modal>
  );
}
