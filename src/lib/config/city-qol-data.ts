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
	active_transport_share: { worstRef: 10,  target: 50,  source: 'Low-cycling Indian city / Amsterdam-class' },
	metro_network_km:       { worstRef: 0,   target: 400, source: 'No metro / Delhi DMRC (largest in India)' },
	bus_fleet_per_lakh:     { worstRef: 5,   target: 60,  source: 'Below minimum / BMTC-class fleet' },
	pm25_annual:            { worstRef: 100, target: 15,  source: 'Delhi-level / WHO 2021 guideline' },
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

export function getConfidenceTier(availableCount: number, totalCount: number): ConfidenceTier {
	const pct = totalCount > 0 ? availableCount / totalCount : 0;
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
				key: 'active_transport_share',
				label: 'Active Transport',
				unit: '% trips',
				effect: 'positive',
				source: 'Census/CMP',
				description: 'Share of trips by walking and cycling'
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
			active_transport_share: 27, // CMP 2020: walk 22% + cycle 5%
			// Accessibility
			metro_network_km: 73.8, // Namma Metro Phase 1 + 2A (as of 2024)
			bus_fleet_per_lakh: 53, // BMTC ~6,500 buses, pop ~1.23 cr
			// Environmental
			pm25_annual: 34, // CPCB 2023 annual average
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
			active_transport_share: 28, // Census/CTTS: walk 24% + cycle 4%
			metro_network_km: 54.6, // Phase 1 + extension (2024)
			bus_fleet_per_lakh: 40, // MTC ~3,500 buses, pop ~87 lakh
			pm25_annual: 31, // CPCB 2023
			congestion_level: 39, // TomTom 2023
			sustainable_mode_share: 52, // CTTS: walk+cycle+bus+metro
			road_density: 12.5 // ~2,200 km roads / 176 km² (Chennai Corp)
		}
	},
	{
		cityId: 'delhi',
		values: {
			traffic_fatalities: 11.3, // NCRB 2022: highest absolute numbers
			active_transport_share: 22, // Census: walk 16% + cycle 6%
			metro_network_km: 393, // DMRC — largest network in India
			bus_fleet_per_lakh: 32, // DTC ~3,700 + cluster ~3,500; pop ~2.1 cr
			pm25_annual: 99, // CPCB 2023 — worst in India
			congestion_level: 44, // TomTom 2023
			sustainable_mode_share: 43, // Census/DMP: walk+cycle+bus+metro
			road_density: 18.0 // Dense road network, 1,483 km² NCT
		}
	},
	{
		cityId: 'hyderabad',
		values: {
			traffic_fatalities: 8.4, // NCRB 2022
			active_transport_share: 25, // Census/CMP: walk 20% + cycle 5%
			metro_network_km: 69.2, // HMR L1+L2+L3
			bus_fleet_per_lakh: 30, // TSRTC city services ~3,000, pop ~1 cr
			pm25_annual: 37, // CPCB 2023
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
			active_transport_share: 27, // CMP/ICLEI: walk 22% + cycle 5%
			// Accessibility
			metro_network_km: 0, // Under construction in 2024; priority corridor opened May 2025
			bus_fleet_per_lakh: 11, // AICTSL ~387 buses, metro pop ~35 lakh
			// Environmental
			pm25_annual: 56, // UrbanEmissions model + IQAir estimates
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
			active_transport_share: 27, // Census: walk 22% + cycle 5%
			metro_network_km: 25.6, // KMRL single line
			bus_fleet_per_lakh: 20, // KSRTC city ~400 + private; pop ~21 lakh
			pm25_annual: 27, // CPCB 2023 — cleanest of the 6
			congestion_level: 29, // TomTom 2023 — lowest
			sustainable_mode_share: 42, // CMP: walk+cycle+bus+metro
			road_density: 7.2 // Kochi Corp ~95 km²
		}
	},
	{
		cityId: 'pune',
		values: {
			traffic_fatalities: 7.1, // NCRB 2022 — lowest of the 6
			active_transport_share: 40, // Census: walk 25% + cycle 15% (high!)
			metro_network_km: 33.3, // Pune Metro Phase 1 (partial, 2024)
			bus_fleet_per_lakh: 25, // PMPML ~2,000 buses, pop ~78 lakh
			pm25_annual: 36, // CPCB 2023
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
		indicatorsTotal: totalDefined
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
