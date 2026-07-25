-- Résultats des vérifications du site d'un artisan (site down, responsive...),
-- indépendants du cache Google Places : aucune requête Google n'est impliquée,
-- on fetch directement le site de l'artisan. Voir src/lib/siteCheck.ts.
create table public.artisan_site_checks (
  artisan_id uuid primary key references public.artisans (id) on delete cascade,
  checked_at timestamptz not null default now(),
  is_reachable boolean not null,
  has_viewport_meta boolean,
  http_status int,
  error text
);

alter table public.artisan_site_checks enable row level security;

create policy "artisan_site_checks_select_authenticated"
  on public.artisan_site_checks for select
  to authenticated
  using (true);

-- Pas de policy insert/update pour authenticated : écrit uniquement par la
-- route serveur via la service role key, comme "artisans" et
-- "commune_search_cache".
