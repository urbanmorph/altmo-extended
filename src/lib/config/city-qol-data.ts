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
 *   - City CMP/Smart City/DULT reports (footpath coverage, cycle infra)
 *   - TransitRouter + metro station data (PT accessibility estimates)
 */

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
	metro_network_km:       { worstRef: 0,   target: 400, source: 'No metro / Delhi DMRC (largest in India)' },
	bus_fleet_per_lakh:     { worstRef: 5,   target: 60,  source: 'Below minimum / BMTC-class fleet' },
	transit_stop_density:   { worstRef: 3,   target: 30,  source: 'Sparse coverage / dense European city' },
	cycle_infra_km:         { worstRef: 0,   target: 500, source: 'No cycle infra / Amsterdam-class network' },
	pt_accessibility:       { worstRef: 20,  target: 95,  source: 'Sparse transit reach / near-universal coverage' },
	pm25_annual:            { worstRef: 100, target: 15,  source: 'Delhi-level / WHO 2021 guideline' },
	no2_annual:             { worstRef: 80,  target: 10,  source: 'Delhi peak / WHO 2021 guideline' },
	congestion_level:       { worstRef: 60,  target: 15,  source: 'Severe congestion / near free-flow' },
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
 * Full TQOLI paper defines ~18 indicators across 4 dimensions.
 * We currently implement 8. Confidence reflects coverage against
 * the full framework, not just what we've coded.
 */
export const TQOLI_FULL_INDICATOR_COUNT = 18;

export function getConfidenceTier(availableCount: number, _totalImplemented: number): ConfidenceTier {
	const pct = availableCount / TQOLI_FULL_INDICATOR_COUNT;
	if (pct > 0.8) return 'gold';
	if (pct > 0.6) return 'silver';
	return 'bronze';
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
				key: 'metro_network_km',
				label: 'Metro Network',
				unit: 'km',
				effect: 'positive',
				source: 'Metro corps',
				description: 'Operational metro/rail rapid transit length'
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
		cityId: 'bengaluru',
		values: {
			// Health
			traffic_fatalities: 7.8, // NCRB 2022: ~960 deaths, pop ~1.23 cr
			walking_share: 22, // CMP 2020
			cycling_share: 5, // CMP 2020
			vru_fatality_share: 40, // NCRB 2022: (310+75)/960 = 40%
			footpath_coverage: 37, // CMP 2020 / DULT audit
			// Accessibility
			metro_network_km: 73.8, // Namma Metro Phase 1 + 2A (as of 2024)
			bus_fleet_per_lakh: 53, // BMTC ~6,500 buses, pop ~1.23 cr
			transit_stop_density: 11.2, // (8500 bus + 62 metro) / 764 km²
			cycle_infra_km: 15, // TenderSURE + cycle tracks
			pt_accessibility: 65, // 8,562 stops / 764 km² — gaps in periphery
			// Environmental
			pm25_annual: 34, // CPCB 2023 annual average
			no2_annual: 30, // CPCB 2023 annual average
			congestion_level: 51, // TomTom 2023
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
			metro_network_km: 54.6, // Phase 1 + extension (2024)
			bus_fleet_per_lakh: 40, // MTC ~3,500 buses, pop ~87 lakh
			transit_stop_density: 29.8, // (5200 bus + 40 metro) / 176 km²
			cycle_infra_km: 10, // Smart City corridors
			pt_accessibility: 85, // 5,240 stops / 176 km² — very dense
			pm25_annual: 31, // CPCB 2023
			no2_annual: 25, // CPCB 2023 annual average
			congestion_level: 39, // TomTom 2023
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
			metro_network_km: 393, // DMRC — largest network in India
			bus_fleet_per_lakh: 32, // DTC ~3,700 + cluster ~3,500; pop ~2.1 cr
			transit_stop_density: 4.8, // (6800 bus + 288 metro) / 1483 km²
			cycle_infra_km: 25, // DDA painted cycle tracks
			pt_accessibility: 55, // 7,088 stops / 1,483 km² — sparse outer NCT
			pm25_annual: 99, // CPCB 2023 — worst in India
			no2_annual: 60, // CPCB 2023 — worst in India
			congestion_level: 44, // TomTom 2023
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
			metro_network_km: 69.2, // HMR L1+L2+L3
			bus_fleet_per_lakh: 30, // TSRTC city services ~3,000, pop ~1 cr
			transit_stop_density: 7.0, // (4500 bus + 57 metro) / 650 km²
			cycle_infra_km: 8, // Limited cycle infra
			pt_accessibility: 50, // 4,557 stops / 650 km² — gaps in ORR-outer areas
			pm25_annual: 37, // CPCB 2023
			no2_annual: 28, // CPCB 2023 annual average
			congestion_level: 36, // TomTom 2023
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
			metro_network_km: 0, // Under construction in 2024; priority corridor opened May 2025
			bus_fleet_per_lakh: 11, // AICTSL ~387 buses, metro pop ~35 lakh
			transit_stop_density: 4.5, // (1200 bus + 0 metro) / 269 km²
			cycle_infra_km: 12, // BRTS corridor cycle tracks
			pt_accessibility: 35, // 1,200 stops / 269 km² — limited network
			// Environmental
			pm25_annual: 56, // UrbanEmissions model + IQAir estimates
			no2_annual: 35, // CPCB 2023 estimate
			congestion_level: 33, // Estimated (TomTom data not available for Indore)
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
			metro_network_km: 25.6, // KMRL single line
			bus_fleet_per_lakh: 20, // KSRTC city ~400 + private; pop ~21 lakh
			transit_stop_density: 19.2, // (1800 bus + 22 metro) / 95 km²
			cycle_infra_km: 5, // Minimal dedicated cycle infra
			pt_accessibility: 70, // 1,822 stops / 95 km² — compact city
			pm25_annual: 27, // CPCB 2023 — cleanest of the 6
			no2_annual: 18, // CPCB 2023 — lowest
			congestion_level: 29, // TomTom 2023 — lowest
			sustainable_mode_share: 42, // CMP: walk+cycle+bus+metro
			road_density: 7.2 // Kochi Corp ~95 km²
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
			metro_network_km: 33.3, // Pune Metro Phase 1 (partial, 2024)
			bus_fleet_per_lakh: 25, // PMPML ~2,000 buses, pop ~78 lakh
			transit_stop_density: 10.7, // (3500 bus + 30 metro) / 330 km²
			cycle_infra_km: 50, // PMC cycle tracks + BRT (strongest cycle culture)
			pt_accessibility: 55, // 3,530 stops / 330 km² — moderate coverage
			pm25_annual: 36, // CPCB 2023
			no2_annual: 32, // CPCB 2023 annual average
			congestion_level: 41, // TomTom 2023
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

		const validScores = indicators
			.map((i) => i.normalized)
			.filter((n): n is number => n !== null);
		const dimScore = validScores.length > 0
			? validScores.reduce((a, b) => a + b, 0) / validScores.length
			: 0;

		const availableCount = validScores.length;
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
	const confidence = getConfidenceTier(totalAvailable, totalDefined);

	return {
		cityId,
		composite,
		grade,
		dimensions,
		confidence,
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
