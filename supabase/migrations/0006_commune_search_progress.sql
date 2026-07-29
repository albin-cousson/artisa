-- Pagination Text Search (New) : par métier recherché, le token de la page en
-- cours pour cette commune (voir src/app/api/places/route.ts). searched_at ne
-- doit plus être posé par défaut : une commune pas encore entièrement
-- explorée doit rester "pas fraîche" tant qu'elle n'est pas complète, sinon
-- elle serait figée 60 jours avec une pagination à moitié faite.
alter table public.commune_search_cache
  add column search_progress jsonb,
  alter column searched_at drop not null,
  alter column searched_at drop default;
