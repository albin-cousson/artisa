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

## Le seul quota qui compte : Place Details

Depuis le passage à Text Search (New) pour la découverte (2026-07-26, voir
`src/app/api/places/route.ts`, `TRADE_SEARCH_QUERIES`/`searchTradeCandidates`),
il n'y a plus qu'un seul appel qui coûte réellement quelque chose :

| Quota console (valeur recommandée) | Appel dans l'app | Quand ? | Facturation |
|---|---|---|---|
| `GetPlaceRequest` = **500/jour** (ou 33/jour pour un compte perso qui veut rester 100 % gratuit) | Place Details (New) — nom, téléphone, site web | **1 fois par artisan**, uniquement à la première exploration de sa commune (jusqu'à `MAX_DETAILS_PER_SEARCH` = 20 par commune) | SKU **Enterprise** (à cause de `nationalPhoneNumber`/`websiteUri`) : **1 000 gratuits/mois seulement**, puis 20 $/1000 |

La découverte (`searchTradeCandidates`, 14 requêtes Text Search en texte libre
par commune — une par métier de `TRADE_SEARCH_QUERIES`, dont électricien,
plombier, coiffeur, menuisier...) a son propre quota technique dans la
console (ex. `SearchTextRequest`/jour), mais **sa facturation avec un
FieldMask `places.id` seul est gratuite et illimitée** (tier "Text Search
Essentials IDs Only", vérifié sur la doc tarifaire Google en juillet 2026 —
pas encore confirmé en conditions réelles faute de clé de test). Pas besoin
de la plafonner soi-même comme `GetPlaceRequest` : le quota par défaut de
Google Cloud sur ce compteur est largement suffisant pour l'usage d'Artisa et
ne coûte rien quel que soit le volume.

## Limite des 20 artisans par commune

Une commune n'a normalement pas plus de 20 **nouveaux** artisans détaillés par
recherche — mais ce n'est plus une limite dure de Google comme avant :

1. Chaque requête Text Search renvoie jusqu'à 20 résultats bruts (`pageSize:
   20`) **par métier recherché**, avec pagination : Google plafonne chaque
   requête Text Search à **3 pages, soit 60 résultats maximum par métier**
   (limite propre à l'API, pas à Artisa). `search_progress`
   (`commune_search_cache`, migration 0006) retient par métier le
   `nextPageToken` de la page en cours pour cette commune : quand la page
   déjà connue ne renvoie plus aucun candidat nouveau, `refreshCommune` avance
   automatiquement à la page suivante avant de s'arrêter. Avec 14 métiers, la
   découverte peut donc remonter jusqu'à 14 × 60 = 840 candidats bruts avant
   dédoublonnage par `place_id` — un plafond largement théorique (peu de
   communes ont 60 coiffeurs ET 60 plombiers etc.), mais qui borne le pire cas.
2. C'est `MAX_DETAILS_PER_SEARCH = 20` (`src/app/api/places/route.ts`) qui
   plafonne volontairement le nombre de **Place Details** (l'étape payante)
   par *appel* à `refreshCommune` — un ouverture de commune ou un clic sur
   « Charger le reste » —, quel que soit le nombre de candidats trouvés. Ce
   n'est **pas** un plafond "par jour" : c'est le quota journalier du compte
   (33 par défaut, personnalisable, voir plus bas) qui joue ce rôle, en
   bornant `detailsBudget = min(MAX_DETAILS_PER_SEARCH, quota restant
   aujourd'hui)`. Une commune à 60+ candidats pour un même métier ne se
   complète donc pas automatiquement "jour après jour" : chaque nouveau lot
   (jusqu'à 20, ou moins si le quota du jour est presque épuisé) exige un
   nouveau clic sur « Charger le reste », qui peut avoir lieu plusieurs fois
   le même jour tant que le quota journalier n'est pas atteint.

Ce plafond est donc maintenant un choix de coût pur, pas une contrainte
technique de Google : le relever ne demande qu'à ajuster cette constante (et
le budget quota en face). « Charger le reste » relance la même recherche pour
rattraper les candidats déjà découverts mais pas encore détaillés (voir plus
bas), jusqu'à épuisement réel des nouveaux candidats de la commune.

## Coûts concrets

- Une commune jamais explorée coûte au pire : **0 $ de découverte** (14 Text
  Search Essentials IDs Only, gratuites/illimitées) + 20 Details (Enterprise)
  ≈ **0,40 $** hors franchise gratuite — légèrement moins qu'avant (0,43 $),
  et sur bien plus de métiers.
- À plein régime avec les quotas actuels : 500 Details/jour → les 1 000
  gratuits/mois sont consommés **en 2 jours**, puis ~20 $/1000 → jusqu'à
  ~280 $/mois si les quotas sont saturés tous les jours (inchangé : ce chiffre
  n'a jamais dépendu de la découverte, seulement de Place Details).
- Pour rester 100 % dans le gratuit : ~**33 `GetPlaceRequest`/jour** suffit —
  plus besoin de coordonner une deuxième valeur pour la découverte, elle ne
  coûte plus rien à aucun volume.

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
  aujourd'hui (`limite - déjà utilisé`) et l'utilise comme **budget explicite
  dans la boucle Place Details** (`detailsBudget = min(MAX_DETAILS_PER_SEARCH,
  quota restant)`, la boucle s'arrête dès que ce budget est atteint) : pour
  une grande ville avec un quota presque épuisé, on ne détaille que ce qu'on
  peut réellement se permettre, au lieu d'échouer en cours de route. La
  découverte (Text Search) n'est plus concernée par ce plafond puisqu'elle ne
  coûte rien.
- Si le quota est déjà à 0, Google n'est même pas appelé : message d'erreur
  clair immédiat.
- Une commune n'est marquée "entièrement explorée" (et donc mise en cache 60
  jours) **que si chaque nouveau candidat détecté a bien été traité**
  (`fetchedCount === newCandidates.length`) — sinon elle reste éligible à un
  nouveau rafraîchissement dès que le quota se régénère, avec un message
  "quota presque atteint" affiché à la place d'une liste silencieusement
  incomplète. Le panneau affiche alors un bouton « Charger le reste » (grisé
  « Quota atteint » tant que le quota du jour est à 0), qui relance simplement
  la même recherche.
- Ce nouveau rafraîchissement **ignore les artisans déjà en cache** pour la
  commune (Text Search reste quasi déterministe pour une même requête/lieu) —
  sinon "Charger le reste" re-dépenserait le quota sur les artisans déjà
  connus au lieu d'atteindre les nouveaux. Il n'y a plus de plafond Google dur
  à 20 par commune (voir "Limite des 20 artisans par commune" plus haut) :
  "Charger le reste" complète jusqu'à épuisement réel des nouveaux candidats,
  au rythme du budget quota disponible chaque jour.
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

- Il n'y a plus de paywall (retiré du produit, voir `CLAUDE.md`) : une fois
  connecté, tous les artisans d'une commune sont visibles immédiatement, sans
  lien avec les quotas Google. Les quotas journaliers restent donc le SEUL
  frein à la dépense Google, indépendamment de l'usage produit — ne pas les
  remonter à la légère.
- Baisser `MAX_DETAILS_PER_SEARCH` réduit directement le coût par commune
  (au prix de fiches en moins).
