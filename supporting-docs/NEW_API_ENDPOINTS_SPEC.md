# New API Endpoints Specification for AltMo Core

## Context

altmo-extended needs data from AltMo core that is not currently exposed via the existing `/api/v1/` endpoints. This document specifies new endpoints to be added to the Rails app (`altmo-rails-web-app`).

**Ground rules:**
- All endpoints live under `/api/v1/` in the existing `Api::V1` namespace
- No authentication required (consistent with existing public endpoints like `/api/v1/leaderboard`, `/api/v1/routes`, `/api/v1/stats/*`)
- No modification to existing endpoints or database schema
- Read-only — these endpoints expose existing data in new ways
- altmo-extended will call these on a schedule (ETL), not in real-time

---

## Existing API Audit

Before building new endpoints, here's what already exists and what altmo-extended gets from each:

| Endpoint | What It Returns | What's Missing for Intelligence |
|---|---|---|
| `GET /api/v1/routes` | Activity routes with `path` (decoded polyline as coordinate array) | Requires `facility_id`, `company_id`, or `rider_id` — no "all routes" bulk fetch. Default date range is Q1 2020 when params are missing. No pagination. |
| `GET /api/v1/activities/map` | Last 7 days' activities with decoded polylines | Only 7-day window. No historical access. |
| `GET /api/v1/leaderboard` | Company leaderboards (riders, rides, distance, CO2, etc.) | No timestamp — snapshot only. No historical trend. |
| `GET /api/v1/group_leaderboard` | Organisation leaderboards | Same — no history. |
| `GET /api/v1/facilities` | Companies with lat/lon from first geo_marker | Only point locations — no polygon boundaries. |
| `GET /api/v1/stats/global` | Daily stats for past 90 days | Good for trends, but 90-day window only. |
| `GET /api/v1/stats/daily/:date` | Single-day stats | One day at a time — no bulk range. |
| `GET /api/v1/daily_history` | History records for groups | Requires `date` param for filtering. |

### Existing Issues to Fix

1. **`GET /api/v1/routes`** — Returns empty array `[]` when no filter params are provided. The default date range is hardcoded to Q1 2020 (`2020-01-01` to `2020-03-31`). For bulk ETL, altmo-extended needs a way to fetch all routes within a date range without specifying a specific facility/company/rider.

2. **No pagination** on any endpoint. For ETL this is fine at current scale but will become a problem.

---

## New Endpoints

### EP-1: Bulk Activity Routes

**Purpose:** Fetch all activity routes within a date range, across all facilities, for spatial analysis (heatmaps, demand mapping, cyclability scoring).

**Why needed:** The existing `/api/v1/routes` requires at least one of `facility_id`, `company_id`, or `rider_id`. altmo-extended needs all routes across the entire platform.

```
GET /api/v1/routes/bulk
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string (YYYY-MM-DD) | Yes | — | Start of date range |
| `end_date` | string (YYYY-MM-DD) | Yes | — | End of date range |
| `city_id` | integer | No | all cities | Filter by city |
| `page` | integer | No | 1 | Page number |
| `per_page` | integer | No | 500 | Results per page (max 1000) |
| `activity_types` | string | No | all | Comma-separated: `ride,walk,run` |

**Response:**

```json
{
  "success": true,
  "page": 1,
  "per_page": 500,
  "total_count": 12450,
  "total_pages": 25,
  "routes": [
    {
      "activity_id": 12345,
      "activity_type": "ride",
      "start_date": "2024-06-15T08:30:00Z",
      "distance": 8500.0,
      "moving_time": 1800,
      "start_lat": 12.9716,
      "start_lng": 77.5946,
      "end_lat": 12.9352,
      "end_lng": 77.6245,
      "direction": "up",
      "facility_id": 14,
      "company_id": 3,
      "city_id": 1,
      "path": [[12.9716, 77.5946], [12.9700, 77.5960], ...]
    }
  ]
}
```

**Implementation notes:**
- Uses `Activity.includes(:activity_route, :company)` with date range filter
- The `path` field comes from `activity_route.path` (serialized Array in `text` column — decoded Strava polyline stored as `[[lat, lng], ...]`)
- `city_id` filter via `Company.where(city_id:).pluck(:id)` → `Activity.where(company_id:)`
- Must include `activity_type` for multi-modal filtering (walk, ride, run)
- Pagination critical — could be tens of thousands of rows

**Controller location:** `app/controllers/api/v1/base_controller.rb` (add method) or create a new `routes_controller.rb`

**Estimated effort:** Small — mostly a variation of existing `routes` method with bulk access and pagination.

---

### EP-2: Transit Activity Data

**Purpose:** Fetch transit (public transport) activities with location data for multi-modal mobility analysis.

**Why needed:** Transit activities are a separate model (`TransitActivity`) with no API exposure. altmo-extended needs this for transit demand mapping and multi-modal corridor analysis.

```
GET /api/v1/transit_activities
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string (YYYY-MM-DD) | Yes | — | Start of date range |
| `end_date` | string (YYYY-MM-DD) | Yes | — | End of date range |
| `city_id` | integer | No | all | Filter by city (via transit_entity → city_id) |
| `status` | string | No | `approved` | Filter: `pending`, `approved`, `rejected` |
| `page` | integer | No | 1 | Page number |
| `per_page` | integer | No | 500 | Results per page (max 1000) |

**Response:**

```json
{
  "success": true,
  "page": 1,
  "per_page": 500,
  "total_count": 3200,
  "total_pages": 7,
  "transit_activities": [
    {
      "id": 456,
      "user_id": 78,
      "transit_point_id": 12,
      "transit_point_name": "Majestic Metro Station",
      "transit_entity_name": "BMRCL",
      "activity_type": "ride",
      "start_date": "2024-06-15T08:15:00Z",
      "distance": 5200.0,
      "direction": "up",
      "status": "approved",
      "source": "geo",
      "co2": 1.30,
      "petrol_saved": 0.56,
      "money_saved": 56.56
    }
  ]
}
```

**Implementation notes:**
- `TransitActivity.includes(:transit_point => :transit_entity).where(start_date: range, status: :approved)`
- City filter: `TransitEntity.where(city_id:)` → `TransitPoint.where(transit_entity_id:)` → `TransitActivity.where(transit_point_id:)`
- No location coordinates on `TransitActivity` itself — location comes from the associated `TransitPoint`'s `GeoMarker`

**Database columns** (from migration + model):
- `transit_activities`: `user_id`, `transit_point_id`, `name`, `strava_activity_id`, `activity_type`, `start_date`, `distance`, `co2`, `petrol_saved`, `money_saved`, `direction` (enum: up/down), `activity_id`, `status` (enum: pending/approved/rejected), `source`, `data` (serialized Hash)

**Estimated effort:** Small — straightforward query with includes.

---

### EP-3: GeoMarker Boundaries

**Purpose:** Fetch geographic zone boundaries (company locations, campus polygons, transit stop zones) for spatial analysis.

**Why needed:** altmo-extended needs polygon boundaries for:
- Geofencing analysis (which areas have coverage)
- Transit stop catchment area mapping
- Campus boundary visualisation
- Supply-side mapping (where facilities are, how large their zones are)

```
GET /api/v1/geo_markers
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | string | No | all | Filter: `Company`, `Campus`, `TransitPoint` |
| `city_id` | integer | No | all | Filter by city |
| `layer_type` | string | No | all | Filter: `point`, `polygon` |

**Response:**

```json
{
  "success": true,
  "total_count": 245,
  "geo_markers": [
    {
      "id": 1,
      "associable_type": "Company",
      "associable_id": 14,
      "associable_name": "Mapunity",
      "lat": 12.9716,
      "lon": 77.5946,
      "layer_type": "point",
      "latlngs": null,
      "radius": 1000.0,
      "city_id": 1
    },
    {
      "id": 52,
      "associable_type": "Campus",
      "associable_id": 3,
      "associable_name": "Electronics City Phase 1",
      "lat": 12.8456,
      "lon": 77.6603,
      "layer_type": "polygon",
      "latlngs": [[12.845, 77.659], [12.847, 77.662], [12.843, 77.663], [12.845, 77.659]],
      "radius": null,
      "city_id": 1
    },
    {
      "id": 120,
      "associable_type": "TransitPoint",
      "associable_id": 8,
      "associable_name": "Majestic Metro Station",
      "lat": 12.9767,
      "lon": 77.5713,
      "layer_type": "polygon",
      "latlngs": [[12.976, 77.570], [12.977, 77.572], [12.975, 77.573], [12.976, 77.570]],
      "radius": null,
      "city_id": 1
    }
  ]
}
```

**Implementation notes:**
- `GeoMarker.includes(:associable)` — polymorphic, so need to resolve the association name
- City filter requires joining through the associable: `Company.where(city_id:)`, `TransitPoint → TransitEntity.where(city_id:)`, `Campus` (via companies inside campus)
- `latlngs` is a serialized Array (`serialize :latlngs, Array`) stored as text
- `the_geom` is a PostGIS geometry column — don't expose raw WKB, the `lat`/`lon`/`latlngs` fields are sufficient
- `parking_lot_type` and `cycle_parking_capacity` also available on some markers

**Database columns** (from migration + subsequent additions):
- `geo_markers`: `name`, `lat`, `lon`, `latlngs` (text, serialized Array), `radius`, `zoom`, `layer_type`, `associable_id`, `associable_type`, `the_geom` (PostGIS geometry), `sequence`, `parking_lot_type`, `cycle_parking_capacity`

**Estimated effort:** Small-medium — polymorphic association requires resolving names.

---

### EP-4: Challenge Summary

**Purpose:** Fetch challenge participation patterns and aggregated engagement metrics for understanding community engagement and predicting demand.

**Why needed:** Challenge data reveals engagement patterns — which cities are most active, what motivates participation, how gamification drives behaviour change. Critical for the Pulse dashboard and ESG Impact reports.

```
GET /api/v1/challenges/summary
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | string | No | all | Filter: `draft`, `active`, `inprogress`, `completed` |
| `city_id` | integer | No | all | Filter by city (via challenge_scope_ids or participant city) |

**Response:**

```json
{
  "success": true,
  "challenges": [
    {
      "id": 5,
      "name": "Pedal to Work June 2024",
      "challenge_type": "commute",
      "challenge_scope": "city",
      "challenge_scope_ids": [1, 15],
      "status": "completed",
      "start_date": "2024-06-01",
      "end_date": "2024-06-30",
      "target": 20,
      "moderated": false,
      "public_visibility": true,
      "participant_stats": {
        "total_participants": 450,
        "completed_count": 312,
        "completion_rate": 0.693,
        "total_rides": 8940,
        "total_distance_km": 89400.5,
        "total_co2_kg": 22350.12,
        "total_petrol_litres": 9655.25,
        "total_money_saved_inr": 975180.25,
        "by_city": [
          {
            "city_id": 1,
            "participants": 280,
            "completed": 195,
            "rides": 5600,
            "distance_km": 56000.0
          },
          {
            "city_id": 15,
            "participants": 170,
            "completed": 117,
            "rides": 3340,
            "distance_km": 33400.5
          }
        ]
      }
    }
  ]
}
```

**Implementation notes:**
- `Challenge.includes(:challenge_users)` with optional status filter
- Participant stats aggregated from `ChallengeUser` records
- City breakdown from `ChallengeUser.group_by(&:city_id)`
- `challenge_scope_ids` stored as array column on Challenge
- `ChallengeUser` columns: `challenge_id`, `user_id`, `rides`, `distance`, `co2`, `petrol_saved`, `money_saved`, `city_id`, `group_id`, `company_id`, `completed`, `status`, `transit_agency_id`, `transit_point_id`

**Estimated effort:** Medium — requires aggregation logic.

---

### EP-5: Historical Leaderboard Snapshots

**Purpose:** Fetch time-series leaderboard data for trend analysis (growth curves, seasonal patterns, city-level comparisons over time).

**Why needed:** The current `/api/v1/leaderboard` returns only the current snapshot. altmo-extended needs historical data for the Pulse dashboard trend charts and ESG Impact reporting.

```
GET /api/v1/history
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `start_date` | string (YYYY-MM-DD) | Yes | — | Start of date range |
| `end_date` | string (YYYY-MM-DD) | Yes | — | End of date range |
| `type` | string | No | all | Filter: `Company`, `Group` |
| `associable_id` | integer | No | all | Specific company or group ID |
| `page` | integer | No | 1 | Page number |
| `per_page` | integer | No | 500 | Results per page (max 1000) |

**Response:**

```json
{
  "success": true,
  "page": 1,
  "per_page": 500,
  "total_count": 3400,
  "total_pages": 7,
  "history": [
    {
      "date": "2024-06-15",
      "associable_type": "Company",
      "associable_id": 14,
      "associable_name": "Mapunity",
      "riders": 45,
      "rides": 890,
      "distance_km": 8900.5,
      "co2_credits": 2225.12,
      "rank": 3
    },
    {
      "date": "2024-06-15",
      "associable_type": "Group",
      "associable_id": 1,
      "associable_name": "Robert Bosch",
      "riders": 120,
      "rides": 2400,
      "distance_km": 24000.0,
      "co2_credits": 6000.0,
      "rank": 1
    }
  ]
}
```

**Implementation notes:**
- `History.where(date: range)` with optional type and associable_id filters
- History is polymorphic: `associable_type` is `Company` or `Group`, `associable_id` is the entity ID
- Need to resolve `associable_name` via the polymorphic association
- `History` columns: `date`, `associable_type`, `associable_id`, `distance`, `riders`, `rides`, `co2_credits`, `rank`
- History records are created by `Company.update_ranks(date)` — appears to run daily

**Estimated effort:** Small — straightforward query with name resolution.

---

### EP-6: User Demographics (Anonymised)

**Purpose:** Aggregated, anonymised user demographic data for understanding who cycles, transport mode preferences, and gender breakdown — used for ESG Impact reports and policy recommendations.

**Why needed:** Individual user data must stay private. But aggregate stats (e.g., "In Bangalore, 60% of active cyclists are aged 26-35, 70% male, 40% used to drive") are essential for city government and corporate ESG reporting.

```
GET /api/v1/demographics
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `city_id` | integer | No | all | Filter by city |
| `company_id` | integer | No | all | Filter by organisation (group_id) |

**Response:**

```json
{
  "success": true,
  "scope": "city",
  "scope_id": 1,
  "total_users": 1200,
  "active_users": 450,
  "demographics": {
    "by_age": [
      { "range": "15 to 20", "count": 12 },
      { "range": "21 to 25", "count": 89 },
      { "range": "26 to 30", "count": 156 },
      { "range": "31 to 35", "count": 98 },
      { "range": "36 to 40", "count": 54 },
      { "range": "41 to 45", "count": 25 },
      { "range": "46 to 50", "count": 10 },
      { "range": "51 to 55", "count": 4 },
      { "range": "56 to 60", "count": 2 },
      { "range": "unknown", "count": 0 }
    ],
    "by_gender": [
      { "gender": "male", "count": 315 },
      { "gender": "female", "count": 126 },
      { "gender": "unknown", "count": 9 }
    ],
    "by_transport_mode": [
      { "mode": "Car", "count": 180 },
      { "mode": "Two Wheeler", "count": 120 },
      { "mode": "Public Transport", "count": 90 },
      { "mode": "Bicycle", "count": 45 },
      { "mode": "unknown", "count": 15 }
    ]
  }
}
```

**Implementation notes:**
- City filter: users via `UserCompany.joins(:company).where(companies: { city_id: })` where `active: true`
- Organisation filter: users via `LeaderBoard.where(group_id:)` → company_ids → `UserCompany.where(company_id:)`
- `age` is an enum on User with values from `User::AGE_RANGE` — group and count
- `gender` is a string field — group and count
- `ref_transport_mode_id` links to `RefTransportMode` table — resolve to mode names
- `active_users` = users with at least 1 activity in the past 90 days
- Privacy constraint: only return aggregates, never individual user data. Minimum 5 users per bucket before returning (suppress small counts).

**Database fields used:**
- `users.age` (enum), `users.gender` (string), `users.ref_transport_mode_id` (FK)
- `user_companies.company_id`, `user_companies.active`
- `companies.city_id`

**Estimated effort:** Medium — requires careful aggregation and privacy constraints.

---

### EP-7: Transit Network

**Purpose:** Fetch transit entities (agencies) and their stops with location data for transit corridor analysis.

**Why needed:** altmo-extended needs the transit network topology (which stops belong to which agencies, where they are, what lines they serve) for multi-modal routing and first/last mile analysis.

```
GET /api/v1/transit_network
```

**Parameters:**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `city_id` | integer | No | all | Filter by city |

**Response:**

```json
{
  "success": true,
  "transit_entities": [
    {
      "id": 1,
      "agency_id": "BMRCL",
      "agency_name": "Bangalore Metro Rail Corporation",
      "city_id": 1,
      "stops": [
        {
          "id": 8,
          "stop_id": 8,
          "name": "Majestic",
          "status": "Active",
          "lat": 12.9767,
          "lon": 77.5713,
          "line_color": "#800080,#00FF00",
          "riders": 45,
          "rides": 890,
          "distance_km": 4500.0,
          "co2": 1125.0,
          "has_polygon": true,
          "polygon": [[12.976, 77.570], [12.977, 77.572], ...]
        }
      ]
    }
  ]
}
```

**Implementation notes:**
- `TransitEntity.includes(transit_points: :geo_markers)` with optional city filter
- Transit point location from associated `GeoMarker` (first point marker for lat/lon, polygon markers for boundary)
- `line_color` is comma-separated string on `TransitPoint`
- Stats (riders, rides, distance, co2) directly on `TransitPoint`
- `TransitEntity` columns: `agency_id`, `agency_name`, city/state info
- `TransitPoint` columns: `transit_entity_id`, `name`, `status`, `riders`, `rides`, `distance`, `co2`, `pending_rides`, `line_color`, `stop_id`

**Estimated effort:** Small — straightforward nested includes.

---

## Implementation Guide

### Controller Pattern

All existing API controllers follow this pattern:

```ruby
class Api::V1::BaseController < ApplicationController
  respond_to :json

  def some_endpoint
    # Optional: log the API access
    log = ApiLog.create(ip_address: request.ip, request_url: request.url, start_time: DateTime.now)

    # Query data
    results = SomeModel.where(...)

    # Render JSON (inline hash building, no serializers)
    render json: { success: true, code: 200, results: results_hash }

    # Optional: update log
    log.update(end_time: DateTime.now)
  end
end
```

**Key observations:**
- No serializers (no ActiveModel::Serializers, no JBuilder views) — all JSON is built inline
- No pagination on any existing endpoint
- Error responses use helper methods from `ApplicationController`: `missing_header`, `not_authorized`, `missing_params`, `company_not_found`
- `ApiLog` used on some endpoints but not all
- No CORS headers (would need adding if called from browser)

### Adding Pagination

Since no existing endpoints paginate, add a shared concern:

```ruby
# app/controllers/concerns/paginatable.rb
module Paginatable
  extend ActiveSupport::Concern

  def paginate(scope, per_page_default: 500, per_page_max: 1000)
    page = [params[:page].to_i, 1].max
    per_page = [[params[:per_page].to_i, per_page_default].max, per_page_max].min
    total = scope.count
    records = scope.offset((page - 1) * per_page).limit(per_page)

    {
      page: page,
      per_page: per_page,
      total_count: total,
      total_pages: (total.to_f / per_page).ceil,
      records: records
    }
  end
end
```

### Authentication

Most existing endpoints have **no authentication**. The only authenticated endpoint is `GET /api/v1/activities/company/:id` which uses `ApiUser.token` in the `Authorization` header, restricted to ambassadors.

**Recommendation for new endpoints:** Keep them unauthenticated (consistent with existing pattern) but add a simple API key check that altmo-extended's ETL will include. This prevents abuse without adding complexity:

```ruby
before_action :check_api_key, only: [:bulk_routes, :transit_activities, ...]

def check_api_key
  unless request.headers['X-API-Key'] == ENV['ALTMO_EXTENDED_API_KEY']
    render json: { success: false, code: 401, message: "invalid API key" }
  end
end
```

### Route Registration

Add to `config/routes.rb` inside the existing `namespace :api do / namespace :v1 do` block:

```ruby
namespace :api do
  namespace :v1 do
    # ... existing routes ...

    # New endpoints for altmo-extended
    get "/routes/bulk" => "routes#bulk"
    get "/transit_activities" => "transit#index"
    get "/geo_markers" => "geo_markers#index"
    get "/challenges/summary" => "challenges#summary"
    get "/history" => "history#index"
    get "/demographics" => "demographics#index"
    get "/transit_network" => "transit_network#index"
  end
end
```

---

## Priority Order

| Priority | Endpoint | Why First |
|---|---|---|
| **P0** | EP-1: Bulk Activity Routes | Core data for heatmaps, demand mapping, and cyclability scoring. Highest intelligence value. |
| **P0** | EP-3: GeoMarker Boundaries | Needed for spatial analysis — understanding where facilities and transit stops are and their coverage areas. |
| **P1** | EP-2: Transit Activities | Multi-modal analysis. Cycling + transit together is the core story. |
| **P1** | EP-5: Historical Leaderboard | Trend analysis for Pulse dashboard. |
| **P1** | EP-7: Transit Network | Transit corridor mapping for first/last mile analysis. |
| **P2** | EP-4: Challenge Summary | Engagement analytics for ESG reporting. |
| **P2** | EP-6: User Demographics | ESG Impact reports, city government presentations. |

---

## Data Volume Estimates

These estimates inform pagination defaults and ETL scheduling:

| Table | Estimated Rows | Growth Rate | Notes |
|---|---|---|---|
| activities | ~50K-100K | ~500-1000/week | Commute rides |
| activity_routes | Same as activities | Same | 1:1 with activities |
| other_activities | ~20K-50K | ~200-500/week | Leisure rides |
| transit_activities | ~5K-10K | ~100-200/week | Public transport |
| geo_markers | ~500-1000 | ~5-10/week | Company + transit locations |
| challenges | ~20-50 | ~2-3/month | Challenge definitions |
| challenge_users | ~5K-10K | Seasonal | Challenge participants |
| history | ~10K-50K | Daily snapshots | Historical leaderboard |

*Note: These are estimates based on the codebase patterns. Actual counts require a database query.*

---

## Summary of Existing Code References

| What | File | Key Details |
|---|---|---|
| Existing API routes | `config/routes.rb:217-240` | All under `namespace :api / :v1` |
| Base API controller | `app/controllers/api/v1/base_controller.rb` | `routes`, `facilities`, `companies`, `leaderboard` |
| Activities controller | `app/controllers/api/v1/activities_controller.rb` | `map`, `company` (auth'd) |
| Stats controller | `app/controllers/api/v1/stats_controller.rb` | `global_stats`, `daily_stats` |
| ActivityRoute model | `app/models/activity_route.rb` | `serialize :path, Array` — decoded polyline |
| Activity model | `app/models/activity.rb` | `update_route` decodes Strava polyline → stores in ActivityRoute |
| GeoMarker model | `app/models/geo_marker.rb` | Polymorphic, PostGIS scopes, `serialize :latlngs, Array` |
| TransitActivity model | `app/models/transit_activity.rb` | `belongs_to :transit_point`, status enum |
| Challenge model | `app/models/challenge.rb` | Scope enum, eligibility logic |
| ChallengeUser model | `app/models/challenge_user.rb` | Participation stats |
| History model | `app/models/history.rb` | Polymorphic (Company/Group), daily snapshots |
| User model | `app/models/user.rb` | `AGE_RANGE` enum, gender, `ref_transport_mode_id` |
| ApplicationController | `app/controllers/application_controller.rb` | Error helpers, no global auth on API |
| ApiUser model | `app/models/api_user.rb` | Token-based auth for ambassador endpoints |
