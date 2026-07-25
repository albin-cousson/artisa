# Google Places API (New) — quotas et facturation d'Artisa

Mémo de référence. Dernière mise à jour : 7 juillet 2026.

## Quotas ≠ facturation

- **Quota** (console Google Cloud → APIs → Places API (New) → Quotas) : plafond
  technique de requêtes par jour. Ne coûte rien, c'est un garde-fou — quota
  atteint = Google refuse les requêtes jusqu'au lendemain.
- **Facturation** : chaque requête réussie est comptée, avec une franchise
  gratuite **mensuelle** par type d'appel (SKU), remise à zéro chaque mois.
  Plus de crédit global de 200 $/mois depuis mars 2025.

**Important : débloquer un artisan (paywall) ne consomme AUCUNE requête
Google.** Google n'est appelé qu'à l'ouverture d'une commune jamais explorée
(ou dont le cache a dépassé 60 jours, `CACHE_TTL_DAYS`), par n'importe quel
visiteur. Ensuite tout est servi depuis le cache Supabase (`artisans`).

## Les deux quotas et ce qu'ils limitent

| Quota console (valeur actuelle) | Appel dans l'app | Quand ? | Facturation |
|---|---|---|---|
| `SearchNearbyRequest` = **25/jour** | Nearby Search (New) — trouve les IDs des artisans | **1 fois par commune** jamais cherchée (ou cache > 60 j) → 25 nouvelles communes/jour max, tous visiteurs confondus | SKU **Pro** : 5 000 gratuits/mois, puis 32 $/1000 (pas de tier moins cher même avec `FieldMask: places.id` seul) |
| `GetPlaceRequest` = **500/jour** | Place Details (New) — nom, téléphone, site web | **1 fois par artisan**, uniquement à la première exploration de sa commune (jusqu'à 20 par commune) | SKU **Enterprise** (à cause de `nationalPhoneNumber`/`websiteUri`) : **1 000 gratuits/mois seulement**, puis 20 $/1000 |

Les deux valeurs sont cohérentes entre elles : 25 communes × 20 détails = 500.

## Limite des 20 artisans par commune

Une commune ne peut PAS avoir plus de 20 artisans dans l'app :

1. Nearby Search (New) renvoie **20 résultats maximum par requête** — limite
   dure de Google, non contournable.
2. Le code demande ce plafond (`MAX_DETAILS_PER_SEARCH = 20` dans
   `src/app/api/places/route.ts`). C'est le principal levier de coût : chaque
   résultat = 1 Place Details au tarif Enterprise.

Pour une commune à 21+ artisans dans le rayon de 5 km : Google choisit les 20
plus pertinents, les autres n'existent jamais dans l'app (ce n'est pas « un
détail manquant », l'artisan n'est pas listé du tout). En pratique une commune
affiche moins de 20 fiches, car les artisans AVEC site web sont mis en cache
mais jamais montrés.

## Coûts concrets

- Une commune jamais explorée coûte au pire : 1 Nearby (Pro) + 20 Details
  (Enterprise) ≈ **0,43 $** hors franchise gratuite.
- À plein régime avec les quotas actuels : 500 Details/jour → les 1 000
  gratuits/mois sont consommés **en 2 jours**, puis ~20 $/1000 → jusqu'à
  ~280 $/mois si les quotas sont saturés tous les jours.
- Pour rester 100 % dans le gratuit : ~**33 `GetPlaceRequest`/jour** et
  ~166 `SearchNearby`/jour.

## Suivi du quota dans l'app

Avant ce changement, une ville avec beaucoup d'artisans (ex. Strasbourg)
pouvait épuiser le quota `GetPlaceRequest` en plein milieu de la boucle de
`refreshCommune` : les appels `Place Details` restants échouaient un par un
(juste loggés en `console.error`), mais la fonction finissait quand même par
marquer la commune comme "entièrement explorée" dans `commune_search_cache` —
résultat, une liste tronquée figée pendant `CACHE_TTL_DAYS` (60 jours), sans
aucun message d'erreur pour l'utilisateur (« rien ne s'affiche »).

`/api/places` fait maintenant le suivi et la prévention suivants :

- Chaque tentative de `Place Details` est journalisée dans la table
  `google_places_quota_usage` (une ligne par tentative, réussie ou non).
- Avant de rafraîchir une commune, l'API calcule le quota restant
  aujourd'hui (`limite - déjà utilisé`) et **plafonne `maxResultCount` du
  Nearby Search à ce restant** : pour une grande ville avec un quota presque
  épuisé, on ne demande que ce qu'on peut réellement détailler, au lieu de
  demander 20 et échouer en cours de route.
- Si le quota est déjà à 0, Google n'est même pas appelé : message d'erreur
  clair immédiat.
- Une commune n'est marquée "entièrement explorée" (et donc mise en cache 60
  jours) **que si rien n'a été tronqué par le budget restant** — sinon elle
  reste éligible à un nouveau rafraîchissement dès que le quota se
  régénère, avec un message "quota presque atteint" affiché à la place d'une
  liste silencieusement incomplète. Le panneau affiche alors un bouton
  « Charger le reste » (grisé « Quota atteint » tant que le quota du jour est
  à 0), qui relance simplement la même recherche.
- Ce nouveau rafraîchissement **ignore les artisans déjà en cache** pour la
  commune (Nearby Search est quasi déterministe : mêmes lieu/rayon/types →
  mêmes candidats) — sinon "Charger le reste" re-dépenserait le quota sur les
  artisans déjà connus au lieu d'atteindre les nouveaux. Le plafond de 20
  artisans par commune reste une limite dure de Google (Nearby Search ne
  renvoie jamais plus de 20 résultats) : "Charger le reste" complète jusqu'à
  ce plafond, il ne le dépasse jamais.
- **Fenêtre de renouvellement** : les quotas journaliers Google Cloud (dont
  `GetPlaceRequest`) se réinitialisent à **minuit heure Pacifique**
  (`America/Los_Angeles`, PST/PDT selon la saison — géré via `Intl` dans
  `src/lib/quota.ts`, pas un décalage fixe), soit environ **9h du matin,
  heure de Paris**, hiver comme été (les changements d'heure US/UE se
  compensent presque exactement). Ce n'est ni minuit en France, ni 24h après
  le premier appel du jour.
- La limite par défaut (33) est personnalisable par compte
  (`user_metadata.google_places_daily_quota`, réglable depuis le badge de
  quota dans l'en-tête — voir `src/components/QuotaBadge.tsx`), avec un
  avertissement : dépasser la franchise gratuite mensuelle réelle de Google
  peut engendrer des frais, et si la commune/les artisans ne sont pas encore
  dans la base communautaire, chaque recherche consomme bel et bien le quota
  du compte.

## Règles à retenir

- **Ne pas remonter les quotas** tant que `/api/places` ne vérifie pas les
  déblocages côté serveur : l'ouverture d'une commune étant gratuite pour
  l'utilisateur, les quotas journaliers sont aujourd'hui le SEUL frein à la
  dépense Google.
- Le paywall (10 artisans gratuits, +10 par 0,99 €) ne borne pas les coûts
  Google : il monétise, il ne protège pas. Coût pire cas d'une commune
  (~0,43 $) vs 0,99 € les 10 artisans → unit economics à surveiller.
- Baisser `MAX_DETAILS_PER_SEARCH` réduit directement le coût par commune
  (au prix de fiches en moins).
