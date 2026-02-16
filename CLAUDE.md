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
5. Test `/`, `/city/bengaluru` (all 6 tabs), `/benchmark`, `/data-sources` before merging
6. Never bundle version upgrades with feature or bugfix commits

**Known breakage:** Vite 6.3+ breaks SvelteKit's dev server (`Cannot find module '__SERVER__/internal.js'`). Vite is pinned to 6.2.7.

## Architecture & Patterns

### Svelte 5 Runes
All components use Svelte 5 runes: `$props()`, `$state()`, `$effect()`, `$derived()`, `$bindable()`. Do NOT use legacy Svelte 4 syntax (`export let`, `$:`, slots).

### Server-Side Data Fetching
Transit data is fetched on-demand from open-source GitHub repositories (TransitRouter, namma-metro, BMRCL ridership), transformed server-side, and cached in-memory with 24h TTL. No transit data is stored in the database in Phase 1.

### Static Data Files & Refresh Scripts
Some data is pre-fetched and stored as static JSON files for instant cold starts on Vercel (no runtime Overpass calls needed). Static files are git-tracked and live in `src/lib/data/`:

- `src/lib/data/transit/{cityId}.json` — Transit data (bus stops, metro, rail) per city
- `src/lib/data/geo-markers.json` — Company/campus locations from production DB
- `src/lib/data/global-stats.json` — Global impact totals from production DB

**Refresh scripts:**
```bash
bash scripts/refresh-transit-data.sh      # Re-fetches all 9 cities from Overpass/GitHub (needs dev server)
bash scripts/refresh-core-data-db.sh      # Re-fetches geo markers + global stats via direct DB (needs SSH tunnel, no dev server)
bash scripts/refresh-core-data.sh         # (Legacy) Same as above but via dev server + Rails API
```

The app prefers static data when available. After running refresh scripts, commit the updated JSON files. Run refresh scripts when:
- A new city is added
- Transit network data changes (new metro line, etc.)
- Production database data changes significantly

### ETL Routes
- Located at `src/routes/api/etl/` — 3 routes: `sync-routes`, `sync-external`, `sync-safety`
- Use Bearer token auth via `CRON_SECRET` env var
- All ETL routes create `supabaseAdmin` client inside the handler (not at module level)
- `sync-routes` supports `?source=db` to fetch directly from Rails production DB (via SSH tunnel) instead of the Rails API. The DB path is faster and avoids API timeouts. Requires `ssh altmo-db-tunnel -N -f`. Without `?source=db`, falls back to the paginated Rails API (used by Vercel cron).

### Direct DB Access (rails-db.ts)
- `src/lib/server/rails-db.ts` provides a read-only pg connection pool to the Rails production DB
- Only works locally (requires SSH tunnel) — Vercel production cannot reach the DB
- Used by `sync-routes?source=db` and `scripts/refresh-core-data-db.ts`
- All connections use `default_transaction_read_only=on` for safety

### City Switching
The primary city experience is the deep-dive page at `/city/{cityId}` (e.g., `/city/bengaluru`). A city selector dropdown within the deep-dive page navigates between cities using `goto()`. The `/benchmark` and `/data-sources` pages have their own local city selectors.

### Adding or Modifying Cities
When adding a new city or changing city-specific config, follow the checklist in `supporting-docs/NEW_CITY_READY_RECKONER.md`. That reckoner lists every config file that needs a city entry (cities.ts, city-qol-data.ts, scenarios.ts, air-quality.ts, traffic-flow.ts, data-readiness.ts, city-qol-gaps.ts, data-sources.json, etc.) and the verification steps. **Update the reckoner itself** if you add new city-scoped config files or change the onboarding process.

**Note:** `src/lib/server/altmo-core.ts` is the shared data layer for production DB data (global stats, challenges, geo_markers, company detail). It does NOT need per-city config. The geo_markers are city-scoped via the `city_id` field on each marker, so new cities added in the production DB will automatically appear in the city deep-dive Infrastructure tab's companies layer without any config changes in this project.

### Live Data & QoL Overrides
`src/lib/server/qol-overrides.ts` (`buildQoLOverrides()`) is the **single source of truth** for all live data that feeds into ETQOLI scoring. Every page that displays QoL scores calls this function. When adding a new live data source:

1. Create a fetcher in `src/lib/server/` (with 24h cache)
2. Wire it into `buildQoLOverrides()` — add to the `Promise.all` call and merge into the overrides object
3. Do NOT add local per-page overrides — that causes score drift between pages
4. If the new data has sub-components (like metro + suburban = rail transit), store display-only breakdown fields in overrides (e.g. `metro_km`, `suburban_rail_km`) alongside the scoring field (`rail_transit_km`). Display-only fields don't affect scoring because they're not in `INDICATOR_DEFINITIONS`.
5. Update `static/data/data-sources.json` with the new source entry

Current live sources: safety (Supabase), PM2.5 + NO2 (OpenAQ), congestion (TomTom), rail transit km (static JSON via Overpass, with live fallback).

### Activity Route Data
`src/lib/server/activity-data.ts` queries the `city_activity_monthly` Supabase table (synced from production DB via the ETL sync-routes endpoint). It maps app city slugs to Rails integer city_ids internally. Functions: `getActivitySummary()`, `getActivityByHour()`, `getActivityByDayOfWeek()`, `getTopCorridors()`, `getActivityTrends()`, `getDistanceDistribution()`, `getTripChaining()`. Uses 1h cache (shorter than transit's 24h since activity data updates more frequently).

### Data Provenance
`static/data/data-sources.json` is the canonical registry of all data sources, organized by city and category. **Update it** whenever you add, remove, or change a data source (new data feed, new OpenAQ sensor, new transit GeoJSON, etc.). Each entry tracks the source name, URL, license, update frequency, and confidence level. The `/data-sources` page renders this file directly.

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
    +page.svelte       — Home / Transport Quality of Life Ranking (leaderboard)
    +layout.svelte     — App shell with Nav
    city/[cityId]/     — City deep-dive (6 tabbed sections: score, infrastructure, activity, scenarios, data, action)
    benchmark/         — Cross-city comparison (multi-select, radar chart, dimension tables)
    data-sources/      — Data provenance, ETQOLI methodology, source references per city
    compare/           — Redirect → /benchmark
    access/            — Redirect → /city/{cityId}#infrastructure (legacy)
    pulse/*/           — Redirects → /city/{cityId}#activity (legacy)
    impact/            — Redirect → /city/{cityId}#activity (legacy)
    forecast/          — Redirect → /city/{cityId}#scenarios (legacy)
    routes/            — Redirect → /city/{cityId}#activity (legacy)
    api/etl/           — 3 ETL server routes (sync-routes, sync-external, sync-safety)
    api/internal/      — Dev-only data dump endpoints (dump-transit, dump-core-data)
  lib/
    components/        — Svelte components (Nav, Map, Chart, MetricCard, DataTable, etc.)
    components/city/   — City deep-dive section components (ScoreOverview, InfrastructureSection, ActivitySection, ScenariosSection, DataReadinessSection, TakeActionSection)
    config/            — Static config (cities.ts, data-readiness.ts, city-qol-data.ts, scenarios.ts, air-quality.ts, action-guides.ts)
    data/              — Static JSON data files (transit/{city}.json, geo-markers.json, global-stats.json)
    server/            — Server-only code (transit-data.ts, transit-static.ts, activity-data.ts, altmo-core.ts, qol-overrides.ts)
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
| Altmo Core DB (Rails) | Internal | Activity routes, companies, leaderboards, city stats (direct DB read-only) |
| [OpenAQ v3](https://api.openaq.org/v3) | CC BY 4.0 | Real-time PM2.5 from CPCB stations (7 cities) |
| [TomTom Traffic Flow](https://developer.tomtom.com/traffic-api) | TomTom License | Real-time congestion data (5-8 junctions per city) |
| NCRB / MoRTH | Government | Traffic fatality rates per city |
| [UrbanEmissions APnA](https://urbanemissions.info/india-apna/) | Academic | PM2.5 source apportionment per city |

### Altmo Core (Rails app — `rails-web-app`)

> **IMPORTANT: The `rails-web-app` repository is READ-ONLY from this project's perspective.
> NEVER modify, create, or suggest changes to files in that repository.**

The Rails app is the primary activity data backend. Stack: Ruby 3.1.2, Rails 7.0, PostgreSQL + PostGIS, Devise auth, Strava OAuth integration.

#### Data Access — Direct Database (READ-ONLY)

- SSH tunnel to production Postgres (13.7 + PostGIS 3.2) via `ssh altmo-db-tunnel -N -f`
- Connect: `/usr/local/Cellar/libpq/18.2/bin/psql -h localhost -p 5433 -U postgres -d cycletowork`
- Credentials in `~/.pgpass` — passwordless once tunnel is up
- **READ-ONLY** — NEVER INSERT, UPDATE, DELETE, or run DDL against the production database
- Full access details: `~/.claude/projects/-Users-sathya-Documents-GitHub-altmo-extended/memory/server-access.md`
- Database: 68 tables, 575K activities, 9.2K users, 137K routes

**Key tables:**

| Table | What it holds |
|---|---|
| `activities` | Strava-sourced GPS activities (rides, walks, runs) |
| `activity_routes` | Decoded polyline lat/lng path arrays |
| `users` | User accounts (Strava OAuth) |
| `companies` | Facilities / employers |
| `user_companies` | User ↔ company membership |
| `geo_markers` | PostGIS point/polygon boundaries |
| `transit_entities` | Transit operators (BMRCL, etc.) |
| `transit_points` | Transit stations/stops |
| `histories` | Daily leaderboard snapshots |
| `challenges` | Gamification events |
| `cities` | City registry (113 cities) |

#### Server Access
- **SSH:** `ssh deploy@157.245.101.5` (passwordless SSH key auth)
- **Production app:** `/home/deploy/websites/capified_altmo_production/current`
- **Logs:** `/home/deploy/websites/capified_altmo_production/shared/log/`
- Full access details: `~/.claude/projects/-Users-sathya-Documents-GitHub-altmo-extended/memory/server-access.md`

*Key city IDs:* Bengaluru=18326, Chennai=18586, Delhi=18215, Hyderabad=18629, Indore=18396, Kochi=18363, Mumbai=18445, Pune=18455, Ahmedabad=18220

**Formulas:** CO2 = distance(km) × 0.25 kg, Petrol = distance(km) × 0.108 L, Money = petrol × ₹101

> **Setup:** Run `scripts/migrations/001-create-etl-tables.sql` against Supabase before first ETL run.

## Environment Notes
- Node 20 required — local machine defaults to v16, run `nvm use 20` before dev/build
- Dev server: `npm run dev` (Vite on localhost:5173)
- Type check: `npm run check`
- Build: `npm run build`
- Vercel Hobby plan: cron jobs limited to daily frequency
