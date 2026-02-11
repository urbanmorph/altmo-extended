# Transit Data Integration for Altmo Intelligence

**Version:** 1.0
**Date:** February 2026
**Status:** Phase 1 Implementation Complete

---

## 1. Overview

### What is Altmo Intelligence?

Altmo Intelligence is a government-focused analytics platform designed to provide actionable insights on active mobility infrastructure — walking and cycling — for urban decision-makers. The platform analyzes real-world movement patterns to help cities plan, monitor, and improve their pedestrian and cycling networks.

**Active Mobility = Walking + Cycling**

### Role of Transit Data

Transit data serves as **critical context** that makes walking and cycling analytics actionable for government planning. Transit integration enables:

- **First/Last Mile Analysis**: Understanding how people walk or cycle to/from transit stops
- **Infrastructure Gap Identification**: Finding corridors with high transit ridership but poor pedestrian/cycling infrastructure
- **Catchment Analysis**: Measuring how much of a city's population can reach transit via walking or cycling
- **Multimodal Planning**: Supporting integrated transport planning that connects active mobility with public transit

### Core Principle: No Data Duplication

Altmo does **not** duplicate or store activity trace data from multiple sources. Instead:

- **Existing Altmo activity data** (routes, trips, heatmaps) remains in the database via existing ETL pipelines
- **Transit data** (stops, stations, routes) is fetched on-demand from open-source repositories
- **Analytics** are computed by joining these datasets at query time or in scheduled batch jobs

This architecture keeps the system lightweight, maintainable, and respectful of data licensing.

---

## 2. Data Sources (Phase 1 — Bengaluru)

Phase 1 focuses on Bengaluru (Bangalore), India's third-largest city and a pioneer in publishing open mobility data.

### Source Inventory

| Source | URL | Format | License | Description |
|--------|-----|--------|---------|-------------|
| **TransitRouter Bus Stops** | `https://raw.githubusercontent.com/Vonter/transitrouter/main/data/blr/stops.min.json` | JSON: `{stop_id: [lng, lat, name, dir, ""]}` | MIT | 6,000+ BMTC bus stops with precise coordinates |
| **TransitRouter Bus Services** | `https://raw.githubusercontent.com/Vonter/transitrouter/main/data/blr/services.min.json` | JSON: `{route_id: {name, terminus: [[stops]]}}` | MIT | Route-stop topology for 2,000+ BMTC bus routes |
| **Namma Metro Stations & Lines** | `https://raw.githubusercontent.com/geohacker/namma-metro/master/metro-lines-stations.geojson` | GeoJSON FeatureCollection | Public Domain | Metro station locations + line geometry for Purple & Green Lines |

### Source Details

#### TransitRouter (BMTC Bus Data)
- **Repository**: https://github.com/Vonter/transitrouter
- **Maintainer**: Vonter (1,110+ commits as of Feb 2026)
- **License**: MIT
- **Coverage**: Complete BMTC (Bangalore Metropolitan Transport Corporation) network
- **Update Frequency**: Community-maintained, updated with official BMTC changes
- **Data Quality**: High — field-verified coordinates, includes stop direction (Northbound/Southbound etc.)

**Available Data Files** (per city):

| File | Description | Example Size (BLR) |
|---|---|---|
| `stops.min.json` | All stops: `{stop_id: [lng, lat, name, suffix, parent]}` | 647 KB |
| `routes.min.json` | Encoded polylines for every route | 4.7 MB |
| `services.min.json` | Routes per stop, trip counts, destinations | 1.4 MB |
| `firstlast.min.json` | First/last service times (weekday/weekend) | 4.1 MB |
| `ranking.min.json` | Stop importance scores | 104 KB |

#### Namma Metro (Bangalore Metro Rail)
- **Repository**: https://github.com/geohacker/namma-metro
- **Maintainer**: geohacker (Sajjad Anwar)
- **License**: Public Domain
- **Coverage**: Purple Line (37 stations), Green Line (32 stations)
- **Status**: Operational as of 2025; Yellow and Blue Lines under construction
- **Data Quality**: High — official alignment with station coordinates

**Additional Bengaluru Transit Sources:**

| Source | Repository | Data | Format |
|---|---|---|---|
| Full GTFS feed | [bengawalk/gtfs-blr](https://github.com/bengawalk/gtfs-blr) | Complete BMRCL GTFS: stops, routes, trips, stop_times, shapes, fares, transfers, calendar | GTFS (13 files) |
| Hourly ridership | [Vonter/bmrcl-ridership-hourly](https://github.com/Vonter/bmrcl-ridership-hourly) | Station-wise hourly entry/exit counts, station-pair O/D matrices | Parquet, CSV |
| BMTC GTFS | [Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs) | Routes, stops, timetables, fares, Kannada translations | GTFS |

---

## 3. Architecture

### Three-Tier Data Storage Strategy

Altmo uses a **tiered approach** to avoid premature database ingestion while maintaining flexibility for future analytics.

#### Tier 1: Configuration Files (`src/lib/config/`)

**Purpose**: City definitions, data source URLs, data layer availability
**Storage**: Static TypeScript files in version control
**Examples**:
- `cities.ts` — City metadata, bounding boxes, transit source URLs
- `data-readiness.ts` — Per-city data layer status (green/amber/red)

**No database involvement.** This tier is read at runtime to determine what data to fetch.

#### Tier 2: On-Demand Fetching with Server-Side Cache

**Purpose**: Fetch transit data from GitHub when needed
**Storage**: In-memory cache on server with 24-hour TTL
**Implementation**: `src/lib/server/transit-data.ts`

**No database rows created.** Transit data is fetched at request time (e.g., when a user loads `/cyclemap` or `/pulse/transit`), cached in a module-level variable, and re-fetched after 24 hours or on cold start.

**Why no database?**
- Transit data changes infrequently (weeks/months)
- Small payload size (bus stops JSON: ~800 KB, metro GeoJSON: ~200 KB)
- Simplifies deployment (no migrations, no ETL jobs)
- Keeps data fresh from upstream sources

**Cache Behavior**:
```typescript
// Pseudo-code
if (cache exists && cache age < 24h) {
  return cachedData;
} else {
  const freshData = await fetch(sourceURL);
  cache = { data: freshData, timestamp: now() };
  return freshData;
}
```

#### Tier 3: Database (Phase 2 — Future)

**Purpose**: Store **computed analytics** that require joins with Altmo activity data
**Examples**:
- `transit_stops` table with pre-computed catchment polygons
- `first_last_mile_scores` table with route-to-stop mappings
- `infrastructure_gaps` table with prioritized corridors

**Phase 1 has ZERO database changes.** This tier is reserved for Phase 2 when analytics require persistent storage.

---

## 4. File Map

### New Files Created

#### Configuration Layer
```
src/lib/config/
├── cities.ts                    # City definitions with transit data source URLs
└── data-readiness.ts            # Per-city data layer availability matrix
```

#### Data Fetching & Processing
```
src/lib/utils/
└── transit.ts                   # Types, haversine distance, catchment helpers, GeoJSON conversion, parsing

src/lib/server/
└── transit-data.ts              # Server-side fetcher with in-memory cache (24h TTL)
```

#### UI Components
```
src/lib/components/
├── MapLayerToggle.svelte        # Layer toggle button with color-coded status indicator
├── DataReadinessGrid.svelte     # Data readiness comparison grid (multi-city table)
└── CatchmentRingLegend.svelte   # Catchment ring legend (400m/800m/2km)
```

#### Pages & Routes
```
src/routes/
├── cyclemap/
│   ├── +page.server.ts          # Server load for transit data (bus stops, metro stations)
│   └── +page.svelte             # Modified: transit layers + sidebar with layer toggles
└── pulse/
    └── transit/
        ├── +page.server.ts      # Server load for transit metrics dashboard
        └── +page.svelte         # Full transit analytics dashboard
```

### Modified Files

```
src/
├── app.css                      # Added: transit colors, catchment ring colors, status colors
├── lib/
│   └── components/
│       ├── Map.svelte           # Added: onReady callback for layer initialization
│       └── CitySelector.svelte  # Modified: uses cities config instead of hardcoded list
└── routes/
    ├── +layout.server.ts        # Modified: uses cities config
    ├── +page.svelte             # Added: Data Readiness section with DataReadinessGrid
    └── cyclemap/
        └── +page.svelte         # Added: transit layer toggles, catchment rings, legend
```

---

## 5. Bengaluru Context Data

### Walking Infrastructure

Bengaluru has made significant investments in pedestrian infrastructure through the **TenderSURE program** (Tenderfeet, Gender-Sensitive, Underground Restructuring of Encroachments).

| Metric | Value | Source |
|--------|-------|--------|
| **Walkable Footpath (Completed)** | ~100 km | TenderSURE + Smart Cities programs |
| **TenderSURE Impact** | +228% pedestrians, +113% women | DULT Impact Study |
| **Footpath Planned (CMP 2020)** | 974 km | Comprehensive Mobility Plan |
| **Footpath Target** | 548 km | CMP Priority Corridors |
| **TenderSURE Pipeline** | 103 km | DULT 2025 Plan |

**Key Insight**: TenderSURE streets see a 228% increase in pedestrian activity and 113% increase in women pedestrians, demonstrating the impact of quality walking infrastructure.

### Cycling Infrastructure

| Metric | Value | Source |
|--------|-------|--------|
| **Cycle Lanes (Existing)** | ~8 km | DULT 2024 Survey |
| **Cycle Tracks Planned (CMP)** | 600 km | Comprehensive Mobility Plan 2020 |
| **Bicycle Masterplan (Retrofit)** | 350 km | DULT Bicycle Masterplan |

**Key Challenge**: Bengaluru has extensive cycling demand but minimal dedicated infrastructure. The 600 km CMP target represents a 75× increase from current levels.

### Namma Metro (2025-2026 Status)

| Line | Stations | Status | Route |
|------|----------|--------|-------|
| **Purple Line** | 37 | Operational | Whitefield (East) to Challaghatta (West) |
| **Green Line** | 32 | Operational | Madavara (North) to Silk Institute (South) |
| **Yellow Line** | — | Under Construction | RV Road to Bommasandra |
| **Blue Line** | — | Under Construction | Expected June 2026 |
| **Total Operational** | **69** | **Active** | Two lines, 83 km |

**Ridership**: 800,000+ daily passengers as of 2025 (source: BMRCL monthly reports)

### BMTC Bus Network

| Metric | Value | Source |
|--------|-------|--------|
| **Fleet Size** | 6,340 buses | BMTC 2024 Annual Report |
| **Daily Ridership** | 4.91 million passengers | BMTC 2024 |
| **Metro Feeder Buses** | 236 buses, 70 routes | BMTC 2025 |
| **Bus Stops** | 6,000+ | TransitRouter dataset |

**First/Last Mile Challenge**: Only 236 buses serve metro feeders, leaving most metro stations dependent on walking, cycling, or autorickshaws for access.

### Safety

| Metric | Value | Year | Source |
|--------|-------|------|--------|
| **Pedestrian Deaths** | 292 | 2023 | Bengaluru Traffic Police |
| **Vulnerable User Fatalities** | 91% of total deaths | 2023 | BTP (pedestrians + cyclists + two-wheelers) |

**Key Insight**: 2023 saw the highest pedestrian death toll in 13 years, highlighting the urgent need for safer walking infrastructure.

### Climate & Modal Share Targets

Bengaluru Climate Action Plan (BCAP) targets:

| Year | Target Modal Share | Components |
|------|-------------------|------------|
| **2030** | 75% | Public Transit (PT) + Non-Motorized Transport (NMT) |
| **2040** | 80% | Public Transit (PT) + Non-Motorized Transport (NMT) |

**Current Modal Share (2023)**: ~40% PT+NMT (source: CMP 2020 household survey)
**Gap**: Achieving 75% by 2030 requires doubling active mobility + transit usage in 4 years.

---

## 6. Multi-City Data Coverage

Altmo tracks data availability for six major Indian cities. The **data readiness grid** itself is a product feature — it shows governments what they gain by publishing open mobility data.

### Data Layer Comparison

| City | Altmo Traces | Bus Stops | Metro Stations | Metro Frequency | Metro Ridership | Bus Frequency | Walking Infra | Cycling Infra | Safety Data | Air Quality |
|------|--------------|-----------|----------------|-----------------|-----------------|---------------|---------------|---------------|-------------|-------------|
| **Bengaluru** | 🟢 Green | 🟢 Green | 🟢 Green | 🟡 Amber | 🟡 Amber | 🔴 Red | 🟡 Amber | 🔴 Red | 🟡 Amber | 🟢 Green |
| **Chennai** | 🟡 Amber | 🔴 Red | 🟢 Green | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🟢 Green |
| **Delhi** | 🟢 Green | 🟡 Amber | 🟢 Green | 🟢 Green | 🟢 Green | 🔴 Red | 🟡 Amber | 🔴 Red | 🟢 Green | 🟢 Green |
| **Hyderabad** | 🟡 Amber | 🔴 Red | 🟢 Green | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🟢 Green |
| **Kochi** | 🔴 Red | 🔴 Red | 🟢 Green | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🟡 Amber |
| **Pune** | 🟡 Amber | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🔴 Red | 🟢 Green |

**Legend**:
- 🟢 **Green**: High-quality open data available
- 🟡 **Amber**: Partial data or community-sourced
- 🔴 **Red**: No structured open data

### Key Insights

1. **Bengaluru leads** in open transit data (bus stops, metro stations) due to community efforts (TransitRouter, Namma Metro repo)
2. **Delhi excels** in metro data due to DMRC's transparency, but lacks open bus data
3. **Most cities lack bus frequency data**, limiting first/last mile analysis
4. **No city publishes cycling infrastructure data** in machine-readable format
5. **Safety data** (crash locations, pedestrian fatalities) is rarely published openly

**The Gap is the Product**: Showing governments what analytics are possible when data is open creates incentive for data publication.

### Multi-City Transit Data Sources

TransitRouter covers multiple Indian cities:

| City | Code | Live APIs | Data Source |
|---|---|---|---|
| **Bengaluru** | `blr` | Arrivals + Vehicles | [Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs) |
| Chennai | `chn` | No | ChennaiGTFS |
| Delhi | `del` | No | OTD Delhi |
| Pune | `pun` | No | pmpml-gtfs |
| Kochi | `kch` | No | Jungle Bus |
| Goa | `goa` | No | KTCL Goa |
| Telangana | `tlg` | No | Open Data Telangana |
| Andhra Pradesh | `ap` | No | APSRTC GTFS |
| Indian Railways | `rail` | No | indianrailways-gtfs + OSM |

### Metro System Comparison

| Metro System | Stations + Coords | Line Geometry | Schedules/Frequency | Ridership | Live Data |
|---|---|---|---|---|---|
| **Bengaluru (Namma)** | Yes (geohacker + GTFS) | Yes (GeoJSON + GTFS shapes) | Yes (GTFS stop_times) | Yes (Vonter, hourly) | No |
| **Kochi (KMRL)** | Yes (official GTFS) | Yes | Yes | No | No |
| **Hyderabad (HMRL)** | Yes (official GTFS) | Yes | Yes | No | Partial |
| **Delhi (DMRC)** | Partial (OSM) | Partial (OSM) | Limited | No | No |
| **Chennai (CMRL)** | Yes (unofficial) | Partial | Limited | No | No |

### Centralized GTFS Discovery

| Portal | URL | Notes |
|---|---|---|
| Mobility Database | [mobilitydatabase.org](https://mobilitydatabase.org/) | 4,000+ feeds, successor to TransitFeeds |
| Transitland | [transit.land](https://www.transit.land/) | Federated GTFS service |
| Data.gov.in | [data.gov.in/sector/transport](https://www.data.gov.in/sector/transport) | Indian government open data |
| DataMeet | [datameet.org/category/data/transport](https://datameet.org/category/data/transport/) | Indian open data community |

---

## 7. Phased Roadmap

### Phase 1: Display Layer (✅ Complete)

**Goal**: Visualize transit data alongside activity data without database changes.

**Deliverables**:
- ✅ Transit data fetching from GitHub sources
- ✅ Server-side caching (24h TTL)
- ✅ Map layers: bus stops, metro stations, catchment rings
- ✅ Transit dashboard (`/pulse/transit`) with network metrics
- ✅ Data readiness grid (multi-city comparison)
- ✅ Layer toggle UI with status indicators

**Database Changes**: None

**User Value**: Decision-makers can see transit context overlaid with cycling/walking activity patterns.

---

### Phase 2: Database + Analytics (🔜 Next)

**Goal**: Enable spatial joins between transit data and Altmo activity data for first/last mile analysis.

**Deliverables**:
- 🔜 `transit_stops` table (bus + metro)
- 🔜 `transit_routes` table (bus services)
- 🔜 Spatial indexing (PostGIS geographies)
- 🔜 First/last mile score computation
  - % of trips starting/ending within 400m of transit
  - Top origin/destination stops for cycling trips
- 🔜 Catchment area analysis
  - % of population within 2 km cycling catchment of metro
  - Underserved corridors (high ridership, poor walking infra)

**Database Schema** (Proposed):

```sql
-- Transit stops (bus + metro)
CREATE TABLE transit_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id TEXT NOT NULL UNIQUE,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('bus', 'metro')),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  city_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transit_stops_location ON transit_stops USING GIST(location);
CREATE INDEX idx_transit_stops_city ON transit_stops(city_id);

-- Transit routes (bus services)
CREATE TABLE transit_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id TEXT NOT NULL,
  name TEXT NOT NULL,
  city_id TEXT NOT NULL,
  stop_sequence TEXT[] NOT NULL, -- Array of stop_ids
  geometry GEOGRAPHY(LINESTRING, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- First/last mile scores (pre-computed)
CREATE TABLE first_last_mile_scores (
  route_id UUID REFERENCES activity_routes(id),
  origin_stop_id UUID REFERENCES transit_stops(id),
  destination_stop_id UUID REFERENCES transit_stops(id),
  origin_distance_m INTEGER,
  destination_distance_m INTEGER,
  is_first_mile BOOLEAN, -- Started near transit
  is_last_mile BOOLEAN,  -- Ended near transit
  computed_at TIMESTAMPTZ DEFAULT now()
);
```

**ETL Job** (Proposed):
- Scheduled nightly job to fetch latest transit data from GitHub
- Upsert to `transit_stops` and `transit_routes` tables
- Trigger recomputation of first/last mile scores for recent activity routes

**User Value**: Quantified insights like "35% of cycling trips in Indiranagar start within 400m of a metro station" or "Whitefield metro station has a 2 km cycling catchment covering 50,000 residents but zero cycle tracks."

---

### Phase 3: Multi-City Expansion (📅 Q3 2026)

**Goal**: Add transit data for Chennai, Delhi, Hyderabad, Kochi, Pune.

**Deliverables**:
- 🔜 Transit data source discovery for 5 cities
- 🔜 Data partnerships with city governments or transit agencies
- 🔜 Community data collection (bus stops via field surveys if needed)
- 🔜 Unified data format (normalize disparate source formats)

**Challenges**:
- **Bus stop data**: No TransitRouter equivalent for most cities
- **Metro frequency**: DMRC (Delhi), CMRL (Chennai) do not publish timetables openly
- **Walking/cycling infra**: No cities publish this in machine-readable format

**Approach**:
1. **Prioritize metro data** (easier to source, high impact)
2. **Partner with OpenStreetMap community** for bus stop tagging
3. **Field surveys** as last resort (expensive, slow)

**User Value**: Multi-city benchmarking ("Bengaluru has 4× more cycle tracks than Hyderabad") and standardized analytics across cities.

---

### Phase 4: Prescriptive Analytics (📅 2027)

**Goal**: Move from descriptive analytics ("what is") to prescriptive ("what should be").

**Deliverables**:
- 🔜 Infrastructure gap computation
  - Corridors with high cycling demand but no cycle tracks
  - Metro stations with large catchment but poor walkability
- 🔜 Corridor prioritization algorithm
  - ROI scoring: (potential users × safety risk × equity) / cost
- 🔜 Scenario modeling
  - "If we build 10 km of cycle tracks here, how many trips shift from cars?"
- 🔜 Equity analysis
  - Are low-income neighborhoods underserved by walking infra?

**Example Output**:
> "The **Outer Ring Road (ORR) corridor** between Silk Board and KR Puram sees 12,000 cycling trips/month but has zero dedicated cycle tracks. Installing 18 km of protected cycle lanes would serve 45,000 residents within 400m catchment, reduce 8% of car trips, and cost ₹54 crore (₹3 crore/km). **Priority: High** due to safety risk (23 cyclist injuries in 2023-24)."

**User Value**: Turns Altmo from a monitoring tool into a planning tool that recommends infrastructure investments with quantified impact.

---

## 8. Key Design Decisions

### 1. No Premature Database Ingestion

**Decision**: Keep transit data in Tier 2 (fetched on-demand) until analytics require joins with activity data.

**Rationale**:
- Transit data changes slowly (weeks/months)
- Fetching from GitHub is fast (<1s per source)
- Avoids ETL job complexity and database bloat
- Simplifies deployment (no migrations)

**Trade-off**: Cannot perform spatial joins until Phase 2. Acceptable for Phase 1's display-only use case.

---

### 2. No Hardcoded Data in Svelte Components

**Decision**: All city metadata, transit source URLs, and data readiness status live in `src/lib/config/`.

**Rationale**:
- Single source of truth for adding/modifying cities
- Non-developers (e.g., data analysts) can update data readiness without touching component code
- Easier testing (mock config, not components)

**Implementation**:
```typescript
// src/lib/config/cities.ts
export const cities = {
  bengaluru: {
    id: 'bengaluru',
    name: 'Bengaluru',
    transitSources: {
      busStops: 'https://raw.githubusercontent.com/Vonter/transitrouter/...',
      metroStations: 'https://raw.githubusercontent.com/geohacker/namma-metro/...'
    }
  }
};
```

Components import this config instead of hardcoding.

---

### 3. No Altmo Activity Data Duplication

**Decision**: Never copy or re-ETL existing Altmo activity data (routes, trips, heatmaps). Reference it via foreign keys or spatial joins.

**Rationale**:
- Altmo activity data already ingested via existing ETL pipelines (`/api/etl/sync-routes`, etc.)
- Duplicating data creates drift, increases storage, and complicates updates
- Transit analytics should **augment**, not replace, existing data

**Implementation**:
- Phase 1: No joins, just display both datasets on same map
- Phase 2: Spatial joins at query time (`WHERE ST_DWithin(activity_routes.origin, transit_stops.location, 400)`)

---

### 4. Server-Side Caching with Module-Level Variable

**Decision**: Cache fetched transit data in a module-level variable on the server, not in a database or Redis.

**Rationale**:
- Vercel serverless functions are stateless but share a warm container for ~5 minutes
- Module-level variable persists across requests in the same container
- Clears on cold start (fine — cold starts are rare, and re-fetch takes <1s)
- Avoids external dependency (Redis) for simple caching

**Implementation**:
```typescript
// src/lib/server/transit-data.ts
let busStopsCache: { data: any; timestamp: number } | null = null;

export async function getBusStops(cityId: string) {
  const now = Date.now();
  const TTL = 24 * 60 * 60 * 1000; // 24 hours

  if (busStopsCache && now - busStopsCache.timestamp < TTL) {
    return busStopsCache.data;
  }

  const freshData = await fetch(cities[cityId].transitSources.busStops).then(r => r.json());
  busStopsCache = { data: freshData, timestamp: now };
  return freshData;
}
```

**Trade-off**: Cache clears on cold start. Acceptable since cold starts are infrequent and re-fetch is fast.

---

### 5. Walking Included Alongside Cycling

**Decision**: Define active mobility as **walking + cycling**, not just cycling.

**Rationale**:
- Walking is the most common mode for first/last mile (80%+ of metro access trips)
- Safety issues affect pedestrians more than cyclists (292 pedestrian deaths vs. ~30 cyclist deaths in Bengaluru 2023)
- Infrastructure projects often combine footpaths + cycle tracks (e.g., TenderSURE streets)

**Implementation**:
- Catchment radii: **400m/800m for walking**, **2 km for cycling**
- Map layers: "Walking catchment" and "Cycling catchment" toggle separately
- Analytics: "% of trips starting within walking distance of transit" vs. "cycling distance"

**UI Language**:
- Use "active mobility" in headers/titles
- Specify "walking" or "cycling" in chart labels and metrics

---

### 6. Catchment Radii Based on Research

**Decision**: Use **400m/800m** for walking catchment, **2 km** for cycling catchment.

**Source**:
- **400m walking**: Standard "quarter-mile rule" from US transit planning (National Academies TCRP)
- **800m walking**: Acceptable distance for high-quality transit (BRT/Metro) per ITDP guidelines
- **2 km cycling**: CROW Design Manual (Netherlands) for "comfortable cycling to transit"

**Implementation**:
- Map: Concentric circles around transit stops at 400m (light), 800m (medium), 2 km (bold)
- Analytics: "Within 400m" = primary walking catchment, "Within 2 km" = primary cycling catchment

---

## 9. Technical Implementation Notes

### Server-Side Data Flow

```
User requests /cyclemap
  ↓
+page.server.ts load() function runs
  ↓
Calls getBusStops('bengaluru') from transit-data.ts
  ↓
Cache hit? → Return cached data
Cache miss? → Fetch from GitHub, cache, return
  ↓
+page.svelte receives data as props
  ↓
MapLayerToggle.svelte controls visibility
  ↓
Map.svelte renders layers with MapLibre GL
```

### Coordinate Systems

- **Storage**: WGS84 (EPSG:4326) — `[longitude, latitude]`
- **Display**: MapLibre GL uses Web Mercator (EPSG:3857) internally, but expects WGS84 input
- **Phase 2 Database**: PostGIS `GEOGRAPHY(POINT, 4326)` for stops, `GEOGRAPHY(LINESTRING, 4326)` for routes

### GeoJSON Conversion

TransitRouter bus stops are stored as:
```json
{
  "stop_id": [lng, lat, "name", "direction", ""]
}
```

Converted to GeoJSON FeatureCollection:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [lng, lat] },
      "properties": { "id": "stop_id", "name": "name", "direction": "direction" }
    }
  ]
}
```

Utility function in `src/lib/utils/transit.ts`:
```typescript
export function busStopsToGeoJSON(stops: BusStopsData): FeatureCollection {
  const features = Object.entries(stops).map(([id, [lng, lat, name, dir]]) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    properties: { id, name, direction: dir }
  }));
  return { type: 'FeatureCollection', features };
}
```

### Haversine Distance Calculation

Used for catchment analysis (finding stops within X meters of a point):

```typescript
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
```

**Use case**: "How many bus stops are within 400m of this metro station?"

### Tech Stack Compatibility

| Feature | TransitRouter | Altmo-Extended |
|---|---|---|
| Map library | MapLibre GL 5.6.2 | MapLibre GL 5.1.0 |
| Tile format | PMTiles / Protomaps | PMTiles (planned) |
| Polyline encoding | Google polyline | Same (geo.ts has decoder) |
| Data format | Minified JSON | Supabase (PostGIS) |

---

## 10. Integration with Altmo Intelligence Products

| Product | Transit Data Usage |
|---|---|
| **CycleMap** | Overlay transit stops/routes on cycling map; show bike parking demand at stations |
| **Pulse / Transit** | First/last mile analysis; cycling catchment areas around metro/bus stops |
| **Pulse / Commute** | Multi-modal commute patterns (bike → metro → bike) |
| **Routes** | Multi-modal routing (cycle to nearest metro, ride, cycle from destination metro) |
| **Forecast** | Predict cycling demand around new metro stations; bike-share dock placement |
| **Impact** | CO₂ savings from bike+transit vs car commutes |

---

## 11. Future Considerations

### Data Partnerships

**Challenge**: Most Indian cities do not publish open transit data.

**Approach**:
1. **Start with OpenStreetMap**: Tag bus stops, metro stations as POIs
2. **Government partnerships**: MoUs with transit agencies (BMTC, CMRL, etc.)
3. **Community mapping**: Engage local cycling advocacy groups to map infrastructure

**Example MoU Template**:
> "City Government agrees to provide Altmo with (1) bus stop locations, (2) GTFS feed (optional), (3) monthly ridership data (aggregated), in exchange for (1) annual active mobility report, (2) priority corridor recommendations, (3) API access for city dashboard."

---

### GTFS Integration

**What is GTFS?** General Transit Feed Specification — standard format for transit schedules, used by Google Maps.

**Phase 3 Goal**: Ingest GTFS feeds for frequency analysis.

**GTFS Files Used**:
- `stops.txt` → Bus/metro stop locations
- `routes.txt` → Route metadata (name, type)
- `trips.txt` → Trip-level details (service patterns)
- `stop_times.txt` → Schedule (arrival/departure times at each stop)

**Analytics Enabled**:
- **Headway analysis**: Average wait time at each stop
- **Frequency heatmap**: Stops with service every 5 min vs. 30 min
- **Peak vs. off-peak**: Time-of-day service patterns

**Challenge**: Few Indian cities publish GTFS. BMTC does not. Delhi Metro does (via DMRC website).

---

### Real-Time Data (Phase 4+)

**Goal**: Integrate real-time bus/metro locations for live first/last mile recommendations.

**Live APIs Available**:

TransitRouter provides real-time APIs for Bengaluru:
```
GET /api/arrivals/bmtc?stationid={id}
→ Next 3 arrivals per route, vehicle type, load, wheelchair access, vehicle location

GET /api/vehicles/bmtc?routetext={route}
→ Real-time bus positions, heading, ETA, current/next stop
```

**Other Cities**:
- **BMTC**: No official public real-time API as of 2026
- **Namma Metro**: No public API; some third-party apps scrape their internal API
- **Delhi Metro**: Real-time data via DMRC's National Common Mobility Card (NCMC) API (requires partnership)

**User Value**: "Nearest bus arriving in 3 minutes, 450m walk" recommendations in Altmo mobile app.

**Technical**: WebSocket or Server-Sent Events (SSE) for live updates.

---

### Equity & Accessibility

**Phase 4 Goal**: Analyze whether low-income neighborhoods have equitable access to walking/cycling infrastructure and transit.

**Data Required**:
- **Census ward demographics** (income, gender, age)
- **Infrastructure density** (km of footpath/cycle track per capita)
- **Transit coverage** (% of population within 400m of bus stop)

**Metric Example**:
> "Wards with median income <₹30,000/month have 0.3 km of footpath per 1,000 residents, vs. 1.2 km in wards >₹80,000/month. **Equity gap: 4×**"

**Policy Impact**: Informs targeted infrastructure investments in underserved areas.

---

## 12. Conclusion

Transit data integration transforms Altmo from a **cycling analytics tool** into a comprehensive **active mobility intelligence platform**. By contextualizing walking and cycling patterns with bus and metro networks, Altmo enables governments to:

1. **Identify infrastructure gaps** where demand exists but infrastructure is missing
2. **Prioritize investments** using quantified catchment and ridership data
3. **Measure equity** by comparing access across neighborhoods
4. **Track progress** toward climate and modal share targets (e.g., BCAP 75% PT+NMT by 2030)

Phase 1's lightweight, on-demand architecture keeps the system nimble while establishing the foundation for deeper analytics in Phases 2-4. The three-tier data strategy ensures we never prematurely optimize or duplicate data, while the phased roadmap balances quick wins (display layers) with long-term value (prescriptive analytics).

**The gap in open data across cities is itself a product feature** — showing governments what's possible when data is open creates the incentive to publish. As Bengaluru leads with community-maintained datasets like TransitRouter, Altmo can demonstrate the value of open mobility data and encourage other cities to follow.

---

**Next Steps**:
- [ ] Phase 2 kickoff: Design `transit_stops` schema and ETL job
- [ ] Partnership outreach: BMTC, BMRCL for official data feeds
- [ ] Multi-city scoping: Identify transit data sources for Chennai, Delhi, Hyderabad

---

**Document Metadata**
**Author**: Altmo Intelligence Team
**Last Updated**: February 11, 2026
**Version**: 1.0
**Related Docs**: `CODEBASE_ANALYSIS.md`, `TECH_STACK_ANALYSIS.md`, `OPPORTUNITY_PLAN.md`, `NEW_API_ENDPOINTS_SPEC.md`
