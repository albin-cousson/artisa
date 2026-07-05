-- Schéma initial : cache des artisans (Google Places) + avis communautaires (smiley + texte)

create extension if not exists "pgcrypto";

-- Cache des fiches Google Places par commune, pour éviter de refacturer les appels
-- Place Details (New) à chaque visite utilisateur. Alimenté uniquement côté serveur
-- (route API utilisant la service role key), jamais depuis le client.
create table if not exists public.artisans (
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

create index if not exists artisans_commune_code_idx on public.artisans (commune_code);
-- Les artisans "à démarcher" sont ceux sans site web
create index if not exists artisans_no_website_idx on public.artisans (commune_code) where website_uri is null;

alter table public.artisans enable row level security;

-- Lecture publique : la carte doit fonctionner sans compte
create policy "artisans_select_all"
  on public.artisans for select
  to anon, authenticated
  using (true);

-- Pas de policy insert/update/delete pour anon/authenticated : le cache n'est
-- écrit que par la route serveur via la service role key (qui contourne RLS).

-- Marque les communes déjà interrogées auprès de Google Places, même si aucun
-- artisan sans site web n'y a été trouvé. Sans cette table, l'absence de lignes
-- dans "artisans" pour une commune serait ambiguë (jamais cherché ? ou cherché
-- et aucun résultat ?), ce qui déclencherait un appel Google à chaque visite.
create table if not exists public.commune_search_cache (
  commune_code text primary key,
  searched_at timestamptz not null default now()
);

alter table public.commune_search_cache enable row level security;

create policy "commune_search_cache_select_all"
  on public.commune_search_cache for select
  to anon, authenticated
  using (true);

-- Avis communautaires : texte libre + smiley vert/orange/rouge
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  smiley text not null check (smiley in ('green', 'orange', 'red')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artisan_id, user_id)
);

create index if not exists reviews_artisan_id_idx on public.reviews (artisan_id);

alter table public.reviews enable row level security;

-- Lecture publique des avis (y compris visiteurs non connectés)
create policy "reviews_select_all"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Seul un utilisateur connecté peut poster, et uniquement en son propre nom
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "reviews_update_own"
  on public.reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews_delete_own"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- Maintient updated_at à jour sur modification d'un avis
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

-- Moyenne des smileys par artisan (vert = 1, orange = 0.5, rouge = 0), affichée
-- à côté du nom du commerçant pour évaluer sa pertinence en un coup d'œil.
-- security_invoker : la vue respecte les policies RLS de reviews plutôt que les
-- privilèges de son créateur.
create or replace view public.artisan_ratings
with (security_invoker = true) as
select
  artisan_id,
  count(*) filter (where smiley = 'green') as green_count,
  count(*) filter (where smiley = 'orange') as orange_count,
  count(*) filter (where smiley = 'red') as red_count,
  count(*) as total_count,
  round(
    (
      count(*) filter (where smiley = 'green') * 1.0
      + count(*) filter (where smiley = 'orange') * 0.5
      + count(*) filter (where smiley = 'red') * 0.0
    ) / nullif(count(*), 0),
    2
  ) as average_score
from public.reviews
group by artisan_id;
