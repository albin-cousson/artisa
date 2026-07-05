# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Artisa: a Next.js app showing an interactive map of every French commune (~35k), letting users click a commune to see local artisans who have no website (sourced from Google Places), with phone number and Google Maps listing, for cold-outreach ("démarchage"). Logged-in users can leave a review per artisan (free text + a green/orange/red smiley); the aggregated smiley average is shown next to each artisan's name. Browsing and the map work with no account; only posting a review requires login.

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
- `GOOGLE_PLACES_API_KEY` — needs the "Places API (New)" enabled on the Google Cloud project.

Without these, pages render but auth and the artisan search silently no-op/error (fail-soft is not implemented for missing Google key beyond a console error).

## Architecture

**Map data is static, not a DB table.** `scripts/fetch-communes.mjs` hits `geo.api.gouv.fr` once and writes the full FeatureCollection to `public/communes.geojson.json` (~5.6 MB, 34 969 features). `CommunesMap` (`src/components/CommunesMap.tsx`) passes that URL directly as a MapLibre GeoJSON `Source` with `cluster: true` — MapLibre fetches and clusters it client-side using its built-in Supercluster integration (no need to keep communes in Postgres, and no client-side fetch/parse in React before render). Map base style is the free, keyless OpenFreeMap `liberty` style.

Clicking a cluster zooms in (`source.getClusterExpansionZoom`, which is async in MapLibre GL JS ≥3 — a common pitfall when following older Mapbox tutorials). Clicking an unclustered point opens `ArtisanPanel` with that commune's `{ code, nom, codePostal, population, lat, lng }`.

**Artisan data is a lazily-populated cache, not live-queried per request.** `ArtisanPanel` calls `GET /api/places?code&lat&lng` (`src/app/api/places/route.ts`), which:
1. Checks `commune_search_cache` (commune_code → last searched_at) to decide if this commune needs a fresh Google lookup (`CACHE_TTL_DAYS = 60`). This table exists specifically because an empty result set in `artisans` is ambiguous otherwise (never searched vs. searched-and-found-nothing).
2. If stale/missing: one Nearby Search (New) call with a curated `ARTISAN_TYPES` list (electrician, plumber, painter, etc. — verify against Google's current "Table A" place types before relying on it) returns up to `MAX_DETAILS_PER_SEARCH` (20) candidate place IDs, cheap `FieldMask: places.id` only.
3. For each candidate, a separate Place Details (New) call fetches `displayName, nationalPhoneNumber, googleMapsUri, websiteUri`. **This FieldMask is billed at the Enterprise SKU tier** (the priciest) because `nationalPhoneNumber`/`websiteUri` aren't in cheaper tiers — this is unavoidable given the product's requirements, so `MAX_DETAILS_PER_SEARCH` is the main cost dial. All results (even ones with a website) are upserted into `artisans` so they're never re-fetched; only rows with `website_uri IS NULL` are ever returned to the client, since those are the prospecting targets.
4. Reads back `artisans` for that commune filtered to `website_uri IS NULL`, joined with the `artisan_ratings` view for the smiley aggregate.

The route uses `createServiceRoleClient()` (`src/lib/supabase/server.ts`) to write the cache — RLS on `artisans`/`commune_search_cache` has no client-facing insert policy, so writes only ever happen from this server route with the service role key.

**Auth is global client state, not per-page.** `AuthProvider` (`src/lib/supabase/auth-context.tsx`) wraps the whole app in `src/app/layout.tsx` and exposes `useAuth()` (`user`, `loading`) via `supabase.auth.getUser()` + `onAuthStateChange`. There's no route-level auth gate — any page is reachable without login. The only enforcement point is the "Laisser un avis" button in `ArtisanPanel`: if `useAuth().user` is null it opens `LoginPromptModal` instead of `ReviewForm`. The real security boundary is server-side: `submitReview` (`src/actions/reviews.ts`, a server action) re-checks `supabase.auth.getUser()` and the `reviews_insert_own` RLS policy enforces `auth.uid() = user_id` — the client-side gate is UX only.

Session refresh happens in `src/proxy.ts` (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`/`export function proxy` — don't reintroduce a `middleware.ts`, it's deprecated) calling `updateSession` in `src/lib/supabase/middleware.ts`, which uses `getClaims()` (not the unsafe `getSession()`) to revalidate the JWT and refresh cookies before Server Components read them.

**Supabase client has three flavors**, each for a different context — don't cross them:
- `src/lib/supabase/client.ts` — browser (`createBrowserClient`), used in client components (login/signup forms, `AuthHeader`, `auth-context`).
- `src/lib/supabase/server.ts` `createClient()` — Server Components/Server Actions (`createServerClient` with cookie read/write via `next/headers`), respects RLS as the calling user.
- `src/lib/supabase/server.ts` `createServiceRoleClient()` — server-only, bypasses RLS, used exclusively by the `/api/places` cache writer.

## Database (Supabase Postgres, `supabase/migrations/0001_init.sql`)

- `artisans` — Google Places cache; public read, no client write policy (server-only via service role).
- `commune_search_cache` — one row per commune already searched, decouples "cache miss" from "no artisans found".
- `reviews` — one review per `(artisan_id, user_id)` (upsert-on-conflict, so re-submitting edits the existing review rather than duplicating); public read, insert/update/delete restricted to the owning `auth.uid()`.
- `artisan_ratings` — view aggregating `reviews` into green/orange/red counts and a 0–1 `average_score` (green=1, orange=0.5, red=0), declared `security_invoker = true` so it enforces `reviews`' RLS rather than the view creator's privileges.

Apply migrations via the Supabase SQL editor or CLI; there's no migration runner wired into `npm run build`.
