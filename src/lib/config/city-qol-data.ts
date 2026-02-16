/**
 * City-level QoL indicator data and TQOLI scoring.
 *
 * Framework: Allirani & Verma (2025) "A novel transportation Quality of Life
 * Index framework for evaluating sustainable transport interventions", IISc Bangalore.
 *
 * Dimension weights from Fuzzy-AHP expert survey (40 Indian transport planners):
 *   Health 0.43, Accessibility 0.23, Environmental 0.18, Mobility 0.16
 *
 * Reference data sourced from:
 *   - CPCB National Ambient Air Quality Status reports (PM2.5)
 *   - NCRB "Accidental Deaths & Suicides in India" (traffic fatalities)
 *   - Census 2011 + city CMP/CTTS reports (mode share)
 *   - State transport corporation annual reports (bus fleet)
 *   - Metro rail corporation data (network length)
 *   - TomTom Traffic Index (congestion levels)
 *   - CPCB / OpenAQ (NO2 annual averages)
 *   - CPCB NANMN (noise pollution — National Ambient Noise Monitoring Network)
 *   - UrbanEmissions APnA (transport CO2 per capita)
 *   - PPAC district-level fuel sales (transport fuel consumption per capita)
 *   - ISFR / HUGSI / CSCAF (per-capita green cover)
 *   - City CMP/Smart City/DULT reports (footpath coverage, cycle infra)
 *   - TransitRouter + metro station data (PT accessibility estimates)
 */

import { CITY_OPENAQ_SENSORS, CITY_OPENAQ_NO2_SENSORS } from './air-quality';
import { getCityById } from './cities';
import { computeReadinessScore, getReadiness } from './data-readiness';

// ---- Types ----

export type EffectDirection = 'positive' | 'negative';

export interface QoLIndicatorDef {
	key: string;
	label: string;
	unit: string;
	effect: EffectDirection;
	source: string;
	description: string;
}

export interface IndicatorBenchmark {
	worstRef: number;
	target: number;
	source: string;
}

export const INDICATOR_BENCHMARKS: Record<string, IndicatorBenchmark> = {
	traffic_fatalities:     { worstRef: 20,  target: 2,   source: 'India avg (MoRTH) / Sweden Vision Zero' },
	vru_fatality_share:     { worstRef: 65,  target: 15,  source: 'Delhi-level VRU share / Vision Zero cities with protected infra' },
	walking_share:          { worstRef: 10,  target: 35,  source: 'Low-walk Indian city / Barcelona-class walkability' },
	cycling_share:          { worstRef: 1,   target: 25,  source: 'Negligible cycling / Amsterdam-class cycling city' },
	footpath_coverage:      { worstRef: 10,  target: 90,  source: 'Minimal footpaths / Dutch-Copenhagen class' },
	rail_transit_km:        { worstRef: 0,   target: 600, source: 'No rail transit / Mumbai class (metro + suburban combined)' },
	bus_fleet_per_lakh:     { worstRef: 5,   target: 60,  source: 'Below minimum / BMTC-class fleet' },
	transit_stop_density:   { worstRef: 3,   target: 30,  source: 'Sparse coverage / dense European city' },
	cycle_infra_km:         { worstRef: 0,   target: 500, source: 'No cycle infra / Amsterdam-class network' },
	pt_accessibility:       { worstRef: 20,  target: 95,  source: 'Sparse transit reach / near-universal coverage' },
	pm25_annual:            { worstRef: 100, target: 15,  source: 'Delhi-level / WHO 2021 guideline' },
	no2_annual:             { worstRef: 80,  target: 10,  source: 'Delhi peak / WHO 2021 guideline' },
	congestion_level:       { worstRef: 60,  target: 15,  source: 'Severe congestion / near free-flow' },
	noise_pollution:        { worstRef: 80,  target: 55,  source: 'Noisy Indian city / WHO 2018 guideline' },
	carbon_emission_intensity: { worstRef: 1.5, target: 0.3, source: 'Car-sprawl city / Copenhagen-class' },
	fuel_consumption:       { worstRef: 250, target: 50,  source: 'Car-dependent / high-PT European city' },
	green_cover:            { worstRef: 0.5, target: 20,  source: 'Dense built-up / European best practice' },
	sustainable_mode_share: { worstRef: 20,  target: 70,  source: 'Car-dependent / Dutch-class' },
	road_density:           { worstRef: 3,   target: 20,  source: 'Sparse / well-connected grid' }
};

export interface QoLDimension {
	key: string;
	label: string;
	weight: number;
	indicators: QoLIndicatorDef[];
}

export interface CityQoLValues {
	cityId: string;
	values: Record<string, number | null>;
}

export const GRADE_BOUNDARIES = [
	{ grade: 'A', min: 0.75, label: 'International best practice' },
	{ grade: 'B', min: 0.60, label: 'Meets national targets' },
	{ grade: 'C', min: 0.45, label: 'Indian average' },
	{ grade: 'D', min: 0.30, label: 'Below average' },
	{ grade: 'E', min: 0,    label: 'Crisis level' }
];

export type ConfidenceTier = 'gold' | 'silver' | 'bronze';

/**
 * Based on the Allirani & Verma (2025) paper which defines 18 indicators
 * across 4 dimensions. Our framework adapts these into policy-measurable
 * proxies (e.g. PA → walking_share + cycling_share, TRNC → rail_transit_km
 * + transit_stop_density + pt_accessibility) and adds 3 Altmo enhancements:
 *
 *   - vru_fatality_share (Health) — pedestrian + cyclist deaths as % of traffic fatalities
 *   - no2_annual (Environmental) — NO2 annual average from CPCB/OpenAQ
 *   - green_cover (Environmental) — per-capita green cover from ISFR/HUGSI/CSCAF
 *
 * Total: 19 indicators (paper-adapted base + 3 Altmo enhancements).
 */
export const TQOLI_FULL_INDICATOR_COUNT = 19;

export interface ConfidenceBreakdown {
	tier: ConfidenceTier;
	score: number; // 0-100
	factors: {
		indicatorCoverage: number;   // 0-100
		liveDataFreshness: number;   // 0-100
		sensorCoverage: number;      // 0-100
		transitDataQuality: number;  // 0-100
		dataReadiness: number;       // 0-100
		altmoTraces: number;         // 0-100
	};
}

export interface DimensionScore {
	key: string;
	label: string;
	weight: number;
	score: number; // 0-1 normalized
	weighted: number; // score * weight
	availableCount: number; // how many indicators have data
	totalCount: number; // how many indicators defined
	indicators: {
		key: string;
		label: string;
		unit: string;
		value: number | null;
		normalized: number | null; // 0-1
	}[];
}

export interface CityQoLScore {
	cityId: string;
	composite: number; // 0-1
	grade: string; // A-E
	dimensions: DimensionScore[];
	confidence: ConfidenceTier;
	confidenceBreakdown: ConfidenceBreakdown;
	indicatorsAvailable: number;
	indicatorsTotal: number;
}

// ---- Framework definition ----

export const QOL_DIMENSIONS: QoLDimension[] = [
	{
		key: 'health',
		label: 'Health',
		weight: 0.43,
		indicators: [
			{
				key: 'traffic_fatalities',
				label: 'Traffic Fatalities',
				unit: 'per lakh pop.',
				effect: 'negative',
				source: 'NCRB 2022',
				description: 'Road traffic deaths per lakh population'
			},
			{
				key: 'walking_share',
				label: 'Walking',
				unit: '% trips',
				effect: 'positive',
				source: 'Census/CMP',
				description: 'Share of trips by walking'
			},
			{
				key: 'cycling_share',
				label: 'Cycling',
				unit: '% trips',
				effect: 'positive',
				source: 'Census/CMP',
				description: 'Share of trips by cycling'
			},
			{
				key: 'vru_fatality_share',
				label: 'VRU Fatality Share',
				unit: '%',
				effect: 'negative',
				source: 'NCRB 2022',
				description: 'Pedestrian + cyclist deaths as % of total traffic fatalities'
			},
			{
				key: 'footpath_coverage',
				label: 'Footpath Coverage',
				unit: '% roads',
				effect: 'positive',
				source: 'CMP/DULT audits',
				description: 'Percentage of roads with paved footpaths'
			}
		]
	},
	{
		key: 'accessibility',
		label: 'Accessibility',
		weight: 0.23,
		indicators: [
			{
				key: 'rail_transit_km',
				label: 'Rail Transit',
				unit: 'km',
				effect: 'positive',
				source: 'Metro corps / Indian Railways',
				description: 'Operational metro + suburban/commuter rail network length'
			},
			{
				key: 'bus_fleet_per_lakh',
				label: 'Bus Fleet',
				unit: 'per lakh pop.',
				effect: 'positive',
				source: 'Transport corps',
				description: 'Public bus fleet size per lakh population'
			},
			{
				key: 'transit_stop_density',
				label: 'Transit Stop Density',
				unit: 'stops/km\u00B2',
				effect: 'positive',
				source: 'TransitRouter/Metro corps',
				description: 'Bus stops + metro stations per sq km of city area'
			},
			{
				key: 'cycle_infra_km',
				label: 'Cycle Infrastructure',
				unit: 'km',
				effect: 'positive',
				source: 'City CDP/CMP/OSM',
				description: 'Dedicated cycle lane/track length'
			},
			{
				key: 'pt_accessibility',
				label: 'PT Accessibility',
				unit: '% area',
				effect: 'positive',
				source: 'TransitRouter/Metro corps',
				description: 'City area within 500m of a bus stop or metro station'
			}
		]
	},
	{
		key: 'environmental',
		label: 'Environmental',
		weight: 0.18,
		indicators: [
			{
				key: 'pm25_annual',
				label: 'PM₂.₅',
				unit: 'µg/m³',
				effect: 'negative',
				source: 'CPCB 2023',
				description: 'Annual average fine particulate matter concentration'
			},
			{
				key: 'no2_annual',
				label: 'NO\u2082',
				unit: '\u00B5g/m\u00B3',
				effect: 'negative',
				source: 'CPCB/OpenAQ',
				description: 'Annual average nitrogen dioxide concentration'
			},
			{
				key: 'congestion_level',
				label: 'Congestion',
				unit: '% extra time',
				effect: 'negative',
				source: 'TomTom 2023',
				description: 'Average extra travel time due to congestion'
			},
			{
				key: 'noise_pollution',
				label: 'Noise',
				unit: 'dB(A)',
				effect: 'negative',
				source: 'CPCB NANMN',
				description: 'Average daytime transport noise level'
			},
			{
				key: 'carbon_emission_intensity',
				label: 'CO\u2082 Emissions',
				unit: 't CO\u2082/cap/yr',
				effect: 'negative',
				source: 'UrbanEmissions APnA',
				description: 'Transport carbon dioxide emissions per capita per year'
			},
			{
				key: 'fuel_consumption',
				label: 'Fuel Consumption',
				unit: 'L petrol-eq/cap/yr',
				effect: 'negative',
				source: 'PPAC',
				description: 'Transport fuel consumption per capita in petrol-equivalent litres'
			},
			{
				key: 'green_cover',
				label: 'Green Cover',
				unit: 'm\u00B2/person',
				effect: 'positive',
				source: 'ISFR/HUGSI/CSCAF',
				description: 'Per-capita urban green cover area'
			}
		]
	},
	{
		key: 'mobility',
		label: 'Mobility',
		weight: 0.16,
		indicators: [
			{
				key: 'sustainable_mode_share',
				label: 'Sustainable Modes',
				unit: '% trips',
				effect: 'positive',
				source: 'Census/CMP',
				description: 'Share of trips by walk, cycle, bus, and metro'
			},
			{
				key: 'road_density',
				label: 'Road Density',
				unit: 'km/km²',
				effect: 'positive',
				source: 'Smart Cities',
				description: 'Road network coverage per unit area'
			}
		]
	}
];

// ---- Per-city reference data ----

export const CITY_QOL_DATA: CityQoLValues[] = [
	{
		cityId: 'ahmedabad',
		values: {
			// Health
			traffic_fatalities: 7.6, // NCRB 2022: ~418 deaths, pop ~55 lakh (AMC area)
			vru_fatality_share: 44, // NCRB 2022: pedestrian + cyclist fatalities ~44%
			walking_share: 24, // Census/CEPT CTTS 2019
			cycling_share: 8, // Census/CEPT — moderate NMT culture
			footpath_coverage: 25, // AMC Smart City report / CEPT walkability audit
			// Accessibility
			rail_transit_km: 40, // Ahmedabad Metro Phase 1 (Blue + Red lines)
			bus_fleet_per_lakh: 23, // AMTS ~1,200 + Janmarg BRT ~200; pop ~55 lakh
			transit_stop_density: 9.8, // (3000 bus + 32 metro + BRT) / 464 km² (AMC area)
			cycle_infra_km: 29, // OSM 2026: BRTS-adjacent corridors + Sabarmati Riverfront path
			pt_accessibility: 60, // BRT spine gives good corridor coverage, gaps in eastern wards
			// Environmental
			pm25_annual: 55, // CPCB/GPCB 2023 — industrial + vehicular
			no2_annual: 35, // CPCB 2023 — moderate
			congestion_level: 49, // TomTom 2023
			noise_pollution: 72, // GPCB campaign data — industrial zones push avg up
			carbon_emission_intensity: 0.8, // UrbanEmissions APnA — moderate, BRT helps
			fuel_consumption: 150, // PPAC Gujarat + CEPT — moderate car ownership
			green_cover: 7.5, // HUGSI 2024 (18% green / 6.5M pop) — BRT corridor greenery
			// Mobility
			sustainable_mode_share: 43, // CEPT CTTS: walk 24% + cycle 8% + bus ~8% + metro ~3%
			road_density: 5.5 // ~2,550 km roads / 464 km² (AMC area)
		}
	},
	{
		cityId: 'bengaluru',
		values: {
			// Health
			traffic_fatalities: 7.8, // NCRB 2022: ~960 deaths, pop ~1.23 cr
			walking_share: 22, // CMP 2020
			cycling_share: 5, // CMP 2020
			vru_fatality_share: 40, // NCRB 2022: (310+75)/960 = 40%
			footpath_coverage: 37, // CMP 2020 / DULT audit
			// Accessibility
			rail_transit_km: 73.8, // Namma Metro Phase 1 + 2A (as of 2024)
			bus_fleet_per_lakh: 53, // BMTC ~6,500 buses, pop ~1.23 cr
			transit_stop_density: 11.2, // (8500 bus + 62 metro) / 764 km²
			cycle_infra_km: 30, // OSM 2026: TenderSURE + ORR pop-up lanes (Cycles4Change) + cycle tracks
			pt_accessibility: 65, // 8,562 stops / 764 km² — gaps in periphery
			// Environmental
			pm25_annual: 34, // CPCB 2023 annual average
			no2_annual: 30, // CPCB 2023 annual average
			congestion_level: 51, // TomTom 2023
			noise_pollution: 68, // CPCB NANMN — 10 stations continuous
			carbon_emission_intensity: 0.9, // UrbanEmissions APnA + CMP 2020 — high IT-sector car use
			fuel_consumption: 180, // PPAC Karnataka — high IT-sector car use
			green_cover: 2.2, // CSCAF research — Garden City declining rapidly
			// Mobility
			sustainable_mode_share: 48, // CMP 2020: walk+cycle+bus+metro
			road_density: 10.2 // ~7,800 km roads / 764 km² (BBMP area)
		}
	},
	{
		cityId: 'chennai',
		values: {
			traffic_fatalities: 10.5, // NCRB 2022
			walking_share: 24, // Census/CTTS
			cycling_share: 4, // Census/CTTS
			vru_fatality_share: 43, // NCRB 2022: (345+55)/920 = 43%
			footpath_coverage: 45, // CTTS 2018
			rail_transit_km: 584, // Metro 54.6 + Southern Railway suburban ~510 + MRTS 19.3
			bus_fleet_per_lakh: 40, // MTC ~3,500 buses, pop ~87 lakh
			transit_stop_density: 30.6, // (5200 bus + 40 metro + 148 suburban/MRTS) / 176 km²
			cycle_infra_km: 20, // OSM 2026: Smart City corridors + scattered cycle tracks
			pt_accessibility: 87, // 5,388 stops / 176 km² — suburban rail adds peripheral coverage
			pm25_annual: 31, // CPCB 2023
			no2_annual: 25, // CPCB 2023 annual average
			congestion_level: 39, // TomTom 2023
			noise_pollution: 65, // CPCB NANMN — 10 stations continuous
			carbon_emission_intensity: 0.7, // UrbanEmissions APnA — strong suburban rail reduces this
			fuel_consumption: 130, // PPAC Tamil Nadu — strong PT share
			green_cover: 0.8, // CSCAF/EoLI — very low, dense built-up
			sustainable_mode_share: 52, // CTTS: walk+cycle+bus+metro
			road_density: 12.5 // ~2,200 km roads / 176 km² (Chennai Corp)
		}
	},
	{
		cityId: 'delhi',
		values: {
			traffic_fatalities: 11.3, // NCRB 2022: highest absolute numbers
			walking_share: 16, // Census
			cycling_share: 6, // Census
			vru_fatality_share: 62, // NCRB 2022: (750+280)/1670 = 62% — worst
			footpath_coverage: 25, // DIMTS pedestrian audit
			rail_transit_km: 448, // DMRC 393 + RRTS/Namo Bharat 55 (operational)
			bus_fleet_per_lakh: 32, // DTC ~3,700 + cluster ~3,500; pop ~2.1 cr
			transit_stop_density: 4.8, // (6800 bus + 288 metro + 14 RRTS) / 1483 km²
			cycle_infra_km: 101, // OSM 2026: UTTIPEC road redesigns + DDA tracks + NDMC cycle tracks
			pt_accessibility: 56, // 7,102 stops / 1,483 km² — RRTS adds outskirt coverage
			pm25_annual: 99, // CPCB 2023 — worst in India
			no2_annual: 60, // CPCB 2023 — worst in India
			congestion_level: 44, // TomTom 2023
			noise_pollution: 75, // CPCB NANMN — highest, traffic + construction
			carbon_emission_intensity: 1.2, // UrbanEmissions APnA + IITK study — sprawl + car dependence
			fuel_consumption: 200, // PPAC Delhi + DPDA — highest, sprawl
			green_cover: null, // ISFR 2023 reports 20 m²/person but inflated by Ridge Forest in NCT boundary — not representative
			sustainable_mode_share: 43, // Census/DMP: walk+cycle+bus+metro
			road_density: 18.0 // Dense road network, 1,483 km² NCT
		}
	},
	{
		cityId: 'hyderabad',
		values: {
			traffic_fatalities: 8.4, // NCRB 2022
			walking_share: 20, // Census/CMP
			cycling_share: 5, // Census/CMP
			vru_fatality_share: 39, // NCRB 2022: (260+65)/840 = 39%
			footpath_coverage: 30, // HMDA CMP
			rail_transit_km: 159, // HMR 69.2 + MMTS 90
			bus_fleet_per_lakh: 30, // TSRTC city services ~3,000, pop ~1 cr
			transit_stop_density: 7.1, // (4500 bus + 57 metro + 36 MMTS) / 650 km²
			cycle_infra_km: 31, // OSM 2026: 23 km solar-roof ORR track + ISB Gachibowli + HMDA paths
			pt_accessibility: 52, // 4,593 stops / 650 km² — MMTS adds peripheral coverage
			pm25_annual: 37, // CPCB 2023
			no2_annual: 28, // CPCB 2023 annual average
			congestion_level: 36, // TomTom 2023
			noise_pollution: 67, // CPCB NANMN — 10 stations continuous
			carbon_emission_intensity: 0.8, // UrbanEmissions APnA — moderate
			fuel_consumption: 160, // PPAC Telangana — moderate
			green_cover: 8.2, // Published research — improved with GHMC green drives
			sustainable_mode_share: 46, // CMP: walk+cycle+bus+metro
			road_density: 8.5 // GHMC area 650 km²
		}
	},
	{
		cityId: 'indore',
		values: {
			// Health
			traffic_fatalities: 18.3, // MoRTH 2022: 639 deaths, metro pop ~35 lakh
			walking_share: 22, // CMP/ICLEI
			cycling_share: 5, // CMP/ICLEI
			vru_fatality_share: 42, // NCRB 2022: (175+95)/640 = 42%
			footpath_coverage: 20, // Smart City CDP estimate
			// Accessibility
			rail_transit_km: 6, // Priority corridor opened June 2025 (6 km)
			bus_fleet_per_lakh: 11, // AICTSL ~387 buses, metro pop ~35 lakh
			transit_stop_density: 4.5, // (1200 bus + 0 metro) / 269 km²
			cycle_infra_km: 3, // OSM 2026: single mapped way — minimal cycling infra
			pt_accessibility: 35, // 1,200 stops / 269 km² — limited network
			// Environmental
			pm25_annual: 56, // UrbanEmissions model + IQAir estimates
			no2_annual: null, // No direct measurement — CPCB estimate only
			congestion_level: null, // No TomTom data available for Indore
			noise_pollution: null, // No data — estimate needed
			carbon_emission_intensity: 0.6, // UrbanEmissions estimate — lower, smaller city
			fuel_consumption: 100, // PPAC MP estimate — lower, less VKT
			green_cover: null, // No reliable data
			// Mobility
			sustainable_mode_share: 37, // CMP: walk 22% + cycle 5% + bus ~10%
			road_density: 8.8 // IMC area 269 km²
		}
	},
	{
		cityId: 'kochi',
		values: {
			traffic_fatalities: 9.2, // NCRB 2022 (Kerala state rate applied)
			walking_share: 22, // Census
			cycling_share: 5, // Census
			vru_fatality_share: 51, // NCRB 2022: (85+15)/195 = 51%
			footpath_coverage: 35, // Kerala urban walkability study
			rail_transit_km: 28.8, // KMRL extended to Thripunithura (2025)
			bus_fleet_per_lakh: 20, // KSRTC city ~400 + private; pop ~21 lakh
			transit_stop_density: 19.2, // (1800 bus + 22 metro) / 95 km²
			cycle_infra_km: 27, // OSM 2026: moderate mapped infra for compact city
			pt_accessibility: 70, // 1,822 stops / 95 km² — compact city
			pm25_annual: 27, // CPCB 2023 — cleanest of the 6
			no2_annual: 18, // CPCB 2023 — lowest
			congestion_level: 29, // TomTom 2023 — lowest
			noise_pollution: 62, // KSPCB campaign — lowest, compact city
			carbon_emission_intensity: 0.5, // UrbanEmissions estimate — compact, low VKT
			fuel_consumption: 90, // PPAC Kerala — compact, low VKT
			green_cover: null, // No reliable data
			sustainable_mode_share: 42, // CMP: walk+cycle+bus+metro
			road_density: 7.2 // Kochi Corp ~95 km²
		}
	},
	{
		cityId: 'kolkata',
		values: {
			// Health
			traffic_fatalities: 3.1, // NCRB 2022: ~185 deaths / 60 lakh KMC pop
			vru_fatality_share: 45, // NCRB 2022 WB state pattern
			walking_share: 39, // Census 2011 — highest among metros
			cycling_share: 10, // Census 2011 — despite 62-road ban
			footpath_coverage: 20, // 80% pavements encroached
			// Accessibility
			rail_transit_km: 423, // Metro 73 + suburban ~350 (KMA)
			bus_fleet_per_lakh: 22, // WBTC ~1,337 + private; pop ~60 lakh
			transit_stop_density: 12, // Dense bus+metro+suburban / 206 km²
			cycle_infra_km: 35, // New Town Rajarhat corridors
			pt_accessibility: 70, // Dense suburban rail + bus; compact city
			// Environmental
			pm25_annual: 60, // IQAir/CPCB 2023
			no2_annual: null, // No direct measurement — CPCB estimate only
			congestion_level: 32, // TomTom 2024
			noise_pollution: 70, // CPCB NANMN — commercial zones high
			carbon_emission_intensity: 0.4, // UrbanEmissions APnA — lowest, high PT + walk mode share
			fuel_consumption: 70, // PPAC West Bengal — lowest, walk+PT dominant
			green_cover: 2.0, // Published research — Maidan helps, otherwise dense
			// Mobility
			sustainable_mode_share: 80, // Census: walk 39 + cycle 10 + PT 31
			road_density: 9.0 // 1,850 km / 206 km² KMC
		}
	},
	{
		cityId: 'mumbai',
		values: {
			// Health
			traffic_fatalities: 2.8, // Mumbai Road Safety Report 2022 (Bloomberg BIGRS): 365 deaths, pop ~1.3 cr
			vru_fatality_share: 44, // Pedestrians 44% of fatalities; cyclist share ~2-3%
			walking_share: 27, // CMP/Census estimates for work trips
			cycling_share: 3, // Very low — geography, climate, road conditions
			footpath_coverage: 35, // MCGM Pedestrian First policy — arterials have footpaths but poor quality
			// Accessibility
			rail_transit_km: 545, // Metro 80 + suburban railway 465
			bus_fleet_per_lakh: 22, // BEST ~2,900 buses, pop ~1.3 cr
			transit_stop_density: 7.8, // (4500 bus + 69 metro + 125 suburban) / 603 km²
			cycle_infra_km: 23, // OSM 2026: scattered tracks including coastal road segments
			pt_accessibility: 75, // Suburban rail spine + BEST bus coverage; gaps in eastern suburbs
			// Environmental
			pm25_annual: 38, // CPCB/IQAir estimates — industrial + port activity
			no2_annual: null, // No direct measurement — CPCB estimate only
			congestion_level: 53, // TomTom 2023 — one of India's worst
			noise_pollution: 72, // CPCB NANMN — 10 stations continuous
			carbon_emission_intensity: 0.6, // UrbanEmissions APnA — suburban rail keeps this low
			fuel_consumption: 110, // PPAC Maharashtra — rail commuting reduces this
			green_cover: 1.2, // CSCAF research — Sanjay Gandhi NP in boundary
			// Mobility
			sustainable_mode_share: 58, // Walk 27% + cycle 3% + bus 15% + rail 15% + metro 1%
			road_density: 8.3 // ~5,000 km roads / 603 km² (BMC area)
		}
	},
	{
		cityId: 'pune',
		values: {
			traffic_fatalities: 7.1, // NCRB 2022 — lowest of the 6
			walking_share: 25, // Census
			cycling_share: 15, // Census (high — flat terrain, cycle culture)
			vru_fatality_share: 53, // NCRB 2022: (210+85)/555 = 53%
			footpath_coverage: 40, // PMC footpath survey
			rail_transit_km: 97, // Metro 33.3 + suburban rail ~64 (Pune-Lonavala)
			bus_fleet_per_lakh: 25, // PMPML ~2,000 buses, pop ~78 lakh
			transit_stop_density: 10.8, // (3500 bus + 30 metro + 17 suburban) / 330 km²
			cycle_infra_km: 10, // OSM 2026: JM Road + Satara Road + University Road tracks — 300 km planned, mostly unbuilt
			pt_accessibility: 57, // 3,547 stops / 330 km² — suburban rail corridor adds coverage
			pm25_annual: 36, // CPCB 2023
			no2_annual: 32, // CPCB 2023 annual average
			congestion_level: 41, // TomTom 2023
			noise_pollution: 66, // MPCB campaign — moderate
			carbon_emission_intensity: 0.7, // UrbanEmissions APnA — two-wheeler heavy
			fuel_consumption: 140, // PPAC Maharashtra — two-wheeler heavy
			green_cover: 1.4, // CSCAF — low despite green image
			sustainable_mode_share: 50, // Census/CMP: walk+cycle+bus
			road_density: 9.8 // PMC area ~330 km²
		}
	}
];

// ---- Override mechanism ----

/** Live data overrides keyed by cityId, then indicator key. */
export type QoLOverrides = Record<string, Record<string, number | null>>;

// ---- Scoring engine ----

/**
 * Grade boundaries anchored to policy-meaningful thresholds.
 */
export function gradeFromScore(score: number): string {
	for (const b of GRADE_BOUNDARIES) {
		if (score >= b.min) return b.grade;
	}
	return 'E';
}

export function gradeLabel(grade: string): string {
	const entry = GRADE_BOUNDARIES.find((b) => b.grade === grade);
	return entry?.label ?? '';
}

export function gradeColor(grade: string): string {
	const colors: Record<string, string> = {
		A: 'var(--color-altmo-700)',
		B: 'var(--color-altmo-500)',
		C: 'var(--color-tangerine-300)',
		D: 'var(--color-tangerine-500)',
		E: 'var(--color-status-unavailable)'
	};
	return colors[grade] ?? 'var(--color-text-secondary)';
}

/**
 * Benchmark-anchored normalization.
 * Scores are anchored to fixed worst-reference and target values,
 * so adding/removing cities does not shift existing scores.
 */
function normalizeIndicator(
	key: string,
	value: number,
	effect: EffectDirection
): number {
	const bench = INDICATOR_BENCHMARKS[key];
	if (!bench) return 0.5;

	const { worstRef, target } = bench;
	if (worstRef === target) return 0.5;

	let raw: number;
	if (effect === 'negative') {
		// Lower is better: worst is high, target is low
		raw = (worstRef - value) / (worstRef - target);
	} else {
		// Higher is better: worst is low, target is high
		raw = (value - worstRef) / (target - worstRef);
	}

	return Math.max(0, Math.min(1, raw));
}

/**
 * Compute multi-factor data confidence score (0-100).
 * 5 weighted factors: indicator coverage (20%), live data freshness (25%),
 * sensor coverage (15%), transit data quality (20%), data readiness (20%).
 */
function computeConfidence(
	cityId: string,
	indicatorsAvailable: number,
	overrides?: QoLOverrides
): ConfidenceBreakdown {
	// Factor 1: Indicator coverage (20%)
	const indicatorCoverage = Math.round((indicatorsAvailable / TQOLI_FULL_INDICATOR_COUNT) * 100);

	// Factor 2: Live data freshness (25%)
	const liveCount = overrides?.[cityId] ? Object.keys(overrides[cityId]).length : 0;
	const liveDataFreshness = indicatorsAvailable > 0
		? Math.round((liveCount / indicatorsAvailable) * 100)
		: 0;

	// Factor 3: Sensor coverage (15%) — PM2.5 + NO2 sensors, cap at 10
	const pm25Sensors = CITY_OPENAQ_SENSORS[cityId]?.sensorIds?.length ?? 0;
	const no2Sensors = CITY_OPENAQ_NO2_SENSORS[cityId]?.sensorIds?.length ?? 0;
	const sensorCoverage = Math.round((Math.min(pm25Sensors + no2Sensors, 10) / 10) * 100);

	// Factor 4: Transit data quality (20%) — checklist out of 20 points
	const city = getCityById(cityId);
	const ts = city?.transitSources;

	let transitPoints = 0;
	// Bus: TransitRouter=6, Overpass=3, none=0
	if (ts?.busStops) transitPoints += 6;
	else if (ts?.busStopsOverpass) transitPoints += 3;
	// Metro: GeoJSON/GTFS=5, Overpass=3, none=0
	if (ts?.metroStations || ts?.metroGTFS) transitPoints += 5;
	else if (ts?.metroOverpass) transitPoints += 3;
	// Suburban rail: configured=3, none=0
	if (ts?.suburbanRailOverpass) transitPoints += 3;
	// Has operationalLines whitelist: 3
	if (ts?.operationalLines && ts.operationalLines.length > 0) transitPoints += 3;
	// Metro ridership available (from data-readiness): 3
	const cityReadiness = getReadiness(cityId);
	if (cityReadiness?.layers?.metro_ridership === 'available') transitPoints += 3;

	const transitDataQuality = Math.round((transitPoints / 20) * 100);

	// Factor 5: Data readiness (20%)
	const readinessData = computeReadinessScore(cityId);
	const dataReadiness = readinessData
		? Math.round((readinessData.total / readinessData.maxScore) * 100)
		: 0;

	// Factor 6: Altmo traces (10%) — available=100, partial=50, unavailable=0
	const altmoStatus = cityReadiness?.layers?.altmo_traces;
	const altmoTraces = altmoStatus === 'available' ? 100 : altmoStatus === 'partial' ? 50 : 0;

	// Weighted composite (6 factors, weights sum to 1.0)
	const score = Math.round(
		indicatorCoverage * 0.15 +
		liveDataFreshness * 0.25 +
		sensorCoverage * 0.10 +
		transitDataQuality * 0.20 +
		dataReadiness * 0.20 +
		altmoTraces * 0.10
	);

	// Thresholds: Gold >= 70, Silver >= 45, Bronze < 45
	let tier: ConfidenceTier;
	if (score >= 70) tier = 'gold';
	else if (score >= 45) tier = 'silver';
	else tier = 'bronze';

	return {
		tier,
		score,
		factors: {
			indicatorCoverage,
			liveDataFreshness,
			sensorCoverage,
			transitDataQuality,
			dataReadiness,
			altmoTraces
		}
	};
}

/**
 * Compute QoL score for a single city.
 * Optional overrides replace hardcoded values for live data integration.
 */
export function computeCityQoL(cityId: string, overrides?: QoLOverrides): CityQoLScore | undefined {
	const cityData = CITY_QOL_DATA.find((c) => c.cityId === cityId);
	if (!cityData) return undefined;

	let totalAvailable = 0;
	let totalDefined = 0;

	const dimensions: DimensionScore[] = QOL_DIMENSIONS.map((dim) => {
		const indicators = dim.indicators.map((ind) => {
			const value = overrides?.[cityId]?.[ind.key] ?? cityData.values[ind.key] ?? null;
			const normalized =
				value !== null ? normalizeIndicator(ind.key, value, ind.effect) : null;

			return {
				key: ind.key,
				label: ind.label,
				unit: ind.unit,
				value,
				normalized
			};
		});

		// Null penalty: missing indicators score 0 (worst-case) rather than
		// being excluded from the average. This incentivises cities to publish
		// data — even bad data beats the worst-case assumption.
		const allScores = indicators.map((i) => i.normalized ?? 0);
		const dimScore = allScores.length > 0
			? allScores.reduce((a, b) => a + b, 0) / allScores.length
			: 0;

		const availableCount = indicators.filter((i) => i.normalized !== null).length;
		const totalCount = indicators.length;
		totalAvailable += availableCount;
		totalDefined += totalCount;

		return {
			key: dim.key,
			label: dim.label,
			weight: dim.weight,
			score: dimScore,
			weighted: dimScore * dim.weight,
			availableCount,
			totalCount,
			indicators
		};
	});

	const composite = dimensions.reduce((sum, d) => sum + d.weighted, 0);
	const grade = gradeFromScore(composite);
	const confidenceBreakdown = computeConfidence(cityId, totalAvailable, overrides);

	return {
		cityId,
		composite,
		grade,
		dimensions,
		confidence: confidenceBreakdown.tier,
		confidenceBreakdown,
		indicatorsAvailable: totalAvailable,
		indicatorsTotal: TQOLI_FULL_INDICATOR_COUNT
	};
}

/**
 * Compute QoL scores for all cities, sorted by composite score (highest first).
 * Optional overrides replace hardcoded values for live data integration.
 */
export function computeAllQoL(overrides?: QoLOverrides): CityQoLScore[] {
	return CITY_QOL_DATA.map((c) => computeCityQoL(c.cityId, overrides)!)
		.filter(Boolean)
		.sort((a, b) => b.composite - a.composite);
}
