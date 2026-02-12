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

export interface DimensionScore {
	key: string;
	label: string;
	weight: number;
	score: number; // 0-1 normalized
	weighted: number; // score * weight
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

// ---- Scoring engine ----

/**
 * Grade boundaries from the paper's Bell-Curve method.
 */
function gradeFromScore(score: number): string {
	if (score >= 0.6) return 'A';
	if (score >= 0.53) return 'B';
	if (score >= 0.47) return 'C';
	if (score >= 0.39) return 'D';
	return 'E';
}

export function gradeLabel(grade: string): string {
	const labels: Record<string, string> = {
		A: 'Strong positive',
		B: 'Moderate positive',
		C: 'Weak positive',
		D: 'Moderate negative',
		E: 'Strong negative'
	};
	return labels[grade] ?? '';
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
 * Min-max normalize an indicator value across all cities.
 * For negative-effect indicators (lower is better), the scale is inverted.
 */
function normalizeIndicator(
	key: string,
	value: number,
	allValues: (number | null)[],
	effect: EffectDirection
): number {
	const valid = allValues.filter((v): v is number => v !== null);
	if (valid.length < 2) return 0.5;

	const min = Math.min(...valid);
	const max = Math.max(...valid);
	if (max === min) return 0.5;

	const raw = (value - min) / (max - min);
	return effect === 'negative' ? 1 - raw : raw;
}

/**
 * Compute QoL score for a single city.
 */
export function computeCityQoL(cityId: string): CityQoLScore | undefined {
	const cityData = CITY_QOL_DATA.find((c) => c.cityId === cityId);
	if (!cityData) return undefined;

	const dimensions: DimensionScore[] = QOL_DIMENSIONS.map((dim) => {
		const indicators = dim.indicators.map((ind) => {
			const value = cityData.values[ind.key] ?? null;
			const allValues = CITY_QOL_DATA.map((c) => c.values[ind.key] ?? null);
			const normalized =
				value !== null ? normalizeIndicator(ind.key, value, allValues, ind.effect) : null;

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

		return {
			key: dim.key,
			label: dim.label,
			weight: dim.weight,
			score: dimScore,
			weighted: dimScore * dim.weight,
			indicators
		};
	});

	const composite = dimensions.reduce((sum, d) => sum + d.weighted, 0);
	const grade = gradeFromScore(composite);

	return { cityId, composite, grade, dimensions };
}

/**
 * Compute QoL scores for all cities, sorted by composite score (highest first).
 */
export function computeAllQoL(): CityQoLScore[] {
	return CITY_QOL_DATA.map((c) => computeCityQoL(c.cityId)!)
		.filter(Boolean)
		.sort((a, b) => b.composite - a.composite);
}
