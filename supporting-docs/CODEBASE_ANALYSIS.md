# AltMo Codebase Analysis

## Repository Map

| Repository | Purpose | Tech Stack | Status |
|---|---|---|---|
| `altmo-rails-web-app` | Production backend & web dashboard | Ruby on Rails 7, PostgreSQL + PostGIS, Puma | Production (altmo.app) |
| `altmo-mobile-native-app` | Native mobile app (tracking) | React Native, Expo 50, Expo Router | Early development |
| `altmo-static` | Marketing landing pages | Static HTML, Tailwind CSS | Production |
| `cbs` | Bicycle rental marketplace | Vanilla JS, Vite, Supabase | Separate product |
| `altmo-extended` | Intelligence platform (this repo) | SvelteKit, Tailwind CSS v4, Supabase, MapLibre GL, Vercel | In development |

---

## 1. altmo-rails-web-app (Production Backend)

### 1.1 Tech Stack

- **Framework:** Ruby 3.1.2 / Rails 7.0.2.3
- **Database:** PostgreSQL with PostGIS extension
- **Web server:** Puma
- **Frontend:** Hotwire (Turbo + Stimulus), Tailwind CSS + daisyUI, jQuery
- **Background jobs:** Spawnling (gem-based async, not Sidekiq)
- **Email:** Postmark
- **File uploads:** CarrierWave (local storage)
- **API docs:** apipie-rails

### 1.2 Database Schema

#### Core Entities

**Users**
- Devise authentication (email/password + Strava OAuth)
- Strava fields: `athlete_id`, `access_token`, `refresh_token`, `expires_at`, `username`
- Location: `country_id`, `state_id`, `city_id`
- Profile: `name`, `email`, `phone`, `dob`, `gender`, `designation`, `age` (range enum)
- Stats cache: `last_week_rides`, `last_month_rides`, `current_month_rides`, `total_rides`
- Flags: `is_an_ambassador`, `requested_to_be_an_ambassador`
- `source`: signup, bulk upload, oauth_signup
- `data` (JSONB): full Strava athlete object
- `ref_transport_mode_id`: preferred commute mode

**Activities** (commute rides synced from Strava)
- `user_id`, `company_id`, `group_id`
- `activity_id` (Strava activity ID)
- `name`, `distance`, `moving_time`, `elapsed_time`, `activity_type`
- `start_date`, `start_latitude`, `start_longitude`, `end_latitude`, `end_longitude`
- `average_speed`, `max_speed`, `average_watts`
- `direction`: up (to work) / down (from work)
- `petrol_saved`, `money_saved` (calculated)
- `data` (JSONB): full Strava response
- `source`: webhook / manual pull
- Related: `activity_route`, `activity_address`

**OtherActivity** (leisure rides — not near company)
- Same schema as Activities
- Stores rides that don't qualify as commutes

**TransitActivity** (public transport rides)
- `user_id`, `transit_point_id`, `activity_id`
- `strava_activity_id`, `name`, `activity_type`
- `start_date`, `distance`, `moving_time`, `direction`
- `status`: pending / approved / rejected
- `source`: geo (polygon geofence) / radius (150m radius)
- `co2`, `money_saved`, `petrol_saved`

**CityLeaderActivity** (F2WCR challenge tracking)
- `user_id`, `challenge_id`
- `strava_activity_id`, `name`, `activity_type` (ride, run, walk)
- `city_id`, `city_name`, `distance`, `moving_time`, `avg_speed`
- `manual` (boolean: user-submitted or Strava)
- `status`: accepted / rejected / flagged
- `actioned_by` (auditor user ID)
- `calculated_speed`, `pace` (for validation)

**Companies** (employer facilities)
- `name`, `address`, `city_id`, `state_id`, `country_id`
- `emp_count`, `approved`, `campus_id`
- Stats: `last_week_rides`, `last_month_rides`, `current_month_rides`, `total_rides`
- `leader_board_id`

**Groups** (organisations — parent of companies)
- `name`, `city_id`, `city_name`
- Aggregate stats: `riders`, `rides`, `distance`, `co2`, `petrol_saved`, `money_saved`

**Challenges**
- `user_id` (creator), `name`, `description`, `short_description`
- `start_date`, `end_date`
- `challenge_type`: commute / transit
- `challenge_scope`: global / city / company / facility / public_transit
- `challenge_scope_ids` (array of scope entity IDs)
- `status`: draft / active / inprogress / completed
- `target` (rides needed to complete)
- `eligibility_type`, `eligibility_value` (e.g., "Previous Month Rides" <= X)
- `moderated` (boolean: requires approval)
- `public_visibility`

**ChallengeUser** (participants)
- `challenge_id`, `user_id`, `city_id`, `company_id`, `group_id`
- Stats: `rides`, `distance`, `co2`, `petrol_saved`, `money_saved`
- `completed` (boolean), `status` (pending/approved/removed)

**ChallengeActivity** (links activities to challenges)
- `challenge_id`, `altmo_activity_id`
- `activity_type`: com (commute) / oth (other) / tra (transit)

**LeaderBoard**
- `company_id`, `group_id`
- `riders`, `rides`, `distance`, `sort_order`
- `co2`, `petrol_saved`, `money_saved`, `percentage`

**GeoMarker** (geographic zones — PostGIS)
- Polymorphic: `associable_id`, `associable_type` (Company, Campus, TransitPoint)
- `lat`, `lon`, `layer_type` (point/polygon)
- `latlngs` (array for polygon vertices)
- `the_geom` (PostGIS geometry column with spatial index)
- PostGIS scopes: `close_to(lat, lon, distance)`, `eligible(lat, lon)`, `eligible_transit_points`, `closed_transit_points(150m)`, `closed_companies(150m)`

**TransitEntity** (transit agencies)
- `agency_id`, `agency_name`, city/state info

**TransitPoint** (transit stops)
- `transit_entity_id`, `name`, `status`
- Stats: `riders`, `rides`, `distance`, `co2`, `pending_rides`
- `line_color` (comma-separated for visualisation)

**History** (time-series snapshots)
- Snapshots of leaderboard data for historical reporting

**StravaWebhook** (incoming webhooks)
- `athlete_id`, `activity_id`, `aspect_type` (create/update/delete)
- `updates` (JSONB), `pulled` (boolean: processed)

#### Reference Tables
- `Role`: Rider, Ambassador, Group Ambassador, City Admin, Campus Admin, State Admin, Transit Authority, City Leader, Super Admin, Auditor
- `UserRole`: many-to-many join
- `UserCompany`: user-to-company assignment (with `active` flag)
- `UserCity`: admin jurisdiction
- `Campus`: multi-facility zones
- `RefTransportMode`: preferred commute modes
- `ApiUser`: external API key management
- `ActionLog`, `ApiLog`, `EmailLog`, `EmailQueueEntry`: audit trail

### 1.3 Metrics Formulas

| Metric | Formula |
|---|---|
| CO2 saved | `distance_km * 0.25` kg |
| Petrol saved | `distance_km * 0.108` litres |
| Money saved | `petrol_saved * 101` INR |

### 1.4 API Endpoints

**Public API (`/api/v1/`)**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/leaderboard` | Company leaderboard (optional `city_id` filter) |
| GET | `/api/v1/group_leaderboard` | Organisation leaderboard |
| GET | `/api/v1/groups` | All organisations |
| GET | `/api/v1/facilities` | Company/facility list |
| GET | `/api/v1/companies` | Organisation list |
| GET | `/api/v1/routes` | Activity routes (params: `start_date`, `end_date`, `facility_id`, `company_id`, `rider_id`) |
| GET | `/api/v1/public/routes` | Unauthenticated route data |
| GET | `/api/v1/cities/list` | Cities list |
| GET | `/api/v1/stats/daily/:date` | Daily statistics |
| GET | `/api/v1/stats/global[/:city_id]` | Global or city-filtered stats |
| GET | `/api/v1/activities/map[/:city_id]` | Activity locations for map |
| GET | `/api/v1/activities/company[/:id]` | Company-specific activities |
| GET | `/api/v1/daily_history` | Daily stats history |
| GET | `/api/v1/credit_types` | Credit type definitions |

**Challenges (`/challenges/`)**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/challenges` | List (all, draft, private, enrolled, completed) |
| GET | `/challenges/:id` | Show with hierarchical results |
| POST | `/challenges` | Create (draft or publish) |
| PATCH | `/challenges/:id` | Update |
| DELETE | `/challenges/:id` | Destroy |
| GET | `/challenges/join` | Join/leave (checks eligibility) |
| POST | `/challenges/dashboard` | Paginated participant data |
| GET | `/challenges/:id/moderation-screen` | Moderation interface |
| POST | `/challenges/update-status` | Approve/reject participants |

**F2WCR Campaign**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/F2WCR` | Leaderboard landing |
| GET | `/F2WCR-leaderboard-details` | Detailed view |
| GET | `/summary-top-entities` | Top people/cities/regions |
| GET | `/F2WCR/moderation` | Moderation dashboard |

**Admin endpoints** at `/admin/` for user management, transit point CRUD, company management, activity moderation, and audit logs.

### 1.5 Strava Integration

**OAuth flow:**
- User connects Strava account via OAuth 2.0
- Tokens stored: `access_token`, `refresh_token`, `expires_at`
- Auto-refresh when token expires (< 1 hour remaining)

**Activity sync (dual mode):**
1. **Webhook push:** Strava sends create/update/delete events → stored in `StravaWebhook` → processed asynchronously
2. **Manual pull:** Periodic batch pull of all activities since `last_pulled_at`

**Activity classification logic:**
```
For each activity from Strava:
  1. Decode polyline → get start/end coordinates
  2. Query GeoMarkers with PostGIS:
     - close_to(start_lat, start_lon, 1000m) → nearby companies
     - close_to(end_lat, end_lon, 1000m) → nearby companies
  3. If start OR end is near a company:
     → Store as Activity (commute)
     → Set direction: up (ended at company) / down (started at company)
  4. If near a transit stop (150m radius or polygon geofence):
     → Store as TransitActivity
  5. If neither:
     → Store as OtherActivity (leisure)
  6. If activity date falls within active challenge:
     → Create ChallengeActivity link
     → Update ChallengeUser stats
```

**Speed/pace validation (F2WCR):**
- Cycling: flag if speed > 35 km/h
- Walking: flag if pace < 510 sec/km
- Running: flag if pace < 270 sec/km
- Manual entries always flagged for audit

### 1.6 Geographic Processing

**PostGIS scopes on GeoMarker:**
- `close_to(lat, lon, distance=1000m)` — points within radius
- `eligible(lat, lon)` — points within polygon
- `eligible_transit_points(lat, lon)` — transit stops within polygon
- `closed_transit_points(lat, lon, distance=150m)` — nearby transit stops
- `closed_companies(lat, lon, distance=150m)` — nearby companies

**Transit activity detection (two methods):**
1. **Polygon geofence:** checks if start/end coords fall within transit point's polygon boundary
2. **Radius geofence (fallback):** checks if start/end coords are within 150m of transit point

### 1.7 User Roles

| Role | Access Level |
|---|---|
| Super Admin | Full system access |
| State Admin | State-level administration |
| City Admin | City-level administration |
| Campus Admin | Campus facility management |
| Group Ambassador | Organisation-level champion |
| Ambassador | Company-level champion |
| Transit Authority | Transit agency management |
| City Leader | F2WCR challenge participant |
| Auditor | Activity validation and audit |
| Rider | Basic participant |

### 1.8 Challenge System

**Creation:** Name, description, scope, dates, target rides, eligibility criteria, moderation toggle, visibility.

**Scopes:** Global, City, Company, Facility, Public Transit — each scopes participants and activities differently.

**Eligibility:** Optional criteria (e.g., "previous month rides <= X") to target specific user segments.

**Activity linking:** Activities auto-tagged to challenges via `ChallengeActivity` when date falls within challenge range and challenge is active.

**Moderation:** Optional manual approval workflow for participants before their activities count.

**Leaderboard:** Hierarchical view: global → cities → organisations → companies → individuals. Sortable by rides, distance, CO2, money saved.

---

## 2. altmo-mobile-native-app (Native Mobile App)

### 2.1 Tech Stack

- **Framework:** React Native 0.73.6 + Expo 50.0.17
- **Routing:** Expo Router 3.4.10 (file-based)
- **Maps:** react-native-maps 1.10.0 (Google Maps provider)
- **Location:** expo-location 16.5.5
- **State:** React hooks + TanStack React Query 5.37.1
- **HTTP:** axios 1.7.0
- **Distance calc:** haversine 1.1.1
- **Fonts:** Poppins (9 weights)
- **Icons:** FontAwesome
- **No TypeScript**

### 2.2 Screens

| Screen | Route | Status | Description |
|---|---|---|---|
| Home | `/(tabs)/` | Placeholder | "This is the homepage" |
| Record | `/(tabs)/record` | Implemented | Map showing current location, "Start" button to begin tracking |
| Activities | `/(tabs)/activities` | Implemented | FlatList of recorded activities with route polylines |
| Tracker | `/tracker` | Implemented | Live recording: speed, distance, moving time, play/pause/stop |
| Profile | `/profile` | Placeholder | "This is the profile page" |

### 2.3 GPS Tracking Implementation

**Permission:** Foreground only (`requestForegroundPermissionsAsync`)

**Tracking:** `watchPositionAsync` with:
- Accuracy: High (GPS + assisted)
- Distance interval: 1 meter
- Data captured: latitude, longitude, speed (m/s)

**Distance:** Haversine formula between consecutive coordinates, accumulated during recording.

**Route data:** Array of `{latitude, longitude}` objects stored during recording.

**Default fallback region:** Bangalore (12.9716, 77.5946)

**Auto-pause logic:** Commented out but partially implemented (pauses after 5s of speed <= 2 m/s).

### 2.4 API Integration

**Base URL:** `http://localhost:3000/activities` (development only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/activities` | Save recorded activity |
| GET | `/activities` | Fetch all activities |

**Not yet integrated:** Rails backend auth, Strava sync, challenges, leaderboards.

### 2.5 Missing Features (Not Yet Implemented)

- Authentication (no login/signup)
- Strava integration
- Challenges and gamification
- Push notifications
- Offline support / background tracking
- Transit detection
- Company proximity detection
- Leaderboards

---

## 3. Implications for altmo-extended

### 3.1 Data Access Strategy

The Rails backend is the authoritative data source. AltMo core's PostgreSQL database on Digital Ocean must NOT be modified or accessed directly. altmo-extended accesses core data exclusively through the Rails REST API:

1. **Consume the existing Rails REST API** (`/api/v1/`) for all core data (leaderboards, stats, routes, company lists, activity maps)
2. **Sync data via scheduled ETL** — Vercel Cron jobs pull from the Rails API on a schedule (every 1-24 hours depending on data type) and store in altmo-extended's own Supabase instance
3. **Request new API endpoints on core** for data not yet exposed (raw GPS polylines, transit activity locations, GeoMarker polygons, challenge participation patterns, anonymised demographic aggregates)
4. **NOT duplicate** the Rails backend's logic (auth, Strava sync, challenge management)
5. **NOT access core's PostgreSQL directly** — no read replicas, no direct database connections

### 3.2 Available Data for Intelligence Layer

**Accessible via existing Rails API:**
- Activity routes: `GET /api/v1/routes` (with date/facility/company/rider filters)
- Activity map points: `GET /api/v1/activities/map` (lat/long for heatmaps)
- Company leaderboard: `GET /api/v1/leaderboard` (per-city metrics)
- Group leaderboard: `GET /api/v1/group_leaderboard` (organisation metrics)
- Company/facility list: `GET /api/v1/facilities`, `GET /api/v1/companies`
- City statistics: `GET /api/v1/stats/global`, `GET /api/v1/stats/daily/:date`
- Daily history: `GET /api/v1/daily_history`

**Needs new API endpoints on core (cannot be accessed via direct DB):**
- Raw GPS polyline/route geometry from `activity_route` table
- Transit activity data with geolocation
- GeoMarker polygons (company and transit stop boundaries)
- Challenge participation patterns and engagement metrics
- Historical leaderboard snapshots (`History` table)
- User demographic aggregates (age, gender, transport mode preferences — anonymised)

### 3.3 Architecture Implications

| Decision | Rationale |
|---|---|
| AltMo core must not be modified | Core PostgreSQL runs on Digital Ocean; it is a separate production system |
| All core data accessed via REST API only | `/api/v1/*` endpoints are the sole interface; no direct database connections |
| altmo-extended gets its own Supabase instance | For synced core data, external data (OSM, weather, AQI), intelligence outputs (cyclability scores, demand predictions), and rental data |
| Rails API is consumed, not replaced | The Rails backend handles auth, Strava, challenges — altmo-extended reads this data via API |
| Data sync via scheduled ETL | Vercel Cron jobs pull from Rails API, store in Supabase; data freshness = ETL frequency (1-24 hours) |
| Separate auth for altmo-extended | Core users accessed via API; altmo-extended manages its own auth via Supabase Auth |
| PostGIS in both systems (independently) | Core has PostGIS for activity classification; altmo-extended has PostGIS for cyclability analysis, routing, and spatial intelligence |
| Fully independent deployment | Core on Digital Ocean, altmo-extended on Vercel + Supabase |

### 3.4 Tracking Data and Multi-Modal Activities

**The AltMo native tracker is the primary system of record.** Strava is one of several connectors — future third-party device integrations (fitness trackers, other apps) will feed into AltMo core alongside the native app. The native tracker currently supports **walking and cycling**, with **running** coming soon and potential to add more modes.

**altmo-extended does not concern itself with:**
- How polylines/GPS tracks are collected (native app, Strava, future connectors)
- Activity validation or classification algorithms (commute vs leisure, speed checks, etc.)
- The mechanics of syncing from Strava or other sources

**altmo-extended does need access to:**
- The resulting activity data (polylines, coordinates, distances, modes) regardless of source
- Multi-modal activity data — walking, cycling, running, transit — for comprehensive mobility intelligence
- Sufficient route geometry for spatial analysis (heatmaps, demand mapping, cyclability scoring)

This data is accessed via the Rails REST API. If the existing API endpoints don't expose enough detail (e.g., full polyline geometry, per-mode breakdowns), new endpoints should be requested on core. altmo-extended is agnostic to the tracking source — it consumes whatever activity data core exposes.

### 3.5 Implementation Status (altmo-extended)

The altmo-extended platform has been scaffolded with the following stack:

- **Framework:** SvelteKit (Svelte 5 with runes) — file-based routing, server routes for ETL
- **Styling:** Tailwind CSS v4 with unified Altmo color palette (brand greens, tangerine accents, earth/moss/clay/sage scales)
- **Maps:** MapLibre GL JS (open-source, no token needed)
- **Charts:** Chart.js
- **Spatial:** H3-js for hexagonal grid aggregation
- **Database:** Supabase (PostgreSQL + PostGIS) via `@supabase/supabase-js`
- **Deployment:** Vercel with `@sveltejs/adapter-vercel`
- **ETL:** 4 SvelteKit server routes as Vercel Cron Jobs (sync-routes, sync-stats, sync-facilities, sync-external)

**Route structure:**
- `/` — Home overview dashboard
- `/cyclemap` — Interactive cycling infrastructure map
- `/pulse` — Mobility analytics (trips, commute, transit, recreation, trends sub-pages)
- `/impact` — ESG impact dashboard with per-company detail pages
- `/routes` — Route optimization and corridor analysis
- `/forecast` — Demand predictions and growth modelling

**External app links** (open in new tab from footer): Altmo Rentals (CBS), Altmo Tracker, Altmo Rewards
