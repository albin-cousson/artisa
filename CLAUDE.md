# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design Context

Strategic design context lives in `PRODUCT.md` (root): register `product`, platform `web`, target users = freelances/commerciaux doing cold-outreach (each with their own Google Places key), personality "efficace, direct, pro", anti-reference = never look like a Pages Jaunes directory. Read it before UI work. The `/impeccable` skill is set up for this project (`.impeccable/live/config.json` preconfigures live mode); DESIGN.md captures the visual system.

## What this is

Artisa: a Next.js app showing an interactive map of every French commune (~35k), letting users click a commune to see local artisans who have no website (sourced from Google Places), with phone number and Google Maps listing, for cold-outreach ("démarchage"). The map itself is visible without an account, but viewing a commune's artisans requires login: each account supplies its own Google Places API key at signup, so Google Places costs land on that account's own Google Cloud billing rather than a shared one — this is what makes the app free to run for its owner. There is no paywall or free-tier quota; once logged in, all artisans in a commune are visible immediately. Users can check off an artisan as "already called" (`user_artisan_calls`) to avoid re-contacting them, and a "my artisans" menu lists every commune they've viewed. There is no review/rating feature.

## Commands

```bash
npm run dev             # dev server (Turbopack), http://localhost:3000
npm run build            # production build (fails the type-check on errors, treat as CI gate)
npm run start            # run the production build
npm run lint              # eslint
npm run fetch-communes    # regenerate public/communes.geojson.json from geo.api.gouv.fr (run once; communes rarely change)
```

There is no test suite yet.

## Required environment variables (`.env.local`, see `.env.local.example`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase project API settings (the anon key is now called the "publishable key" in current Supabase dashboards).
- `SUPABASE_SERVICE_ROLE_KEY` — used only server-side (`createServiceRoleClient`) to write to the `artisans`/`commune_search_cache` cache tables, bypassing RLS. Never expose to the client.

There is no app-wide Google Places key: each user provides their own at signup (see below), stored in their Supabase auth `user_metadata`. Without the three Supabase vars, pages render but auth silently no-ops/errors.

## Architecture

**Map data is static, not a DB table.** `scripts/fetch-communes.mjs` hits `geo.api.gouv.fr` once and writes the full FeatureCollection to `public/communes.geojson.json` (~5.6 MB, 34 969 features). `CommunesMap` (`src/components/CommunesMap.tsx`) passes that URL directly as a MapLibre GeoJSON `Source` with `cluster: true` — MapLibre fetches and clusters it client-side using its built-in Supercluster integration (no need to keep communes in Postgres, and no client-side fetch/parse in React before render). Map base style is the free, keyless OpenFreeMap `liberty` style.

Clicking a cluster zooms in (`source.getClusterExpansionZoom`, which is async in MapLibre GL JS ≥3 — a common pitfall when following older Mapbox tutorials). Clicking an unclustered point opens `ArtisanPanel` with that commune's `{ code, nom, codePostal, population, lat, lng }` — but only if `useAuth().user` is set; logged-out clicks open `LoginPromptModal` instead (see Auth below).

**Artisan data is a lazily-populated cache, not live-queried per request.** `ArtisanPanel` calls `GET /api/places?code&lat&lng` (`src/app/api/places/route.ts`), which:
1. Requires auth (`createClient().auth.getUser()`; 401 if not logged in) and reads `user.user_metadata.google_places_api_key` — the calling account's own Google key.
2. Checks `commune_search_cache` (commune_code → last searched_at) to decide if this commune needs a fresh Google lookup (`CACHE_TTL_DAYS = 60`). This table exists specifically because an empty result set in `artisans` is ambiguous otherwise (never searched vs. searched-and-found-nothing).
3. If stale/missing: parallel Text Search (New) calls (`searchTradeCandidates`, one per French free-text term in `TRADE_SEARCH_QUERIES` — électricien, plombier, peintre en bâtiment, couvreur, serrurier, déménageur, menuisier, carreleur, maçon, plâtrier, vitrier, chauffagiste, plaquiste, coiffeur), each `FieldMask: places.id` only and a soft `locationBias` circle (not a hard restriction like Nearby Search's `locationRestriction`). Switched from Nearby Search (New) in 2026-07 because Nearby Search's `includedTypes` is restricted to Google's Table A, which only covers 6 building trades (electrician, plumber, painter, roofing_contractor, locksmith, moving_company) — no hairdresser, carpenter, tiler, mason, plasterer, glazier, HVAC. Text Search's free-text `textQuery` has no such restriction. Results across all terms are deduped by place ID (`candidates`), first matching term becomes the artisan's `category`. Cost bonus verified on Google's pricing page (2026-07, not yet confirmed against a real billing account — check Google Cloud Console after first live use): a `places.id`-only FieldMask on Text Search bills at **"Text Search Essentials (IDs Only)"**, free and unlimited — unlike Nearby Search Pro ($32/1000), which had no IDs-only tier. So discovery is now $0; only step 4 below costs anything.
4. For each new candidate, a separate Place Details (New) call fetches `displayName, nationalPhoneNumber, googleMapsUri, websiteUri`. **This FieldMask is billed at the Enterprise SKU tier** ($20/1000, only 1000 free/month per billing account — the smallest free allowance) because `nationalPhoneNumber`/`websiteUri` aren't in cheaper tiers — this is unavoidable given the product's requirements, so `MAX_DETAILS_PER_SEARCH` (20 per commune load, further capped by the day's remaining quota) is the main cost dial. Worst-case cost of one never-searched commune: $0 discovery (Text Search Essentials IDs Only) + 20 Details Enterprise ≈ $0.40, on the calling user's own Google Cloud billing. All results (even ones with a website) are upserted into `artisans` so they're never re-fetched; only rows with `website_uri IS NULL` are ever returned to the client, since those are the prospecting targets.
5. Reads back `artisans` for that commune filtered to `website_uri IS NULL`.

Because `artisans`/`commune_search_cache` are one shared cache (not per-user), only the *first* account to search a given commune actually spends Google quota — later accounts read the cache for free. Fine for a single-user deployment; worth revisiting if this becomes multi-tenant (see Known gaps).

The route uses `createServiceRoleClient()` (`src/lib/supabase/server.ts`) to write the cache — RLS on `artisans`/`commune_search_cache` has no client-facing insert policy, so writes only ever happen from this server route with the service role key.

**Auth is global client state, and now also a hard gate on artisan data.** `AuthProvider` (`src/lib/supabase/auth-context.tsx`) wraps the whole app in `src/app/layout.tsx` and exposes `useAuth()` (`user`, `loading`) via `supabase.auth.getUser()` + `onAuthStateChange`. The map itself renders for everyone, but `CommunesMap`'s click handler only opens `ArtisanPanel` when `user` is set; otherwise it opens `LoginPromptModal`. `ArtisanPanel` itself assumes it's only ever rendered for a logged-in user (no internal auth check). The real security boundary is still server-side: `GET /api/places` (`src/app/api/places/route.ts`) re-checks `supabase.auth.getUser()` and returns 401 if absent — the client-side gate is UX only.

**Signup requires a Google Places API key.** `src/app/signup/page.tsx` collects email, password, and a Google Places API key in one form, and passes the key via `supabase.auth.signUp({ email, password, options: { data: { google_places_api_key } } })` — Supabase stores it in `auth.users.raw_user_meta_data`, readable server-side via `getUser().data.user.user_metadata.google_places_api_key`. No dedicated table/migration for this: `user_metadata` is set directly at signup, before there's an active session (email confirmation is required, so a table behind an `auth.uid()` RLS policy wouldn't be writable at that point anyway).

**"Already called" tracking** (`src/actions/calls.ts`, table `user_artisan_calls`) is a per-user, server-persisted checkbox on each artisan card, independent of anything else — `getCalledArtisanIds`/`setArtisanCalled`, both re-checking `auth.getUser()` server-side, RLS-scoped to `auth.uid() = user_id` (select/insert/delete).

**"My artisans" history** (`src/actions/communes.ts`, table `user_viewed_communes`) is a per-user, server-persisted list of communes already viewed — `recordViewedCommune`/`listViewedCommunes`, both scoped to `auth.uid()` via RLS (select/insert/update, upsert on repeat visits refreshes `viewed_at`). `ArtisanPanel` calls `recordViewedCommune(commune)` once per commune load; `UnlockedArtisansMenu` (top-left of the map) reads the list on open and can reopen `ArtisanPanel` for any of them without a fresh map click, then lazily fetches that commune's artisans from `/api/places` (already cached, no new Google billing) — no per-artisan filtering, every no-website artisan in a viewed commune is shown. Deliberately not localStorage: an earlier version was, and clearing browser storage silently emptied the list while the underlying data was still in Supabase.

Session refresh happens in `src/proxy.ts` (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`/`export function proxy` — don't reintroduce a `middleware.ts`, it's deprecated) calling `updateSession` in `src/lib/supabase/middleware.ts`, which uses `getClaims()` (not the unsafe `getSession()`) to revalidate the JWT and refresh cookies before Server Components read them.

**Known gaps:** the shared `artisans`/`commune_search_cache` cache (see above) is the whole point of the cost model — only the first account to open a commune ever spends Google quota, everyone after reads for free — but it means that spend isn't attributed evenly: in a genuine multi-tenant scenario, whoever happens to be first "sponsors" the commune for every other account with no reimbursement/accounting. Not an issue for the current single/small-user phase; worth a real design pass (e.g. a shared service-role-billed key, or per-account cost tracking) before onboarding many independent users.

**Supabase client has three flavors**, each for a different context — don't cross them:
- `src/lib/supabase/client.ts` — browser (`createBrowserClient`), used in client components (login/signup forms, `AuthHeader`, `auth-context`).
- `src/lib/supabase/server.ts` `createClient()` — Server Components/Server Actions (`createServerClient` with cookie read/write via `next/headers`), respects RLS as the calling user.
- `src/lib/supabase/server.ts` `createServiceRoleClient()` — server-only, bypasses RLS, used exclusively by the `/api/places` cache writer.

## Database (Supabase Postgres, `supabase/migrations/0001_init.sql`)

- `artisans` — Google Places cache; read restricted to `authenticated` (matches the app-wide login gate), no client write policy (server-only via service role).
- `commune_search_cache` — one row per commune already searched, decouples "cache miss" from "no artisans found".
- `user_artisan_calls` — one row per `(user_id, artisan_id)` marked "already called"; RLS restricted to the owning `auth.uid()` (select/insert/delete).

There is a single migration file — it was consolidated from an earlier history that included a `reviews`/`artisan_ratings` review feature and a simulated paywall (`user_artisan_unlocks`/`user_purchases`); both were removed from the product, so the schema now only reflects what's actually in use.

Apply the migration via the Supabase SQL editor or CLI; there's no migration runner wired into `npm run build`.
