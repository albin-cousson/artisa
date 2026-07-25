-- Suivi des appels Place Details (New) par compte, pour afficher un quota
-- Google restant "aujourd'hui" et éviter de lancer des recherches qui
-- échoueront silencieusement une fois le quota épuisé (voir
-- GOOGLE-PLACES-QUOTAS.md). Une ligne = une tentative de GetPlaceRequest,
-- insérée uniquement par la route serveur (service role key), jamais par le
-- client. "Aujourd'hui" est calculé côté application sur le fuseau
-- America/Los_Angeles : c'est la fenêtre de remise à zéro réelle des quotas
-- journaliers Google Cloud (minuit heure Pacifique), pas le fuseau du visiteur.
create table public.google_places_quota_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Sert à compter les lignes d'un utilisateur depuis le début du jour Pacifique.
create index google_places_quota_usage_user_created_idx
  on public.google_places_quota_usage (user_id, created_at);

alter table public.google_places_quota_usage enable row level security;

create policy "google_places_quota_usage_select_own"
  on public.google_places_quota_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- Pas de policy insert/update/delete pour authenticated : écrit uniquement par
-- la route serveur via la service role key (qui contourne RLS), comme pour
-- "artisans" et "commune_search_cache".
