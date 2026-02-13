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

## Architecture & Patterns

### Svelte 5 Runes
All components use Svelte 5 runes: `$props()`, `$state()`, `$effect()`, `$derived()`, `$bindable()`. Do NOT use legacy Svelte 4 syntax (`export let`, `$:`, slots). Nav uses Svelte 5 snippets for city_selector and auth.

### Server-Side Data Fetching
Transit data is fetched on-demand from open-source GitHub repositories (TransitRouter, namma-metro, BMRCL ridership), transformed server-side, and cached in-memory with 24h TTL. No transit data is stored in the database in Phase 1.

### ETL Routes
- Located at `src/routes/api/etl/`
- Use Bearer token auth via `CRON_SECRET` env var
- All ETL routes create `supabaseAdmin` client inside the handler (not at module level)

### City Switching
Pages that support city switching use `?city=` URL params. The `CitySelector` component syncs with `selectedCity` store and navigates with `goto()`.

### Adding or Modifying Cities
When adding a new city or changing city-specific config, follow the checklist in `supporting-docs/NEW_CITY_READY_RECKONER.md`. That reckoner lists every config file that needs a city entry (cities.ts, city-qol-data.ts, scenarios.ts, air-quality.ts, traffic-flow.ts, data-readiness.ts, city-qol-gaps.ts, data-sources.json, etc.) and the verification steps. **Update the reckoner itself** if you add new city-scoped config files or change the onboarding process.

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
    routes/            — Route explorer
    forecast/          — Scenario comparison tool (ETQOLI what-if modelling)
    data-sources/      — Data provenance & source references per city
    api/etl/           — 5 ETL server routes (sync-routes, sync-stats, sync-facilities, sync-external, sync-safety)
  lib/
    components/        — Svelte components (Nav, Map, Chart, MetricCard, DataTable, CitySelector, etc.)
    config/            — Static config (cities.ts, data-readiness.ts, city-qol-data.ts, scenarios.ts, air-quality.ts)
    server/            — Server-only code (transit-data.ts)
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

**ETL endpoint mapping:**

| ETL Route | Rails Endpoint | Supabase Table | Notes |
|---|---|---|---|
| `sync-routes` | `GET /api/v1/routes/bulk` (paginated, needs `start_date`/`end_date`) | `activity_routes` (PK: `activity_id`) | Fetches last 90 days, 500/page, batched upsert |
| `sync-stats` | `GET /api/v1/leaderboard` | `leaderboards` (PK: `company_name`) | Full snapshot upsert |
| `sync-stats` | `GET /api/v1/stats/global` (returns `results`, 90-day rolling) | `daily_stats` (PK: `date`) | Global daily stats |
| `sync-facilities` | `GET /api/v1/companies` | `companies` (PK: `id`) | Group-level data |
| `sync-facilities` | `GET /api/v1/facilities` | `facilities` (PK: `id`) | Company/facility-level data |

> **Setup:** Run `scripts/migrations/001-create-etl-tables.sql` against Supabase before first ETL run.

**Available Rails API endpoints (`rails-web-app`):**

*All endpoints require `access_token` query param.*

*Existing endpoints:*
- `GET /api/v1/leaderboard` — Company leaderboards, optional `city_id` param
- `GET /api/v1/group_leaderboard` — Group-level aggregations, optional `city_id`
- `GET /api/v1/facilities` — All approved facilities with stats
- `GET /api/v1/companies` — All company groups with stats
- `GET /api/v1/routes` — Activity routes (requires `facility_id`, `company_id`, or `rider_id` + date range)
- `GET /api/v1/stats/global` — 90-day rolling daily stats, optional `city_id`
- `GET /api/v1/stats/daily/:date` — Single-day stats
- `GET /api/v1/activities/map` — Last 7 days' rides with routes, optional `city_id`
- `GET /api/v1/cities/list` — City ID→name mapping

*Pending endpoints (from NEW_API_ENDPOINTS_SPEC.md — to be built in `rails-web-app`):*
- `GET /api/v1/routes/bulk` — EP-1: Paginated bulk activity routes (P0)
- `GET /api/v1/transit_activities` — EP-2: Transit activity data (P0)
- `GET /api/v1/geo_markers` — EP-3: GeoMarker boundaries (P0)
- `GET /api/v1/history` — EP-5: Historical leaderboard snapshots (P1)
- `GET /api/v1/challenges/summary` — EP-4: Challenge summary (P3, deferred)
- `GET /api/v1/demographics` — EP-6: Anonymised demographics (P3, deferred)

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
