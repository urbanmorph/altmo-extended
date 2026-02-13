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

### Altmo Core API (Rails app — `altmo-rails-web-app`)

The Rails app is the primary activity data backend. Stack: Ruby 3.1.2, Rails 7.0, PostgreSQL + PostGIS, Devise auth, Strava OAuth integration.

**ETL endpoint mapping (updated for `altmo-rails-web-app`):**

| ETL Route | Rails Endpoint | Supabase Table | Notes |
|---|---|---|---|
| `sync-routes` | `GET /api/v1/routes/bulk` (paginated, needs `start_date`/`end_date`) | `activity_routes` (PK: `activity_id`) | Fetches last 90 days, 500/page, batched upsert |
| `sync-stats` | `GET /api/v1/leaderboard` (singular, JBuilder → `leaderboards_list`) | `leaderboards` (PK: `company_name`) | Full snapshot upsert |
| `sync-stats` | `GET /api/v1/stats/global` (returns `results`, 90-day rolling) | `daily_stats` (PK: `date`) | Global daily stats |
| `sync-facilities` | `GET /api/v1/companies` (bare array response) | `companies` (PK: `id`) | Group-level data |
| `sync-facilities` | `GET /api/v1/facilities` (bare array response) | `facilities` (PK: `id`) | Company/facility-level data |

> **Setup:** Run `scripts/migrations/001-create-etl-tables.sql` against Supabase before first ETL run.

**Available Rails API endpoints (`altmo-rails-web-app`):**

*BaseController (no auth required):*
- `GET /api/v1/leaderboard` — Company leaderboards, optional `city_id` param. Response: `{ leaderboards_list: [{ rank, company_name, percentage, riders, rides, carbon_credits, city_id }] }` (via JBuilder)
- `GET /api/v1/group_leaderboard` — Group-level aggregations, optional `city_id`
- `GET /api/v1/facilities` — All approved facilities with stats. Returns bare array: `[{ id, name, approved, activities, distance, emp_count, city, city_id, latlngs }]`
- `GET /api/v1/companies` — All company groups with stats. Returns bare array: `[{ id, name, activities, distance, emp_count, facilities }]`
- `GET /api/v1/facilities_and_companies` — Combined: `{ facilities: [...], companies: [...] }`
- `GET /api/v1/routes` — Activity routes (requires `facility_id`, `company_id`, or `rider_id` + date range)
- `GET /api/v1/public/routes` — Same but without rider names

*IntelligenceController (no auth, built for this dashboard):*
- `GET /api/v1/routes/bulk` — Paginated activity routes. Params: `start_date` (required), `end_date` (required), `city_id`, `activity_types`. Returns `{ routes: [{ activity_id, activity_type, start_date, distance, moving_time, start_lat, start_lng, end_lat, end_lng, direction, facility_id, company_id, city_id, path }] }`
- `GET /api/v1/transit_activities` — Paginated transit rides. Params: `start_date` (required), `end_date` (required), `city_id`, `status`. Returns `{ transit_activities: [...] }`
- `GET /api/v1/geo_markers` — Zone boundaries. Params: `type`, `layer_type`, `city_id`. Returns `{ geo_markers: [{ id, associable_type, associable_id, associable_name, lat, lon, layer_type, latlngs, radius, city_id }] }`
- `GET /api/v1/history` — Leaderboard snapshots. Params: `start_date` (required), `end_date` (required), `type`, `associable_id`. Returns `{ history: [{ date, associable_type, associable_id, associable_name, riders, rides, distance_km, co2_credits, rank }] }`

*StatsController (no auth):*
- `GET /api/v1/stats/global` — 90-day rolling daily stats, optional `city_id`. Returns `{ results: [{ date, facilities, riders, rides, distance, co2_saved, petrol_saved }] }`
- `GET /api/v1/stats/daily/:date` — Single-day stats

*ActivitiesController:*
- `GET /api/v1/activities/map` — Last 7 days' rides with routes, optional `city_id`
- `GET /api/v1/activities/company/:id` — **Requires Bearer token** (ambassador auth)

*Other:*
- `GET /api/v1/cities/list` — City ID→name mapping
- `GET /api/v1/groups` — All company groups
- `GET /api/v1/daily_history` — History by date
- `GET /api/v1/credit_types` — Credit type activities

**Key Rails data models:**
- **Activity**: Strava-sourced GPS rides (≥1km, company-linked), direction (to/from work), distance, speed, CO2/fuel/money saved
- **ActivityRoute**: Decoded polyline → lat/lng path array
- **TransitActivity**: First/last-mile rides near transit points (geofence or 150m radius), with approval workflow
- **Company/Group**: Facilities (Company) and organizations (Group) with leaderboard aggregations
- **GeoMarker**: PostGIS point/polygon boundaries for companies, transit points, campuses
- **Challenge**: Gamification events (F2WCR, transit challenges) with eligibility and moderation
- **History**: Daily snapshots of leaderboard data (riders, rides, distance, co2_credits, rank)
- **ApiLog**: Request logging for Intelligence/Stats endpoints

**Formulas:** CO2 = distance(km) × 0.25 kg, Petrol = distance(km) × 0.108 L, Money = petrol × ₹101

## Environment Notes
- Node 20 required — local machine defaults to v16, run `nvm use 20` before dev/build
- Dev server: `npm run dev` (Vite on localhost:5173)
- Type check: `npm run check`
- Build: `npm run build`
- Vercel Hobby plan: cron jobs limited to daily frequency
