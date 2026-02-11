# AltMo Intelligence Platform: Opportunity Plan

## Executive Summary

AltMo is a full-stack sustainable mobility platform by UrbanMorph, focused on bicycle-based commuting in Indian cities. It currently operates as a commute tracking app (altmo.app) with a corporate ESG dashboard, and a peer-to-peer bicycle rental marketplace (cbs). This document outlines the strategic opportunity to build a **data intelligence layer** on top of the existing operational platform, transforming AltMo from a bicycle rental/tracking tool into an **Urban Active Mobility Intelligence Company**.

---

## 1. Current Platform Overview

### 1.1 AltMo Commute (altmo.app — Live Platform)

| Metric | Value |
|---|---|
| Users | 9,233 |
| Cities | 117 |
| Companies | 905 |
| Activities tracked | 2.1M+ |
| CO2 offset | 510,400 kg |
| Fuel saved | 220,499 litres |
| Employee money saved | INR 2,44,75,389 |

**Core features:**
- Mobile app for recording cycling/walking commutes
- Auto commute detection (smart algorithms)
- Optional Strava integration
- CO2 offset, fuel savings, money saved calculations
- Multi-level challenges (Global, State, City, Company)
- Leaderboards with country/city/company rankings

### 1.2 AltMo Org (Corporate Dashboard)

**Pricing tiers (billed annually):**

| Tier | Price/mo + GST | Users | Challenges/yr | Admin seats |
|---|---|---|---|---|
| Starter | INR 7,999 | 200 | 4 | 2 |
| Professional | INR 12,999 | 500 | 8 | 4 |
| Enterprise | INR 14,999 | 1,000 | 12 | 8 |

**Features:**
- Active mobility dashboard with real-time commute insights
- Challenge creation, management, and analytics
- Facility-based filtering and sorting
- Verified commute activities using smart algorithms
- Environmental impact reporting (CO2, fuel, money)

### 1.3 AltMo Bike / CBS (Bicycle Rental Marketplace)

A peer-to-peer bicycle rental platform with:
- Owner/renter dual-role system
- Trust score system (0-100) with direct scores (0-70) and network/referral scores (0-30)
- Owner analytics dashboard (revenue, utilization, maintenance costs, profit margins)
- Payment system (UPI manual verification, Razorpay planned)
- Checkout/checkin checklists with condition tracking and photos
- Referral system with cascading network bonuses
- Availability scheduling (weekly hours, date exceptions)
- Maintenance logging with volunteer assignment
- Owner offers and discount system

### 1.4 Broader Ecosystem (altmo-static)

| Module | Product | Description |
|---|---|---|
| Learn | AltMo Ride School / PedalShaale | Bicycle training (15+ locations in Bengaluru) |
| Use | Maps & Utilities | Navigation and rider support tools |
| Share | AltMo Bike | P2P bicycle rental marketplace |
| Measure | AltMo Org | Corporate ESG tracking and reporting |
| Commute | AltMo Commute | Individual carbon footprint tracking |
| Maintain | AltMo Help | Maintenance through affiliated partners |

### 1.5 Published Product Roadmap

- **Rate Your Streets** — Crowdsourced road safety mapping (pothole, dangerous intersection, blocked bike lane reporting)
- **Discussion Forum** — Community space for commuter cyclists

---

## 2. Data Assets Inventory

### 2.1 From altmo.app (Commute Tracking)

| Data Asset | Volume | Intelligence Value |
|---|---|---|
| GPS route traces | 2.1M+ activities, 20.6L+ km | Origin-destination patterns, preferred corridors, route choices |
| Commute timestamps | Every tracked activity | Peak hours, seasonal variation, weather-response behavior |
| User locations | 9,233 users, 117 cities | Demand density mapping, underserved areas |
| Company affiliations | 905 companies | Employer commute catchment areas, corporate campus hotspots |
| Challenge participation | Multi-level challenges | Behavioral response to incentives, engagement elasticity |
| Strava sync data | Integrated activities | Enriched route data with speed, elevation, heart rate |
| Auto-commute detection | Smart algorithm outputs | Work location inference, commute regularity patterns |
| CO2/fuel/money metrics | Aggregated per user/company/city | Impact quantification at any granularity |

### 2.2 From CBS (Bicycle Rental Platform)

| Data Asset | Intelligence Value |
|---|---|
| Owner locations (lat/long) | Supply distribution mapping |
| Bicycle utilization rates | Demand-supply gap identification |
| Rental pricing data (daily/weekly rates) | Market pricing intelligence |
| Trust scores + behavioral data | User reliability profiling |
| Maintenance logs | Infrastructure wear patterns, cost modelling |
| Checkout/checkin condition data | Asset degradation patterns |
| Rental queue depth | Unmet demand quantification |
| Payment transaction data | Revenue modelling, price elasticity |

### 2.3 From Broader Ecosystem

| Data Asset | Intelligence Value |
|---|---|
| PedalShaale training locations (15+ in Bengaluru) | New cyclist origin points, skill gaps |
| Maintenance partner network | Service infrastructure coverage |

### 2.4 Planned (Roadmap)

| Planned Feature | Intelligence Value |
|---|---|
| Rate Your Streets (crowdsourced) | Road safety scoring, infrastructure quality mapping |
| Discussion Forum | Qualitative sentiment data, emerging needs |

---

## 3. External Data Sources to Integrate

### Layer 1: Road and Infrastructure (Foundation)

| Source | Data | Usage | Access |
|---|---|---|---|
| OpenStreetMap | Road network, cycle lanes, surface quality, POIs | Base map for all routing and analysis | Free, open |
| Google Roads / Maps API | Real-time traffic, road geometry, place data | Traffic stress scoring for cyclists | Paid API |
| India National Urban Digital Mission | City master plans, road inventory | Planned vs actual infrastructure | Government open data |
| Smart Cities Mission open data | City-specific transport projects, sensor data | Infrastructure development tracking | data.gov.in |
| Municipal GIS portals | Road widths, land use zones, building footprints | Cyclability analysis per street segment | Varies by city |

### Layer 2: Environmental and Safety

| Source | Data | Usage | Access |
|---|---|---|---|
| CPCB / SAFAR | Air quality index by station, PM2.5/PM10 | Healthiest route recommendations | Free API |
| India Meteorological Department | Weather, rainfall, temperature, humidity | Predict cycling demand, seasonal planning | Free API |
| NCRB / State Police | Road accident data by location | Safety scoring, dangerous intersection mapping | RTI / open data |
| iRAD (Integrated Road Accident Database) | Geo-tagged accident data | High-risk corridor identification | Government |
| Noise pollution data | Decibel levels by area | Route pleasantness scoring | Research / sensors |

### Layer 3: Public Transit and Multimodal

| Source | Data | Usage | Access |
|---|---|---|---|
| GTFS feeds (BMTC, metro agencies) | Bus/metro routes, stops, schedules, frequencies | Bike-to-transit connectivity analysis | Transit agencies |
| DMRC / BMRCL / metro data | Metro station locations, ridership | First/last mile demand identification | Open / RTI |
| Auto-rickshaw / cab aggregator patterns | Short-trip origin-destinations | Trips replaceable by cycling | Partnership / research |

### Layer 4: Demographic and Socioeconomic

| Source | Data | Usage | Access |
|---|---|---|---|
| Census of India | Population density, age distribution, income levels by ward | Demand estimation, equity analysis | Free |
| NSSO surveys | Commute mode share, travel time, expenditure | Baseline modal split data | Free |
| Employment data (EPFO, tech park registries) | Job centre locations, employee concentrations | Corporate commute demand modelling | Varies |
| Real estate platforms | Residential density, property prices by locality | Residential-origin demand mapping | Partnership |

### Layer 5: Health and Wellness

| Source | Data | Usage | Access |
|---|---|---|---|
| ICMR / NCD data | Lifestyle disease prevalence by region | Health-case for cycling investment | Research |
| WHO physical activity guidelines | Recommended activity levels | Gap analysis: commute vs health targets | Public |
| Insurance claims data | Health outcomes correlated with active commute | ROI modelling for corporate wellness | Partnership |

---

## 4. Intelligence Products

### 4.1 AltMo CycleMap — Cycling Infrastructure Intelligence

A living, data-driven map that scores every road segment in a city for cyclability.

**Data pipeline:**
```
AltMo GPS traces (actual routes people ride)
  + OpenStreetMap (road network, lane data)
  + Accident data (safety scoring)
  + Air quality data (health scoring)
  + Traffic data (stress scoring)
  + Crowdsourced ratings (Rate Your Streets)
  = Per-segment Cyclability Index (0-100)
```

**Cyclability Index components:**
- Safety score (30%) — accident history, traffic volume, speed limits, separation from motor vehicles
- Infrastructure score (25%) — dedicated lanes, surface quality, lighting, signage
- Comfort score (20%) — shade, air quality, noise, gradient
- Connectivity score (15%) — links to transit, destinations, continuity of network
- Demand score (10%) — actual usage from AltMo GPS data

**Customers:**

| Customer | Value | Revenue Model |
|---|---|---|
| City governments | Prioritise cycling infrastructure investment with evidence | Annual licence (INR 10-50L/city) |
| Urban planning consultants | Data for transport master plans, DPRs | Per-project licence |
| Real estate developers | Cyclability score for marketing sustainable projects | Per-project fee |
| Navigation apps | Cycling-safe routing data | API licensing |

### 4.2 AltMo Pulse — Urban Commute Intelligence Dashboard

A city-level dashboard showing real-time and historical active mobility patterns.

**Dashboard modules:**

**A. Demand Heatmaps**
- Where people are cycling (origin-destination matrices)
- Time-of-day patterns (morning commute, evening, weekend)
- Seasonal variation overlaid with weather
- Growth trends by neighbourhood/ward

**B. Modal Shift Tracker**
- Estimated car-trips replaced by cycling
- CO2 reduction attribution by corridor
- Before/after analysis when infrastructure is built
- Comparison across wards/zones

**C. Infrastructure Gap Analysis**
- High-demand corridors with no cycling infrastructure
- "Build here next" priority ranking
- Cost-benefit projections per proposed corridor
- Equity analysis (underserved communities vs cycling access)

**D. First/Last Mile Connectivity**
- Metro/bus stations with high cycling catchment potential
- Bike parking demand forecasting at transit nodes
- Optimal bike-sharing dock placement recommendations

**Customers:**

| Customer | Value | Revenue Model |
|---|---|---|
| Smart City SPVs | Evidence-based transport planning | SaaS (INR 5-20L/year) |
| State transport departments | NMT policy inputs | Government contract |
| Multilateral agencies (World Bank, ADB, GIZ) | Impact monitoring for funded projects | Project-based |
| Research institutions | Urban mobility research data | Academic licence |

### 4.3 AltMo Impact — Corporate ESG Intelligence (Evolution of AltMo Org)

Upgrade the existing corporate dashboard from activity tracking into auditable ESG reporting.

**Upgrades over current AltMo Org:**

| Current | Upgraded |
|---|---|
| CO2 offset (simple calculation) | GHG Protocol Scope 3 Category 7 compliant reporting |
| Basic leaderboard | Facility-wise, department-wise, role-wise breakdowns |
| Challenge management | Behavioural nudge engine with ML-optimised timing |
| Static dashboard | Predictive analytics (forecast next quarter's impact) |
| No benchmarking | Industry benchmarking ("you vs IT sector average") |
| No integration | API to feed into Salesforce, SAP, Workday ESG modules |

**New revenue streams:**

| Feature | Revenue Model |
|---|---|
| Verified carbon credits (Gold Standard / Verra methodology) | Revenue share on credit sales |
| ESG audit-ready report generation | Premium tier (INR 25K+/mo) |
| Behavioural nudge engine (ML-driven) | Add-on to existing plans |
| API integrations (SAP, Workday, etc.) | Enterprise tier pricing |
| Industry benchmarking reports | Quarterly report product |

### 4.4 AltMo Routes — Intelligent Cycling Navigation

A routing engine that recommends the safest, healthiest, most pleasant cycling routes.

**Route optimisation criteria (user-selectable weights):**
- Fastest vs Safest vs Healthiest vs Most scenic
- Avoid: heavy traffic, poor air quality, unpaved roads, steep hills
- Prefer: dedicated lanes, shaded roads, low-traffic streets
- Multimodal: bike to metro to bike options

**Users:**

| User | Value |
|---|---|
| Individual commuters | Confidence to ride in Indian cities |
| New cyclists (post-PedalShaale) | Graduated difficulty routes |
| Corporate programmes | Recommended routes for employees |
| Tourism | Curated city cycling experiences |

**Revenue:** Freemium (basic routing free, premium criteria for subscribers) + B2B API licensing to navigation platforms.

### 4.5 AltMo Forecast — Demand Prediction Engine

ML-powered predictions of cycling demand by location, time, and conditions.

**Predictions generated:**
- Expected cycling volume per corridor per hour (next 7 days)
- Optimal bike-sharing rebalancing recommendations
- Challenge timing optimisation (when will engagement be highest?)
- Infrastructure ROI forecasting (if lane X is built, predicted usage increase)
- Rental demand forecasting for cbs platform (fleet sizing)

**Customers:**

| Customer | Value | Revenue Model |
|---|---|---|
| Bike-sharing operators (Yulu, Bounce, city PBS) | Fleet rebalancing, dock placement | SaaS / API |
| City traffic management | Cycling volume forecasting for signal planning | Government contract |
| AltMo internal | Optimise challenge timing, rental fleet sizing | Internal use |

---

## 5. Opportunity by User Segment

### 5.1 Individuals

**Current state:** Training, commute tracking, rental access, maintenance services.

**Gaps and opportunities:**

1. **Route planning and safety scoring** — Build cycling-safe route planning using road quality data, traffic density, cycling infrastructure, shade coverage, and air quality.
2. **Multi-modal journey planner** — Combine cycling with public transit for complete journey planning (bike to metro station, metro, bike from station).
3. **Health and fitness integration** — Track calories burned, distance, fitness progress. Integrate with Apple Health / Google Fit.
4. **Personal carbon dashboard** — Cumulative CO2 saved vs car/auto-rickshaw, translated into tangible equivalents. Shareable social cards.
5. **Community features** — Group rides, cycling clubs, neighbourhood cycling networks, safety buddy matching.
6. **Insurance and safety** — Cycling accident insurance, emergency SOS, live location sharing with emergency contacts.
7. **E-bike / electric scooter expansion** — Extend the rental marketplace to electric micro-mobility vehicles.
8. **Reward marketplace** — Turn trust score into a currency: discounts at partner stores, free maintenance, carbon credits.

### 5.2 Businesses / Corporates

**Current state:** ESG dashboard, commute challenges, employee tracking.

**Gaps and opportunities:**

1. **Employee commute benefit programme** — Structured tax-advantaged bicycle benefit (similar to UK Cycle to Work scheme). Help companies offer bicycle purchase/rental as an employee perk.
2. **Fleet management for delivery/logistics** — Extend bicycle management to companies running last-mile delivery fleets (e-commerce, food delivery, pharmacy).
3. **Carbon credit generation and trading** — Build auditable carbon credits from measured employee cycling commutes, tradeable on voluntary carbon markets.
4. **Campus/facility micro-mobility** — White-labelled bike-sharing systems for tech parks, university campuses, industrial zones, SEZs.
5. **Real estate developer integration** — Partner with builders marketing sustainable living communities to provide built-in cycling infrastructure + AltMo platform access.
6. **HR and wellness platform integration** — API integrations with existing HR platforms (Darwinbox, Keka, greytHR).
7. **Supply chain sustainability reporting** — Track sustainable logistics practices for companies using bicycle-based last-mile delivery.

### 5.3 Government

**Current state:** No government-facing features exist.

**Gaps and opportunities:**

1. **Cycling infrastructure planning tool** — Aggregated (anonymised) ride data showing where people actually cycle vs where infrastructure exists. Heat maps of cycling demand, dangerous intersections, missing connectivity.
2. **Public bike-sharing system (PBS) management** — AltMo's rental management + maintenance tracking + analytics could power or augment government-operated PBS systems.
3. **Smart city integration** — Feed cycling data into city dashboards, traffic management systems, and air quality monitoring. Align with India's Smart Cities Mission.
4. **Policy impact measurement** — When a city builds a cycling lane, measure before/after impact on cycling adoption, modal shift, emissions reduction.
5. **Citizen engagement platform** — Let citizens report road hazards, request cycling infrastructure, vote on proposed cycling routes.
6. **School safety zones** — Map cycling routes to schools, identify danger zones, recommend safe-route-to-school programmes.
7. **Tourism** — Government tourism boards promoting cycling tourism (heritage rides, nature trails) using the platform for route discovery and bicycle rental.

### 5.4 Additional User Categories

**Educational Institutions (Schools, Colleges, Universities)**
- Campus bike-sharing programmes
- Student commute tracking for sustainability certifications
- Cycling proficiency programmes integrated with physical education
- Safe route mapping for school zones

**Healthcare / Hospitals**
- Prescription cycling — Doctors recommending cycling for patients with lifestyle diseases (diabetes, obesity, cardiovascular). Track adherence and health outcomes.
- Hospital campus mobility
- Staff commute wellness programmes

**Gig Workers / Delivery Partners**
- Affordable bicycle/e-bike rental for gig economy workers (Swiggy, Zomato, Dunzo riders)
- Trust score system for reliable renter identification
- Maintenance services to reduce downtime
- Financial inclusion through micro-leasing (rent-to-own)

**Tourism and Hospitality**
- Hotels/resorts offering bicycle rentals to guests
- Curated cycling tours with route guidance
- Heritage city cycling experiences (Mysuru, Hampi, Puducherry)
- Integration with tourism platforms

**NGOs and Development Organisations**
- Tracking mobility access improvements in underserved communities
- Programmes providing bicycles to women/girls for school/work access
- Impact measurement for donor reporting
- Rural connectivity solutions

**Insurance Companies**
- Usage-based cycling insurance products
- Risk scoring using AltMo trust and behaviour data
- Claims management integration for cycling accidents

**Real Estate and Residential Communities**
- Gated community bike-sharing
- Township mobility solutions
- Builder sustainability certifications (IGBC, LEED) with verifiable cycling data

---

## 6. Implementation Roadmap

### Phase 1 — Foundation (Months 1-3)

**Goal:** Spatial data infrastructure + first intelligence product

**Completed:**
- SvelteKit platform scaffolded with Tailwind CSS v4, unified Altmo design system
- Multi-page application structure: CycleMap, Pulse (5 sub-pages), Impact, Routes, Forecast
- Shared navigation with city selector, date range picker, external app links
- ETL layer: 4 Vercel Cron endpoints (sync-routes, sync-stats, sync-facilities, sync-external)
- MapLibre GL integration for CycleMap page
- Supabase client integration, Rails API client for ETL

**Remaining:**
- Set up PostGIS and pgRouting extensions on Supabase
- Implement H3 hex grid indexing for all GPS trace data
- Build anonymisation/aggregation pipeline
- Ingest OpenStreetMap road network for target cities
- Compute Cyclability Index v1 (safety + infrastructure + demand) for Bengaluru
- Connect CycleMap UI to live Supabase data
- Integrate weather and AQI APIs

**Deliverable:** Interactive cyclability map for Bengaluru, embeddable and shareable.

### Phase 2 — Corporate Upgrade (Months 3-6)

**Goal:** Transform AltMo Org into AltMo Impact

- Implement GHG Protocol Scope 3 Category 7 methodology
- Build facility-wise, department-wise breakdowns
- Add industry benchmarking (anonymised cross-company comparisons)
- Generate PDF/CSV audit-ready reports
- Build API endpoints for ESG platform integration
- Launch premium corporate tier

**Deliverable:** Audit-grade ESG commute reports. New enterprise pricing tier.

### Phase 3 — City Intelligence (Months 6-9)

**Goal:** Launch AltMo Pulse for government/planner customers

- Ingest GTFS transit data for Bengaluru (BMTC, Metro)
- Build origin-destination matrix analysis
- Compute infrastructure gap analysis (high demand, no infrastructure)
- Build first/last mile connectivity analysis
- Ship AltMo Pulse v1 dashboard
- Pilot with Bengaluru Smart City or DULT

**Deliverable:** City mobility dashboard with infrastructure gap analysis. First government pilot.

### Phase 4 — Routing Intelligence (Months 9-12)

**Goal:** Ship intelligent cycling navigation

- Build multi-criteria routing engine on CycleMap data
- Integrate real-time traffic, AQI, and weather
- Build route personalisation (user preference learning)
- Add multimodal routing (bike + transit)
- Ship AltMo Routes in mobile app
- Launch B2B routing API

**Deliverable:** Routing engine in app. API available for third-party integration.

### Phase 5 — Prediction and Scale (Months 12-18)

**Goal:** ML-powered demand prediction + multi-city expansion

- Train demand prediction model on 2.1M+ historical activities
- Integrate weather forecasting for predictive accuracy
- Build behavioural nudge engine for challenge optimisation
- Expand CycleMap and Pulse to top 5 AltMo cities
- Launch carbon credit generation pipeline (Verra/Gold Standard methodology)
- Open public API for researchers and developers

**Deliverable:** Prediction engine. Multi-city coverage. Carbon credit revenue stream.

---

## 7. Revenue Model

| Product | Customer | Pricing | Year 1 Target |
|---|---|---|---|
| AltMo Impact (ESG upgrade) | Corporates | INR 15-30K/mo | 20 companies = INR 36-72L |
| AltMo CycleMap | City govts, planners, developers | INR 10-50L/city/year | 2 cities = INR 20-100L |
| AltMo Pulse | Smart City SPVs, multilaterals | INR 5-20L/year | 1 pilot = INR 5-20L |
| AltMo Routes API | Navigation platforms, bike-share ops | Usage-based API pricing | Seed revenue |
| Carbon credits | Voluntary carbon market | Revenue share | Pipeline building |
| Research data licences | Universities, think tanks | INR 1-5L/year | 5 licences = INR 5-25L |

**Year 1 estimated new revenue: INR 66L - 2.2Cr** (on top of existing subscription revenue)

---

## 8. Strategic Summary

| Dimension | Current | Opportunity |
|---|---|---|
| Vehicles | Bicycles only | E-bikes, e-scooters, cargo bikes |
| Geography | Bengaluru-centric | Pan-India cities, then SEA |
| Revenue | SaaS subscriptions + rental commissions | Carbon credits, insurance, fleet management, government contracts |
| Data | Operational (rentals, payments) | Geospatial intelligence (routes, infrastructure gaps, demand patterns) |
| Users | Individuals + Corporates | + Government, Education, Healthcare, Gig economy, Tourism, NGOs |
| Platform | Standalone app | API platform with integrations (HR, fitness, transit, maps) |

### Competitive Moat

The intelligence layer creates three compounding moats:

1. **Data network effect** — More users generate better cyclability scores, which produce better routes, which attract more users. No competitor can replicate AltMo's 2.1M+ India-specific cycling activity dataset.
2. **Government relationships** — Once a city uses AltMo Pulse for infrastructure planning, switching costs are enormous. Planning cycles span 5-10 years.
3. **Cross-product reinforcement** — CycleMap data improves Routes. Routes increase app usage. Usage generates more data. Corporate challenges drive adoption. The rental platform adds supply-side data. Each product feeds the others.

### The Single Biggest Unlock

AltMo's most undervalued asset is its **aggregated mobility data**. Every ride, route, and rental generates geospatial intelligence about where people want to cycle, what infrastructure is missing, and what behaviour change looks like. This data is extraordinarily valuable to urban planners, real estate developers, infrastructure investors, and policymakers — and currently is not being captured or monetised.

Building a data intelligence layer on top of the existing operational platform transforms AltMo from a bicycle rental marketplace into an **urban mobility intelligence company**.
