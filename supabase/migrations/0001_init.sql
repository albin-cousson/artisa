-- Schéma initial d'Artisa : cache des artisans (Google Places) + suivi
-- "déjà appelé" par compte. Pas de paywall, pas d'avis : connexion requise
-- pour voir les artisans d'une commune, chaque compte utilisant sa propre
-- clé Google Places (stockée dans auth.users.raw_user_meta_data, pas ici).

create extension if not exists "pgcrypto";

-- Cache des fiches Google Places par commune, pour éviter de refacturer les appels
-- Place Details (New) à chaque visite. Alimenté uniquement côté serveur
-- (route API utilisant la service role key), jamais depuis le client.
create table public.artisans (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  commune_code text not null,
  display_name text not null,
  national_phone_number text,
  google_maps_uri text,
  website_uri text,
  category text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index artisans_commune_code_idx on public.artisans (commune_code);
-- Les artisans "à démarcher" sont ceux sans site web
create index artisans_no_website_idx on public.artisans (commune_code) where website_uri is null;

alter table public.artisans enable row level security;

-- Lecture réservée aux utilisateurs connectés (voir les artisans nécessite un compte)
create policy "artisans_select_authenticated"
  on public.artisans for select
  to authenticated
  using (true);

-- Pas de policy insert/update/delete pour authenticated : le cache n'est
-- écrit que par la route serveur via la service role key (qui contourne RLS).

-- Marque les communes déjà interrogées auprès de Google Places, même si aucun
-- artisan sans site web n'y a été trouvé. Sans cette table, l'absence de lignes
-- dans "artisans" pour une commune serait ambiguë (jamais cherché ? ou cherché
-- et aucun résultat ?), ce qui déclencherait un appel Google à chaque visite.
create table public.commune_search_cache (
  commune_code text primary key,
  searched_at timestamptz not null default now()
);

alter table public.commune_search_cache enable row level security;

create policy "commune_search_cache_select_authenticated"
  on public.commune_search_cache for select
  to authenticated
  using (true);

-- Suivi "déjà appelé" par artisan, par utilisateur connecté, pour éviter de
-- redémarcher un artisan déjà contacté. Persisté côté serveur (pas
-- localStorage) pour se synchroniser entre appareils.
create table public.user_artisan_calls (
  user_id uuid not null references auth.users (id) on delete cascade,
  artisan_id uuid not null references public.artisans (id) on delete cascade,
  called_at timestamptz not null default now(),
  primary key (user_id, artisan_id)
);

alter table public.user_artisan_calls enable row level security;

create policy "user_artisan_calls_select_own"
  on public.user_artisan_calls for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_artisan_calls_insert_own"
  on public.user_artisan_calls for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Delete (et pas juste insert) car la case doit pouvoir être décochée.
create policy "user_artisan_calls_delete_own"
  on public.user_artisan_calls for delete
  to authenticated
  using (auth.uid() = user_id);

-- Historique des communes consultées par utilisateur, pour le menu "Mes
-- artisans" (src/components/UnlockedArtisansMenu.tsx). Les artisans eux-mêmes
-- restent un cache partagé lié à la commune (table "artisans" ci-dessus) —
-- seul le lien "quel user a regardé quelle commune" est propre à chaque
-- compte. Colonnes dénormalisées (pas de FK vers un référentiel communes,
-- qui n'existe pas en base — cf. public/communes.geojson.json) pour pouvoir
-- rouvrir le panneau sans re-parser le GeoJSON.
create table public.user_viewed_communes (
  user_id uuid not null references auth.users (id) on delete cascade,
  commune_code text not null,
  commune_nom text not null,
  commune_code_postal text,
  commune_population int,
  commune_lat double precision not null,
  commune_lng double precision not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, commune_code)
);

alter table public.user_viewed_communes enable row level security;

create policy "user_viewed_communes_select_own"
  on public.user_viewed_communes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_viewed_communes_insert_own"
  on public.user_viewed_communes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Update (pas juste insert) car revisiter une commune déjà connue doit
-- rafraîchir viewed_at via upsert (onConflict user_id,commune_code).
create policy "user_viewed_communes_update_own"
  on public.user_viewed_communes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
