# Altmo Intelligence — CLAUDE.md

## Project Overview
Altmo Intelligence is a government-focused active mobility analytics platform for walking and cycling. Target users: city planners, Smart City SPVs, transport departments. The platform combines GPS activity traces (2.1M+ activities) with transit, infrastructure, and safety data to produce actionable insights for infrastructure investment.

**Brand name is "Altmo" (not "AltMo").**

## Tech Stack
- **Framework:** SvelteKit (Svelte 5 with runes) + Vercel adapter
- **Styling:** Tailwind CSS v4 — colors defined via `@theme` block in `src/app.css`, NOT in JS config
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Maps:** MapLibre GL JS v5
- **Charts:** Chart.js v4
- **Hex grids:** H3-js v4
- **Runtime:** Node 20 required (`.nvmrc` in repo root)
- **Env vars:** Use `$env/dynamic/*` (not `$env/static/*`) so build works without env vars present

### Dependency Versions — Pinned, Do Not Change
All versions in `package.json` are pinned to exact versions (no `^` or `~`). **Do NOT modify dependency versions as part of feature work, bug fixes, or refactoring.** This includes `npm install <new-package>` — always use `--save-exact`.

Version upgrades are a separate software upgrade effort:
1. Create a dedicated branch (e.g., `chore/upgrade-deps-YYYY-MM`)
2. Update versions one group at a time (framework, then tooling, then runtime deps)
3. Run `npm run check`, start the dev server, and verify all pages return 200
4. Curl each page and check the HTML content for errors (500 traces, "Error:", empty body, missing key elements)
5. Test `/`, `/benchmark`, `/forecast`, `/access`, `/data-sources` before merging
6. Never bundle version upgrades with feature or bugfix commits

**Known breakage:** Vite 6.3+ breaks SvelteKit's dev server (`Cannot find module '__SERVER__/internal.js'`). Vite is pinned to 6.2.7.

## Architecture & Patterns

### Svelte 5 Runes
All components use Svelte 5 runes: `$props()`, `$state()`, `$effect()`, `$derived()`, `$bindable()`. Do NOT use legacy Svelte 4 syntax (`export let`, `$:`, slots). Nav uses Svelte 5 snippets for city_selector and auth.

### Server-Side Data Fetching
Transit data is fetched on-demand from open-source GitHub repositories (TransitRouter, namma-metro, BMRCL ridership), transformed server-side, and cached in-memory with 24h TTL. No transit data is stored in the database in Phase 1.

### Static Data Files & Refresh Scripts
Some data is pre-fetched and stored as static JSON files for instant cold starts on Vercel (no runtime Overpass/Rails API calls needed). Static files are git-tracked and live in `src/lib/data/`:

- `src/lib/data/transit/{cityId}.json` — Transit data (bus stops, metro, rail) per city
- `src/lib/data/geo-markers.json` — Company/campus locations from Rails API
- `src/lib/data/global-stats.json` — Global impact totals from Rails API

**Refresh scripts** (run with dev server active in another terminal):
```bash
bash scripts/refresh-transit-data.sh   # Re-fetches all 9 cities from Overpass/GitHub
bash scripts/refresh-core-data.sh      # Re-fetches geo markers + global stats from Rails API
```

The app prefers static data when available and falls back to live API calls. After running refresh scripts, commit the updated JSON files. Run refresh scripts when:
- A new city is added
- Transit network data changes (new metro line, etc.)
- Rails API data changes significantly

### ETL Routes
- Located at `src/routes/api/etl/`
- Use Bearer token auth via `CRON_SECRET` env var
- All ETL routes create `supabaseAdmin` client inside the handler (not at module level)

### City Switching
Pages that support city switching use `?city=` URL params. The `CitySelector` component syncs with `selectedCity` store and navigates with `goto()`.

### Adding or Modifying Cities
When adding a new city or changing city-specific config, follow the checklist in `supporting-docs/NEW_CITY_READY_RECKONER.md`. That reckoner lists every config file that needs a city entry (cities.ts, city-qol-data.ts, scenarios.ts, air-quality.ts, traffic-flow.ts, data-readiness.ts, city-qol-gaps.ts, data-sources.json, etc.) and the verification steps. **Update the reckoner itself** if you add new city-scoped config files or change the onboarding process.

**Note:** `src/lib/server/altmo-core.ts` is the shared Rails API data layer (global stats, challenges, geo_markers, company detail). It does NOT need per-city config. However, the geo_markers it fetches are city-scoped via the `city_id` field on each marker, so new cities added in the Rails app will automatically appear in the access map companies layer without any config changes in this project.

### Live Data & QoL Overrides
`src/lib/server/qol-overrides.ts` (`buildQoLOverrides()`) is the **single source of truth** for all live data that feeds into ETQOLI scoring. Every page that displays QoL scores calls this function. When adding a new live data source:

1. Create a fetcher in `src/lib/server/` (with 24h cache)
2. Wire it into `buildQoLOverrides()` — add to the `Promise.all` call and merge into the overrides object
3. Do NOT add local per-page overrides — that causes score drift between pages
4. If the new data has sub-components (like metro + suburban = rail transit), store display-only breakdown fields in overrides (e.g. `metro_km`, `suburban_rail_km`) alongside the scoring field (`rail_transit_km`). Display-only fields don't affect scoring because they're not in `INDICATOR_DEFINITIONS`.
5. Update `static/data/data-sources.json` with the new source entry

Current live sources: safety (Supabase), PM2.5 + NO2 (OpenAQ), congestion (TomTom), rail transit km (static JSON via Overpass, with live fallback).

### Activity Route Data
`src/lib/server/activity-data.ts` queries the `activity_routes` Supabase table (synced from Rails `/routes/bulk` via the ETL sync-routes endpoint). It maps app city slugs to Rails integer city_ids internally. Functions: `getActivitySummary()`, `getActivityByHour()`, `getActivityByDayOfWeek()`, `getTopCorridors()`, `getActivityTrends()`, `getDistanceDistribution()`. Uses 1h cache (shorter than transit's 24h since activity data updates more frequently).

### Data Provenance
`static/data/data-sources.json` is the canonical registry of all data sources, organized by city and category. **Update it** whenever you add, remove, or change a data source (new API endpoint, new OpenAQ sensor, new transit GeoJSON, etc.). Each entry tracks the source name, URL, license, update frequency, and confidence level. The `/data-sources` page renders this file directly.

## Design System & UI Rules

### No Emojis
Do NOT use emoji characters anywhere in the UI. Use Font Awesome icons only. This applies to MetricCard icons, headings, labels, and all other UI elements.

### Color Palette
Colors are defined as CSS custom properties in `src/app.css` under the `@theme` block:
- **Primary:** Altmo green `hsl(120, 82%, 20%)` — deep forest green
- **Accent:** Tangerine `hsl(22, 97%, 50%)` — vivid warm orange for CTAs
- **Scales:** Earth (warm beige-brown), Moss (cool green), Clay (terracotta), Sage (muted green-gray)
- **Activity modes:** Walk `#df7e37`, Ride `#000080`, Run `#1d531f`
- **Transit:** Bus `#2563eb`, Metro `#9333ea`, Rail `#dc2626`
- **Status:** Available `#16a34a`, Partial `#eab308`, Unavailable `#dc2626`

Use semantic tokens (`--color-primary`, `--color-accent`, `--color-surface`, etc.) in components rather than raw hex values.

### Typography
Font families: Open Sans (primary), Inter (fallback), loaded from Google Fonts in `src/app.html`.

## Project Structure
```
src/
  app.css              — Tailwind @theme tokens (all colors)
  app.html             — HTML shell (fonts, meta)
  routes/
    +page.svelte       — Home / dashboard overview
    +layout.svelte     — App shell with Nav
    access/            — Active mobility access map (MapLibre)
    pulse/transit/     — Transit analytics dashboard
    pulse/activity/    — Activity analytics (Altmo data)
    impact/            — Environmental impact
    impact/company/    — Company-level impact
    pulse/trips/       — Trip analysis (activity routes data)
    pulse/commute/     — Commute patterns (to/from work)
    pulse/recreation/  — Recreational activity (leisure, runs)
    pulse/trends/      — Activity trends (monthly time-series)
    routes/            — Route explorer (corridors, mode split)
    forecast/          — Scenario comparison tool (ETQOLI what-if modelling)
    data-sources/      — Data provenance & source references per city
    api/etl/           — 5 ETL server routes (sync-routes, sync-stats, sync-facilities, sync-external, sync-safety)
    api/internal/      — Dev-only data dump endpoints (dump-transit, dump-core-data)
  lib/
    components/        — Svelte components (Nav, Map, Chart, MetricCard, DataTable, CitySelector, etc.)
    config/            — Static config (cities.ts, data-readiness.ts, city-qol-data.ts, scenarios.ts, air-quality.ts)
    data/              — Static JSON data files (transit/{city}.json, geo-markers.json, global-stats.json)
    server/            — Server-only code (transit-data.ts, transit-static.ts, activity-data.ts, altmo-core.ts)
    stores/            — Svelte stores (city, dateRange, auth)
    utils/             — Helpers (transit, h3, geo, format)
supporting-docs/       — Analysis docs (gitignored, not deployed)
```

## Data Sources
| Source | License | Data |
|---|---|---|
| [TransitRouter](https://github.com/Vonter/transitrouter) | MIT | Bus stops & routes for 9 Indian regions |
| [Namma Metro](https://github.com/geohacker/namma-metro) | Public | Bengaluru metro stations & line geometry |
| [BMRCL Ridership](https://github.com/Vonter/bmrcl-ridership-hourly) | CC BY 4.0 | Hourly station-wise metro ridership (Bengaluru) |
| DULT CMP 2020 | Government | Comprehensive Mobility Plan (Bengaluru) |
| Altmo Core API (Rails) | Internal | Activity routes, facilities, companies, leaderboards, city stats |
| [OpenAQ v3](https://api.openaq.org/v3) | CC BY 4.0 | Real-time PM2.5 from CPCB stations (7 cities) |
| [TomTom Traffic Flow](https://developer.tomtom.com/traffic-api) | TomTom License | Real-time congestion data (5-8 junctions per city) |
| NCRB / MoRTH | Government | Traffic fatality rates per city |
| [UrbanEmissions APnA](https://urbanemissions.info/india-apna/) | Academic | PM2.5 source apportionment per city |

### Altmo Core API (Rails app — `rails-web-app`)

> **IMPORTANT: The `rails-web-app` repository is READ-ONLY from this project's perspective.
> NEVER modify, create, or suggest changes to files in that repository. All integration with the
> Rails backend MUST go through its existing REST API endpoints listed below. If an endpoint is
> missing or returns an unexpected shape, document the gap and flag it — do NOT add or change
> Rails controllers, models, routes, or views.**

The Rails app is the primary activity data backend. Stack: Ruby 3.1.2, Rails 7.0, PostgreSQL + PostGIS, Devise auth, Strava OAuth integration.

**Auth:** All `/api/v1/` endpoints require `?access_token=<token>` query param, validated via `ApiUser.find_by_token` in `BaseController`. The `railsApi()` helper in `src/lib/rails-api.ts` appends this automatically using the `RAILS_API_ACCESS_TOKEN` env var.

**API Base URL:** `https://www.altmo.app/api/v1/`
**API Docs:** `https://altmo.app/api/docs`

**Full API reference:** See `supporting-docs/ALTMO_API_REFERENCE.md` for complete endpoint docs, test results, and bug report.

> **Setup:** Run `scripts/migrations/001-create-etl-tables.sql` against Supabase before first ETL run.

**Verified Rails API endpoints (tested 2026-02-14, post-Apipie fix):**

*All endpoints require `access_token` query param. Internal endpoints also require `role: "internal"` on the ApiUser.*

*Working endpoints:*
- `GET /cities` — 200, 3.5s. 113 cities, name→numeric_id map
- `GET /statistics/overall` — 200, 4.6s. Returns `{ success, overall_statistics: { people, activitiesCount, distance(metres), co2Offset(kg), fuelSaved(L), moneySaved(INR) } }`. Note: `city_id` filter has no effect
- `GET /campuses` — 200, 3.8s. 6 campuses, name→id map
- `GET /challenges` — 200, 4.6s. 13 challenges with scope, dates, status, eligibleEntities
- `GET /challenges/:id` — 200, 0.1s. Challenge detail with leaderboard (no `success` wrapper). Some IDs return 404
- `GET /companies/:id` — 200, 18.0s. Company detail with stats, campusNames, campusIds. Very slow
- `GET /countries` — 200, 5.2s. 12 countries
- `GET /states?country_id=1` — 200, 5.1s. Fixed by Apipie PR (was 422). Returns empty array
- `GET /geo_markers` — 200, 9.2s, 1.2MB. 2,111 markers (internal-only). Returns `{ success, data: { geo_markers: [{ id, associable_type, associable_id, associable_name, lat, lon, layer_type, city_id }] } }`
- `GET /geo_markers?city_id=18326` — 200, 7.3s. City filter now works (was 422). Fixed by Apipie PR
- `GET /routes/bulk?start_date=...&end_date=...` — 200, 14.6s, 4.5MB. Returns `{ success, data: { routes: [{ activity_id, activity_type, start_date, distance, moving_time, start_lat, start_lng, end_lat, end_lng, direction, company_id, path }] } }`. 500 routes. Fixed by Apipie PR. Requires date params (500 without them)

*Broken — Rails controller bugs (NOT Apipie — these fail even after the type validator fix):*
- `GET /activities/summary` — 500 server error regardless of params (controller bug)
- `GET /transit_activities` — 500 server error regardless of params (internal-only, controller bug)
- `GET /routes/bulk` (without dates) — 500 (requires start_date + end_date params)
- `GET /campuses/:id` — 400, empty response body (controller bug)

*Performance issues:*
- `GET /companies` (list, no filter) — Timeout (>38 min, 987 companies, no pagination)

*Key city IDs:* Bengaluru=18326, Chennai=18586, Delhi=18215, Hyderabad=18629, Indore=18396, Kochi=18363, Mumbai=18445, Pune=18455, Ahmedabad=18220

**Key Rails data models:**
- **Activity**: Strava-sourced GPS rides (≥1km, company-linked), direction (to/from work), distance, speed, CO2/fuel/money saved
- **ActivityRoute**: Decoded polyline → lat/lng path array
- **TransitActivity**: First/last-mile rides near transit points (geofence or 150m radius), with approval workflow
- **Company/Group**: Facilities (Company) and organizations (Group) with leaderboard aggregations
- **GeoMarker**: PostGIS point/polygon boundaries for companies, transit points, campuses
- **Challenge**: Gamification events (F2WCR, transit challenges) with eligibility and moderation
- **History**: Daily snapshots of leaderboard data (riders, rides, distance, co2_credits, rank)
- **ApiUser**: Token-based auth — `access_token` query param validated via `find_by_token`

**Formulas:** CO2 = distance(km) × 0.25 kg, Petrol = distance(km) × 0.108 L, Money = petrol × ₹101

## Environment Notes
- Node 20 required — local machine defaults to v16, run `nvm use 20` before dev/build
- Dev server: `npm run dev` (Vite on localhost:5173)
- Type check: `npm run check`
- Build: `npm run build`
- Vercel Hobby plan: cron jobs limited to daily frequency
