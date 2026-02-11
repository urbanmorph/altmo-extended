# AltMo Intelligence Platform: Tech Stack Analysis

## Decision Summary

**Implemented stack: SvelteKit + Supabase (Pro) + Vercel (Pro) at ~INR 8,000/mo (~$95/mo)**

No traditional backend server is needed. Supabase's PostgreSQL with PostGIS and pgRouting handles all heavy spatial computation in-database. Cloudflare R2 should be added for map tile serving when bandwidth exceeds Vercel's included limits (~5K+ daily map users).

**Critical architecture constraint:** AltMo core (Rails + PostgreSQL on Digital Ocean) is a separate system that must NOT be modified. altmo-extended accesses core data exclusively via the Rails REST API (`/api/v1/`). Supabase is altmo-extended's own database — it does not replace or connect to core's PostgreSQL.

---

## 1. Architecture Boundary

### 1.1 Two-System Architecture

AltMo operates as two independent systems with a clean API boundary between them:

1. **AltMo Core** — The production Rails app on Digital Ocean. Handles Strava sync, challenge management, leaderboards, transit tracking, and auth. Runs PostgreSQL + PostGIS. **Must not be altered.**
2. **altmo-extended** — The intelligence and rental platform (this repo). Built on Supabase + Vercel. Consumes core data via REST API. Has its own database for external data, intelligence outputs, and rental operations.

```
+================================================================+
|  ALTMO CORE (DO NOT MODIFY)                                     |
|                                                                  |
|  Digital Ocean                                                   |
|  +---------------------------+    +-------------------------+    |
|  | Rails 7 Web App           |    | PostgreSQL + PostGIS    |    |
|  | - Strava sync             |    | - Users, Activities     |    |
|  | - Challenge management    |    | - Companies, Groups     |    |
|  | - Leaderboards            |    | - GeoMarkers            |    |
|  | - Transit tracking        |    | - Challenges            |    |
|  | - Auth (Devise)           |    | - LeaderBoards          |    |
|  +------------+--------------+    +-------------------------+    |
|               |                                                  |
|          REST API                                                |
|     /api/v1/*  endpoints                                         |
+========|=======================================================+
         |
    API boundary (read-only consumption)
         |
+========|=======================================================+
|  ALTMO EXTENDED (this repo)                                     |
|                                                                  |
|  Vercel                              Supabase (own instance)     |
|  +---------------------------+    +-------------------------+    |
|  | Vanilla JS + Vite         |    | PostgreSQL + PostGIS    |    |
|  | - Intelligence dashboards |    | + pgRouting             |    |
|  | - CycleMap UI             |    | - Synced core data      |    |
|  | - Pulse dashboard         |    | - External data (OSM,   |    |
|  | - Impact reports          |    |   weather, AQI, GTFS)   |    |
|  | - API routes (ETL cron)   |    | - Intelligence outputs  |    |
|  +---------------------------+    |   (cyclability scores,  |    |
|                                   |    demand predictions,  |    |
|  (Phase 2+)                       |    gap analysis)        |    |
|  +---------------------------+    | - Rental data (cbs)     |    |
|  | Cloudflare R2 (tiles)     |    | - Edge Functions        |    |
|  | Cloudflare Workers (API)  |    | - pg_cron               |    |
|  +---------------------------+    +-------------------------+    |
+================================================================+
```

### 1.2 Data Flow

altmo-extended pulls data from two sources — the AltMo Core Rails API and external APIs — and stores everything in its own Supabase instance.

```
AltMo Core Rails API                  External APIs
  /api/v1/routes                     OpenStreetMap
  /api/v1/leaderboard                CPCB (air quality)
  /api/v1/stats/*                    IMD (weather)
  /api/v1/activities/map             GTFS (transit)
  /api/v1/facilities                 Google Maps
       |                                  |
       v                                  v
+--------------------------------------------+
| Vercel Cron Jobs (ETL Layer)               |
| - Scheduled sync from Rails API            |
| - External data ingestion                  |
| - Runs every 1-24 hours depending on data  |
+---------------------+----------------------+
                      |
                      v
+--------------------------------------------+
| Supabase (altmo-extended's own instance)   |
|                                            |
| Synced tables:                             |
|   activity_routes (polylines, coords)      |
|   companies (facilities + locations)       |
|   leaderboards (aggregated stats)          |
|   city_stats (daily/monthly metrics)       |
|                                            |
| External data tables:                      |
|   road_segments (OSM network)              |
|   air_quality (CPCB stations)              |
|   weather (IMD forecasts)                  |
|   transit_stops (GTFS)                     |
|   accident_data (iRAD/NCRB)               |
|                                            |
| Intelligence output tables:                |
|   cyclability_scores (per road segment)    |
|   demand_hexes (H3 aggregated demand)      |
|   infra_gaps (high demand, no infra)       |
|   predictions (demand forecasts)           |
|   esg_reports (corporate impact data)      |
|                                            |
| Rental tables (cbs):                       |
|   bicycles, rentals, users, payments...    |
+--------------------------------------------+
```

### 1.3 ETL Sync Strategy (Rails API → Supabase)

| Data | Rails API Endpoint | Sync Frequency | Notes |
|---|---|---|---|
| Activity routes | `GET /api/v1/routes` | Every 6 hours | With date range params; store polylines in PostGIS |
| Activity map data | `GET /api/v1/activities/map` | Every 6 hours | Lat/long points for heatmaps |
| Company facilities | `GET /api/v1/facilities` | Daily | Locations for supply mapping |
| Organisation list | `GET /api/v1/companies` | Daily | Group structure |
| Company leaderboard | `GET /api/v1/leaderboard` | Every 6 hours | Per-city metrics |
| Group leaderboard | `GET /api/v1/group_leaderboard` | Every 6 hours | Organisation metrics |
| Global stats | `GET /api/v1/stats/global` | Every 6 hours | City-filtered aggregates |
| Daily stats | `GET /api/v1/stats/daily/:date` | Daily | Historical snapshots |
| Daily history | `GET /api/v1/daily_history` | Daily | Time-series data |

**API gaps (may need new endpoints on core):**
- Raw GPS polyline geometry per activity (currently limited)
- Transit activity data with locations
- GeoMarker polygon boundaries
- Challenge participation patterns
- User demographic aggregates (anonymised)

### 1.4 What This Means in Practice

| Aspect | How It Works |
|---|---|
| Data access to core | API-only via Rails REST endpoints (`/api/v1/`). No direct database access. |
| Database ownership | Supabase is altmo-extended's own instance. Core stays on Digital Ocean. |
| Data freshness | Periodic sync — latency equals ETL frequency (1-24 hours depending on data type). |
| Route geometry | Pulled via `/api/v1/routes`, stored locally in Supabase PostGIS. |
| Auth | Separate auth for altmo-extended. Core users accessed via API. |
| Deployment | Fully independent. Core on Digital Ocean, extended on Vercel + Supabase. |

---

## 2. Why No Backend Server Is Needed

The key insight is that Supabase's Postgres does the heavy lifting, not a backend server.

| Heavy Computation | Where It Runs | Why No Server Needed |
|---|---|---|
| Spatial queries (nearby, within boundary, distance) | PostGIS in Supabase Postgres | Runs as SQL, called via `supabase.rpc()` |
| Cycling route optimisation (Dijkstra, A*, TSP) | pgRouting in Supabase Postgres | Supabase supports this extension natively |
| Cyclability Index scoring | Postgres functions | Pre-compute per road segment, store as table |
| Demand aggregation by H3 hex | Postgres + SQL | H3 available as Postgres extension |
| Scheduled data ingestion (weather, AQI, core API sync) | Vercel Cron + Supabase Edge Functions | Vercel cron for ETL; Edge Functions for light DB-adjacent logic |
| API for dashboards | Supabase auto-generated REST API | Zero code needed for CRUD |
| Complex API logic | Vercel Serverless Functions | Up to 60s execution on Pro |
| ML predictions | Pre-compute, store in DB, serve as data | No real-time inference needed |

The intelligence products are **read-heavy, write-infrequent**. Cyclability scores, demand predictions, and gap analyses are computed on a schedule (daily/weekly), stored as results, and served as static data. This pattern fits serverless perfectly.

---

## 3. Compute Platform Comparison

### 3.1 Runtime Capabilities

| Capability | Vercel Serverless | Cloudflare Workers | Supabase Edge Functions |
|---|---|---|---|
| Runtime | Node.js | V8 isolates (JS/TS) | Deno |
| Max execution time | 60s (Pro), 300s (Enterprise) | 30s CPU (paid) | 400s wall clock, 2s CPU per request |
| Memory | 1024MB (Pro) | 128MB | 256MB |
| Cold start | 250-500ms | ~0ms (no cold starts) | ~200ms |
| Cron jobs | Yes (vercel.json) | Yes (Cron Triggers) | Yes (pg_cron) |
| Best for | API routes, SSR, PDF reports, ETL cron | High-volume API, edge logic | Light DB-adjacent logic |

### 3.2 Supabase Capabilities (altmo-extended's own instance)

| Feature | Detail |
|---|---|
| PostgreSQL | Full Postgres with 50+ extensions |
| PostGIS | Spatial queries, geo-indexing, distance calculations, bounding box queries |
| pgRouting | Dijkstra, A*, bidirectional search, TSP, driving distance, K-shortest paths |
| Auth | Email/password, phone OTP, social login, SSO with SAML |
| Storage | File storage with CDN, image transformations, resumable uploads |
| Realtime | Postgres changes via WebSocket, broadcast, presence |
| Edge Functions | Deno-based serverless functions (256MB memory, 400s wall clock) |
| Row Level Security | Fine-grained access control policies |
| Auto-generated REST API | CRUD endpoints from database schema, zero code |
| pg_cron | Scheduled jobs running inside Postgres |

### 3.3 Vercel Capabilities

| Feature | Detail |
|---|---|
| Static hosting | Vite/React/Next.js with automatic CDN distribution |
| Serverless Functions | Node.js, up to 60s (Pro) or 300s (Enterprise) |
| Edge Functions | Lightweight compute at CDN edge, ~0ms cold start |
| Cron Jobs | Configurable via vercel.json, production deployments only |
| Preview Deployments | Every git push gets a unique preview URL |
| Analytics | Web vitals, real user monitoring |
| Bandwidth | 1TB included on Pro plan |
| Image Optimisation | Automatic image resizing and format conversion |

### 3.4 Cloudflare Capabilities

| Feature | Detail |
|---|---|
| Workers | V8 isolate compute, 30s CPU (paid), zero cold starts |
| Pages | Free static site hosting with unlimited bandwidth |
| R2 | S3-compatible object storage with zero egress fees |
| Queues | Background job processing |
| Durable Objects | Stateful edge compute |
| Cron Triggers | Scheduled worker execution |
| D1 | SQLite at the edge (not needed with Supabase) |
| KV | Key-value storage at the edge |

---

## 4. Cost Comparison at Different Scales

### 4.1 Early Stage (~100 daily users, light map usage)

| Component | Vercel Stack | Cloudflare Stack |
|---|---|---|
| Supabase Pro (altmo-extended) | $25 | $25 |
| Hosting + Functions | $20 (Vercel Pro) | $0 (CF Pages free) |
| API compute | Included | $5 (Workers paid) |
| Tile/asset storage | Included in Supabase | $0.36 (R2, ~25GB) |
| Bandwidth | Included (1TB) | Included (unlimited) |
| External APIs (weather, AQI, maps) | ~$50 | ~$50 |
| **Monthly total** | **~$95** | **~$80** |

AltMo Core's hosting on Digital Ocean is already paid separately and is unchanged.

**Verdict:** Nearly identical. Choose based on developer experience preference.

### 4.2 Growth Stage (~1,000 daily users, moderate map usage)

| Component | Vercel Stack | Cloudflare Stack |
|---|---|---|
| Supabase Pro (altmo-extended) | $25 | $25 |
| Hosting + Functions | $20 | $0 |
| API compute | ~$20 overages | $5 |
| Map tile bandwidth (~500GB/mo) | Included in 1TB | $0 (R2 zero egress) |
| **Monthly total** | **~$115** | **~$80** |

**Verdict:** Still similar. Vercel's 1TB bandwidth covers moderate usage.

### 4.3 Scale Stage (~10,000 daily users, heavy map + API usage)

| Component | Vercel Stack | Cloudflare Stack |
|---|---|---|
| Supabase Team (altmo-extended) | $599 | $599 |
| Hosting + Functions | $20 | $0 |
| API compute overages | ~$150-300 | $5 + ~$5 |
| Map tile bandwidth (~3TB/mo) | **$300** (overage at $0.15/GB) | **$0** (R2 zero egress) |
| Tile storage (100GB) | Supabase Storage | $1.50 (R2) |
| **Monthly total** | **~$1,070-1,220** | **~$610** |

**Verdict:** Cloudflare is ~50% cheaper at scale, almost entirely due to zero egress on R2 for map tiles.

---

## 5. Product-by-Architecture Fit

| Intelligence Product | Best Compute Layer | Reason |
|---|---|---|
| CycleMap (tile serving) | Cloudflare R2 + Workers | Map tiles are bandwidth-heavy; R2 zero egress is critical |
| Pulse (city dashboard) | Vercel | Dashboard with SSR/ISR, great DX, preview deploys |
| Impact (ESG reports) | Vercel Functions | PDF generation needs memory (1024MB on Vercel vs 128MB on CF) |
| Routes (navigation API) | Supabase (pgRouting) | Route computation happens entirely in Postgres |
| Forecast (predictions) | Supabase (pre-compute) | Run predictions on schedule via pg_cron, store results |
| Public API (3rd party) | Cloudflare Workers | Cheapest at high volume, zero cold starts |
| ETL sync (core → extended) | Vercel Cron | Scheduled pull from Rails API into Supabase |

---

## 6. Recommended Architecture: Phased Approach

### Phase 1 — MVP (Months 1-6): Supabase + Vanilla JS + Vercel

**Estimated cost: ~$95/mo (INR ~8,000/mo)**

```
+================================================================+
|  ALTMO CORE (DO NOT MODIFY — Digital Ocean)                     |
|  Rails 7 + PostgreSQL + PostGIS                                 |
|  REST API: /api/v1/*                                            |
+========|=======================================================+
         |
    API boundary (read-only)
         |
+========|=======================================================+
|  ALTMO EXTENDED                                                 |
|                                                                  |
|  +-----------------------------+                                 |
|  |     Vercel (Frontend)       |                                 |
|  |  SvelteKit + Tailwind v4    |                                 |
|  |  Dashboard pages            |                                 |
|  |  API routes (/api/*)        |                                 |
|  |  Cron jobs (ETL sync)       |                                 |
|  +-------------+---------------+                                 |
|                |                                                 |
|                v                                                 |
|  +-----------------------------+                                 |
|  |     Supabase (Backend)      |                                 |
|  |  PostgreSQL + PostGIS       |                                 |
|  |  + pgRouting                |                                 |
|  |  Auth, Storage, RLS         |                                 |
|  |  Edge Functions (light API) |                                 |
|  |  pg_cron (scheduled jobs)   |                                 |
|  +-----------------------------+                                 |
+================================================================+
```

**Why start here:**
- Team already knows this stack (cbs app uses Supabase + Vite)
- Zero new infrastructure to learn
- PostGIS + pgRouting handle 80% of spatial intelligence in-database
- Vercel free/Pro tier covers all early needs
- Ship fast, validate product-market fit

**What to build:**
- Vercel Cron jobs to sync data from AltMo Core Rails API into Supabase
- Enable PostGIS + pgRouting on Supabase
- Cyclability Index computed via Postgres functions
- Dashboard served as static Vite app on Vercel
- External data ingestion via Vercel Cron + Supabase Edge Functions
- Map visualisation with Mapbox GL JS (client-side rendering, no tile server needed)

### Phase 2 — Scale the Map Layer (Months 6-9): Add Cloudflare R2

**Estimated cost: ~$100-150/mo**

```
+-----------------+     +--------------------+
| Vercel          |     | Cloudflare R2      |
| (Frontend +     |---->| (Map tiles as      |
|  Dashboards)    |     |  PMTiles format)   |
+--------+--------+     | Zero egress!       |
         |              +--------------------+
         v
+-----------------------------+
|     Supabase (Backend)      |
+-----------------------------+
         ^
         | ETL sync (via Vercel Cron)
+-----------------------------+
|  AltMo Core Rails API       |
+-----------------------------+
```

**Trigger:** When map tile bandwidth approaches Vercel's 1TB/mo limit (~5K+ daily map users).

**What changes:**
- Pre-generate vector tiles as PMTiles (single-file tile archive format)
- Store on Cloudflare R2 (zero egress fees)
- Serve directly to Mapbox GL / MapLibre via HTTP range requests
- No tile server needed — PMTiles is a serverless tile format

### Phase 3 — High-Volume API (Months 9-12): Add Cloudflare Workers

**Estimated cost: ~$120-200/mo**

```
+--------------+  +------------------+  +--------------+
| Vercel       |  | Cloudflare       |  | Cloudflare   |
| (Dashboards) |  | Workers (API)    |  | R2 (Tiles)   |
+------+-------+  +--------+---------+  +--------------+
       |                    |
       v                    v
+-------------------------------------+
|        Supabase (Backend)           |
+-------------------------------------+
         ^
         | ETL sync
+-------------------------------------+
|     AltMo Core Rails API            |
+-------------------------------------+
```

**Trigger:** When selling API access to third parties (bike-share operators, navigation apps, city governments).

**What changes:**
- Move public API endpoints to Cloudflare Workers
- Rate limiting, API key management at the edge
- Zero cold starts for API consumers
- Vercel continues serving dashboards (where its DX shines)

---

## 7. Key Technology Choices

### 7.1 Spatial Database: PostGIS on Supabase

PostGIS is the industry standard for geospatial data in PostgreSQL. Supabase supports it as a first-class extension. This runs on altmo-extended's own Supabase instance — not on core's database.

**Capabilities used:**
- `geography(POINT)` — Store locations (owner locations, bicycle positions, activity waypoints)
- `ST_Distance()` — Distance calculations between points
- `ST_DWithin()` — Find all points within a radius
- `ST_MakeBox2D()` — Bounding box queries for map viewport
- `<->` operator — Nearest-neighbour sort with spatial index
- `ST_LineString` — Store and analyse GPS route traces (synced from core via API)
- Spatial indexes (GiST) — High-performance geo queries

**Example: Find available bicycles within 2km**
```sql
create or replace function nearby_bicycles(user_lat float, user_long float, radius_meters float)
returns table (id uuid, name text, distance float)
language sql as $$
  select id, cycle_number as name,
    st_distance(location, st_point(user_long, user_lat)::geography) as distance
  from bicycles
  where status = 'available'
    and st_dwithin(location, st_point(user_long, user_lat)::geography, radius_meters)
  order by location <-> st_point(user_long, user_lat)::geography;
$$;
```

### 7.2 Routing Engine: pgRouting on Supabase

pgRouting extends PostGIS with graph-based routing algorithms. Available as a Supabase extension.

**Algorithms available:**
- Shortest Path Dijkstra
- Shortest Path A*
- Bi-directional Dijkstra and A*
- K-Shortest Paths (multiple alternative routes)
- Travelling Salesperson Problem
- Driving Distance (isochrones)
- Turn Restriction Shortest Path

**Used for:** AltMo Routes — computing the safest/healthiest cycling route using a road network graph (from OSM, stored in Supabase) where edge weights incorporate cyclability scores, not just distance.

### 7.3 Hex Grid: H3 for Spatial Aggregation

Uber's H3 hexagonal grid system for aggregating GPS data without revealing individual routes.

**Why H3:**
- Consistent hexagonal cells (no distortion like square grids)
- Multiple resolution levels (fine-grained to city-wide)
- Privacy: aggregate to minimum 5 users per hex before surfacing data
- Efficient spatial joins and neighbour lookups

**Implementation:** Use `h3-pg` PostgreSQL extension or compute H3 indexes in Edge Functions.

### 7.4 Map Rendering: Mapbox GL JS / MapLibre GL JS

Client-side vector tile rendering for the CycleMap and Pulse dashboards.

**Why client-side rendering:**
- No tile server needed
- Smooth zooming and rotation
- Dynamic styling (colour road segments by cyclability score)
- Works with PMTiles (serverless tile format)

**Cost consideration:**
- Mapbox GL JS: Free up to 50K map loads/mo, then $5/1K loads
- MapLibre GL JS: Fully open source, free, fork of Mapbox GL v1
- **Recommendation:** Start with MapLibre to avoid vendor lock-in and cost

### 7.5 Tile Format: PMTiles

PMTiles is a single-file tile archive format that can be served from any static storage (Cloudflare R2, S3, Supabase Storage) via HTTP range requests.

**Why PMTiles:**
- No tile server infrastructure needed
- Works with any CDN or object storage
- Supports vector tiles (MVT format)
- Client-side libraries available for MapLibre
- Pre-generate tiles from PostGIS data using `tippecanoe`

### 7.6 Frontend: SvelteKit

**Decision:** SvelteKit was chosen over Vanilla JS/Vite for the following reasons:
- File-based routing with nested layouts (shared navigation is built-in)
- Server routes for ETL cron jobs (no separate backend needed)
- First-class Vercel adapter (`@sveltejs/adapter-vercel`)
- Smaller bundle than React/Next.js — important for map-heavy dashboards
- Svelte stores for global state (city context, date range, auth)
- TypeScript support out of the box

**Key frontend dependencies:**
- MapLibre GL JS — open-source map rendering (no token)
- Chart.js — charts and visualisations
- H3-js — hexagonal grid for demand aggregation
- Tailwind CSS v4 — unified Altmo design system

### 7.7 Scheduled Jobs and ETL

| Job Type | Tool | Frequency |
|---|---|---|
| Core API sync (routes, stats, leaderboards) | Vercel Cron + fetch API | Every 6 hours |
| Core API sync (facilities, companies, history) | Vercel Cron + fetch API | Daily |
| Weather/AQI data ingestion | Vercel Cron + fetch API | Every 1-6 hours |
| OSM road network update | Supabase Edge Function | Weekly |
| Cyclability Index recompute | pg_cron + Postgres function | Daily |
| Demand aggregation | pg_cron + Postgres function | Daily |
| ML prediction refresh | Vercel Function (60s max) | Weekly |
| Carbon credit calculation | pg_cron + Postgres function | Monthly |

---

## 8. What You Do NOT Need

| Often Suggested | Why Not Needed |
|---|---|
| Dedicated backend server (EC2, DigitalOcean) | PostGIS + pgRouting run computation in-database; serverless handles the rest |
| Direct access to core's PostgreSQL | Rails REST API provides all needed data; ETL sync keeps local copy fresh |
| Redis cache | Supabase has built-in connection pooling; pre-computed results are already in Postgres |
| Kafka / message queue | Vercel Cron + Edge Functions handle all ETL at this scale; Supabase Realtime for live updates |
| Dedicated tile server (Martin, pg_tileserv) | PMTiles format eliminates tile servers entirely |
| ML infrastructure (SageMaker, etc.) | Pre-compute predictions weekly in a Postgres function or scheduled Vercel function; store results as a table |
| Heavy framework (React, Next.js) | SvelteKit provides routing + SSR with smaller bundles; no need for heavier frameworks |

---

## 9. When to Reconsider

| Trigger | Action |
|---|---|
| Map tile bandwidth > 1TB/mo | Add Cloudflare R2 for tile serving |
| API calls > 100K/day from third parties | Move public API to Cloudflare Workers |
| ML models need real-time inference | Add managed ML service (Replicate, Modal, or self-hosted) |
| Dashboard complexity requires SSR/SSG | Consider migrating frontend to Next.js on Vercel |
| Database size > 8GB (Pro limit) | Upgrade to Supabase Team ($599/mo) |
| Need sub-second spatial queries at > 1M rows | Add Supabase read replicas or consider dedicated PostGIS instance for altmo-extended's own data |
| Core API rate limits become a bottleneck | Request bulk export endpoints or negotiate higher limits |
| Data freshness requirements drop below 1 hour | Consider Supabase Edge Functions with more frequent polling or request webhook support from core |

---

## 10. Cost Summary

| Phase | Stack | Monthly Cost (USD) | Monthly Cost (INR approx) |
|---|---|---|---|
| Phase 1 (MVP) | Supabase Pro + Vercel Pro | ~$95 | ~INR 8,000 |
| Phase 2 (Map scale) | + Cloudflare R2 | ~$100-150 | ~INR 8,500-12,500 |
| Phase 3 (API scale) | + Cloudflare Workers | ~$120-200 | ~INR 10,000-17,000 |
| At scale (10K DAU) | Full hybrid stack | ~$610-650 | ~INR 51,000-55,000 |

AltMo Core hosting on Digital Ocean is already paid separately and is not affected.

**Comparison: Full hybrid at scale vs Vercel-only at scale = ~50% cost savings ($610 vs $1,200), primarily from Cloudflare R2's zero egress fees on map tiles.**

---

## 11. Decision Matrix

| Criteria | Supabase + Vercel | Supabase + Cloudflare | Hybrid (Recommended) |
|---|---|---|---|
| Developer experience | Best (familiar stack) | Good (new platform) | Best (each tool where it shines) |
| Time to MVP | Fastest | Moderate | Fast (start with Vercel) |
| Cost at MVP | $95/mo | $80/mo | $95/mo |
| Cost at scale | $1,200/mo | $610/mo | $610/mo |
| Map tile serving | Expensive at scale | Cheapest (zero egress) | Cheapest |
| Dashboard DX | Excellent (preview deploys) | Good | Excellent (Vercel for dashboards) |
| API at scale | Moderate | Cheapest | Cheapest (CF Workers) |
| Spatial compute | Supabase (same) | Supabase (same) | Supabase (same) |
| Core data access | Rails API + ETL sync | Rails API + ETL sync | Rails API + ETL sync |
| Complexity | Lowest | Low-moderate | Moderate (grows with scale) |
