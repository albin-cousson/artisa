# Artisa

Carte interactive de la France pour repérer les artisans **sans site web** à démarcher.

## Contexte

L'idée : une carte de France affichant les ~35 000 communes (villages et villes), qui apparaissent/disparaissent selon le niveau de zoom (clustering). En cliquant sur une commune, l'app affiche la liste des artisans locaux qui n'ont pas de site web (nom, téléphone, lien vers leur fiche Google) — l'objectif étant de les démarcher pour leur en créer un.

C'est une alternative gratuite et stylée à des outils comme scrapen.io. La carte est visible sans compte, mais voir les artisans d'une commune nécessite d'être connecté : chaque compte fournit sa propre clé Google Places API à l'inscription, donc les recherches consomment le quota/la facturation Google du compte lui-même, pas celui d'Artisa — c'est ce qui rend l'outil gratuit à faire tourner.

### Fonctionnalités

- Carte de France avec toutes les communes, clustering dynamique au zoom/dézoom (MapLibre GL)
- Clic sur une commune → panneau latéral listant les artisans sans site web (téléphone + fiche Google), récupérés via l'API Google Places (avec la clé du compte connecté) et mis en cache en base
- Navigation sur la carte libre sans compte ; connexion obligatoire pour ouvrir une commune et voir ses artisans
- Inscription (email/mot de passe + clé Google Places API personnelle)
- Case "Déjà appelé" par artisan (persistée côté compte), et un menu listant les communes déjà consultées

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) | Full-stack en un seul projet (pages + API routes), déploiement Vercel natif |
| Carte | MapLibre GL JS + `@vis.gl/react-maplibre` (clustering natif) | Rendu WebGL, gère 35k+ points sans lag, 100% gratuit, sans token |
| Fond de carte | [OpenFreeMap](https://openfreemap.org) (style `liberty`) | Tuiles vectorielles gratuites et illimitées, sans clé API |
| Données communes | [geo.api.gouv.fr](https://geo.api.gouv.fr) | API officielle gratuite, liste complète des communes avec coordonnées GPS |
| Backend | Next.js API routes + Server Actions | Pas de service séparé à héberger |
| Base de données & Auth | [Supabase](https://supabase.com) (Postgres + Auth + RLS) | Auth intégrée + Postgres relationnel, le tout en une seule intégration |
| Données artisans | [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service) — Nearby Search + Place Details | Seule voie légale pour ce besoin (le scraping de Google Maps viole ses conditions d'utilisation) ; chaque compte utilise sa propre clé |
| Hébergement (prévu) | Vercel (plan Hobby, gratuit) | Généreux pour un usage perso, déploiement automatique depuis GitHub |

## Prérequis

- Node.js 20+
- Un projet [Supabase](https://supabase.com) (gratuit) — partagé par tous les comptes de l'app
- Une clé [Google Places API (New)](https://console.cloud.google.com) **par compte utilisateur** avec facturation activée (le tier gratuit suffit pour un usage perso, voir [Coûts et quotas](#coûts-et-quotas-google-places)) — se renseigne directement dans le formulaire d'inscription, pas dans `.env.local`

## Installation

```bash
npm install
```

Créer un fichier `.env.local` à la racine (voir [Configuration Supabase](#configuration-supabase) ci-dessous) avec :

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Générer le fichier des communes (déjà fait une fois dans ce repo, à relancer seulement si besoin de rafraîchir les données) :

```bash
npm run fetch-communes
```

## Lancer le projet

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000). Cliquer sur une commune invite à créer un compte (email, mot de passe, clé Google Places API) ou à se connecter.

## Build & production

```bash
npm run build
npm run start
```

Autres commandes utiles :

```bash
npm run lint             # eslint
npm run fetch-communes    # régénère public/communes.geojson.json depuis geo.api.gouv.fr
```

Il n'y a pas encore de suite de tests.

## Configuration Supabase

1. Créer un compte sur [supabase.com](https://supabase.com) et un nouveau projet (région Europe recommandée).
2. Dans *Project Settings → API*, copier :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - la clé `publishable` (anciennement "anon key") → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - la `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secrète, ne jamais l'exposer côté client)
3. Dans *SQL Editor*, coller et exécuter le contenu de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — crée les tables `artisans`, `commune_search_cache`, `user_artisan_calls`, et les policies RLS.
4. *Authentication → Providers* : l'email/mot de passe est activé par défaut, rien d'autre à faire.

## Clé Google Places API (par compte)

Il n'y a pas de clé Google partagée dans `.env.local` : chaque utilisateur crée la sienne et la renseigne à l'inscription.

1. Créer/utiliser un projet sur [Google Cloud Console](https://console.cloud.google.com).
2. *APIs & Services → Library* : activer **"Places API (New)"**.
3. *APIs & Services → Credentials* : créer une clé API, la restreindre à "Places API (New)".
4. Activer un compte de facturation (obligatoire même pour rester dans le tier gratuit) et configurer une alerte de budget par précaution.
5. Coller cette clé dans le champ dédié du formulaire d'inscription sur Artisa.

### Coûts et quotas Google Places

Les champs `nationalPhoneNumber` et `websiteUri` (indispensables pour ce produit) sont facturés au tier **Enterprise** de Google Places, le plus cher (~1000 appels gratuits/mois **par compte Google Cloud**, donc par utilisateur Artisa). Deux garde-fous sont en place dans `src/app/api/places/route.ts` :
- `MAX_DETAILS_PER_SEARCH` (20) limite le nombre d'appels Place Details par recherche de commune — c'est le curseur principal pour maîtriser le coût.
- `commune_search_cache` (TTL 60 jours, partagé entre tous les comptes) évite de repayer pour une commune déjà explorée récemment, même par un autre compte.

## Déploiement

**Petit trafic (gratuit)** : connecter le repo GitHub à [Vercel](https://vercel.com) (plan Hobby), ajouter les 3 variables d'environnement Supabase dans *Project Settings → Environment Variables*, déploiement automatique à chaque push sur `main`.

**Fort trafic** : le vrai plafond gratuit est le quota Google Places (1000 appels Enterprise/mois par compte), pas l'hébergement.

## Architecture

Voir [`CLAUDE.md`](CLAUDE.md) pour le détail de l'architecture (flux de données communes/artisans, gate d'authentification, clé Google par compte, structure des clients Supabase, schéma de base de données).
