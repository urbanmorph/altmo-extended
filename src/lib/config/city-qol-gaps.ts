/**
 * Gap analysis engine: identifies worst QoL dimension/indicator per city
 * and generates data-driven narratives from actual scoring values.
 *
 * Gap sentences and recommendations are generated dynamically from the
 * current indicator values (including live overrides). Only the data-unlock
 * sentences are static — they describe data availability gaps, not scores.
 *
 * The upgrade path analysis simulates indicator improvements to show what
 * it takes for each city to jump to the next ETQOLI grade level.
 */

import {
	computeCityQoL,
	computeAllQoL,
	INDICATOR_BENCHMARKS,
	GRADE_BOUNDARIES,
	QOL_DIMENSIONS,
	type DimensionScore,
	type QoLOverrides
} from './city-qol-data';

export interface CityGapAnalysis {
	cityId: string;
	worstDimension: string;
	worstIndicator: string;
	gapSentence: string;
	recommendation: string;
	upgradeSentence: string;
	dataUnlockSentence: string;
}

// ── Indicator-specific gap sentence templates ──
// Each template receives the actual value and returns a sentence fragment.

const GAP_TEMPLATES: Record<string, (val: number) => string> = {
	traffic_fatalities: (v) => `Traffic fatality rate of ${v.toFixed(1)} per lakh population`,
	vru_fatality_share: (v) => `${Math.round(v)}% of traffic fatalities are pedestrians and cyclists`,
	walking_share: (v) => `Walking share at only ${Math.round(v)}% of trips`,
	cycling_share: (v) => `Cycling share at just ${Math.round(v)}% of trips`,
	footpath_coverage: (v) => `Only ${Math.round(v)}% of roads have paved footpaths`,
	rail_transit_km: (v) => `Rail transit network at ${Math.round(v)} km`,
	bus_fleet_per_lakh: (v) => `Bus fleet of only ${Math.round(v)} per lakh population`,
	transit_stop_density: (v) => `Transit stop density of ${v.toFixed(1)} stops/km\u00B2`,
	cycle_infra_km: (v) => `Only ${Math.round(v)} km of dedicated cycle infrastructure`,
	pt_accessibility: (v) => `Only ${Math.round(v)}% of city area within 500m of transit`,
	pm25_annual: (v) => `PM2.5 at ${Math.round(v)} \u00B5g/m\u00B3 \u2014 ${(v / 15).toFixed(1)}x the WHO guideline`,
	no2_annual: (v) => `NO\u2082 at ${Math.round(v)} \u00B5g/m\u00B3 \u2014 ${(v / 10).toFixed(1)}x the WHO guideline`,
	congestion_level: (v) => `${Math.round(v)}% extra travel time due to congestion`,
	sustainable_mode_share: (v) => `Sustainable mode share at only ${Math.round(v)}%`,
	road_density: (v) => `Road density of only ${v.toFixed(1)} km/km\u00B2`
};

// ── Indicator-specific recommendation templates ──

const RECOMMENDATION_TEMPLATES: Record<string, (val: number) => string> = {
	traffic_fatalities: () => 'Dedicated pedestrian infrastructure + traffic calming on arterials could halve fatality rates',
	vru_fatality_share: () => 'Protected cycle lanes + pedestrian-priority zones at key junctions could halve VRU fatalities',
	walking_share: () => 'Pedestrian-priority corridors + footpath expansion on arterials could double walking share',
	cycling_share: () => 'Building protected cycle networks + bike-share systems could shift trips from private vehicles',
	footpath_coverage: () => 'Mandating footpaths on all arterial and sub-arterial roads would improve walkability scores',
	rail_transit_km: (v) => v < 30
		? 'Completing planned metro phases would significantly expand rail transit coverage'
		: 'Extending metro network with last-mile bus connectivity would improve transit access',
	bus_fleet_per_lakh: (v) => `Expanding fleet to ${Math.max(40, Math.round(v * 2))} per lakh with electric buses would improve transit accessibility`,
	transit_stop_density: () => 'Adding feeder bus routes in underserved areas would improve stop density and last-mile coverage',
	cycle_infra_km: (v) => `Building ${Math.max(50, Math.round(v * 3))} km of protected cycle lanes would significantly improve active mobility access`,
	pt_accessibility: () => 'Expanding bus routes to peri-urban areas would bring more residents within 500m of transit',
	pm25_annual: () => 'Fleet electrification + congestion pricing could cut transport-related PM2.5 by 30%',
	no2_annual: () => 'Transitioning bus fleets to electric and expanding metro capacity would reduce NO\u2082 levels',
	congestion_level: () => 'Metro expansion + bus priority lanes could reduce peak-hour congestion significantly',
	sustainable_mode_share: () => 'Investing in NMT infrastructure and public transit would shift trips from private vehicles',
	road_density: () => 'Improving road connectivity in peri-urban areas would reduce congestion on arterials'
};

// ── Human-readable improvement descriptions ──
// For upgrade path: describes what reaching a target value means in plain language.

const UPGRADE_DESCRIPTIONS: Record<string, (from: number, to: number) => string> = {
	traffic_fatalities: (from, to) => `reducing fatalities from ${from.toFixed(1)} to ${to.toFixed(1)} per lakh`,
	vru_fatality_share: (from, to) => `reducing VRU fatality share from ${Math.round(from)}% to ${Math.round(to)}%`,
	walking_share: (from, to) => `increasing walking share from ${Math.round(from)}% to ${Math.round(to)}%`,
	cycling_share: (from, to) => `growing cycling share from ${Math.round(from)}% to ${Math.round(to)}%`,
	footpath_coverage: (from, to) => `expanding footpath coverage from ${Math.round(from)}% to ${Math.round(to)}%`,
	rail_transit_km: (from, to) => `expanding rail transit from ${Math.round(from)} to ${Math.round(to)} km`,
	bus_fleet_per_lakh: (from, to) => `growing bus fleet from ${Math.round(from)} to ${Math.round(to)} per lakh`,
	transit_stop_density: (from, to) => `increasing stop density from ${from.toFixed(1)} to ${to.toFixed(1)}/km\u00B2`,
	cycle_infra_km: (from, to) => `building cycle infrastructure from ${Math.round(from)} to ${Math.round(to)} km`,
	pt_accessibility: (from, to) => `expanding transit access from ${Math.round(from)}% to ${Math.round(to)}% of city area`,
	pm25_annual: (from, to) => `reducing PM2.5 from ${Math.round(from)} to ${Math.round(to)} \u00B5g/m\u00B3`,
	no2_annual: (from, to) => `reducing NO\u2082 from ${Math.round(from)} to ${Math.round(to)} \u00B5g/m\u00B3`,
	congestion_level: (from, to) => `reducing congestion from ${Math.round(from)}% to ${Math.round(to)}% extra time`,
	sustainable_mode_share: (from, to) => `increasing sustainable mode share from ${Math.round(from)}% to ${Math.round(to)}%`,
	road_density: (from, to) => `improving road density from ${from.toFixed(1)} to ${to.toFixed(1)} km/km\u00B2`
};

/**
 * Generate a gap sentence by combining the worst indicator with supporting
 * context from the second-worst indicator in the same dimension.
 */
function generateGapSentence(worstDim: DimensionScore): string {
	// Sort indicators by normalized score (worst first), excluding nulls
	const ranked = worstDim.indicators
		.filter((i) => i.value !== null && i.normalized !== null)
		.sort((a, b) => (a.normalized ?? 1) - (b.normalized ?? 1));

	if (ranked.length === 0) return `${worstDim.label} dimension has insufficient data for analysis`;

	const worst = ranked[0];
	const template = GAP_TEMPLATES[worst.key];
	const primary = template ? template(worst.value!) : `${worst.label} score is low`;

	// Add second-worst as supporting context if available and also poor (< 0.5)
	if (ranked.length > 1 && ranked[1].normalized !== null && ranked[1].normalized < 0.5) {
		const second = ranked[1];
		const secondTemplate = GAP_TEMPLATES[second.key];
		const secondary = secondTemplate
			? secondTemplate(second.value!).charAt(0).toLowerCase() + secondTemplate(second.value!).slice(1)
			: `${second.label} also underperforms`;
		return `${primary}, compounded by ${secondary}`;
	}

	return primary;
}

/**
 * Generate a recommendation based on the worst indicator.
 */
function generateRecommendation(worstInd: { key: string; value: number | null }): string {
	if (worstInd.value === null) return 'Improving data availability would enable targeted recommendations';
	const template = RECOMMENDATION_TEMPLATES[worstInd.key];
	return template ? template(worstInd.value) : 'Targeted investment in this area would improve the city\'s overall quality of life score';
}

interface IndicatorImprovement {
	key: string;
	label: string;
	currentValue: number;
	targetValue: number;
	compositeGain: number;
	description: string;
}

/**
 * Compute the composite score that would result from changing one indicator's
 * value, keeping all others the same. Returns the new composite score.
 */
function simulateComposite(
	cityId: string,
	overrides: QoLOverrides | undefined,
	indicatorKey: string,
	newValue: number
): number {
	// Build a modified overrides object with the simulated value
	const simOverrides: QoLOverrides = {
		...overrides,
		[cityId]: {
			...overrides?.[cityId],
			[indicatorKey]: newValue
		}
	};
	const result = computeCityQoL(cityId, simOverrides);
	return result?.composite ?? 0;
}

/**
 * Find the dimension definition for a given indicator key.
 */
function findIndicatorDef(indicatorKey: string) {
	for (const dim of QOL_DIMENSIONS) {
		const ind = dim.indicators.find((i) => i.key === indicatorKey);
		if (ind) return ind;
	}
	return undefined;
}

/**
 * For a given indicator, compute a realistic improvement target — the value
 * that would bring its normalized score to a specific level. We use the
 * midpoint between current and benchmark target for a "realistic stretch" goal.
 */
function realisticTarget(key: string, currentValue: number, effect: string): number {
	const bench = INDICATOR_BENCHMARKS[key];
	if (!bench) return currentValue;

	// Aim for midpoint between current value and benchmark target
	const mid = (currentValue + bench.target) / 2;

	if (effect === 'negative') {
		// Lower is better — ensure target is lower than current
		return Math.min(currentValue, mid);
	} else {
		// Higher is better — ensure target is higher than current
		return Math.max(currentValue, mid);
	}
}

/**
 * Generate the upgrade path sentence: what it takes to reach the next grade.
 *
 * Strategy: for each indicator with measured data, simulate improving it to a
 * realistic target (midpoint to benchmark). Rank by composite score gain and
 * pick the top improvements that together bridge the gap to the next grade.
 */
function generateUpgradeSentence(
	cityId: string,
	composite: number,
	grade: string,
	dimensions: DimensionScore[],
	overrides?: QoLOverrides
): string {
	// Find next grade boundary
	const currentBoundaryIndex = GRADE_BOUNDARIES.findIndex((b) => b.grade === grade);
	if (currentBoundaryIndex <= 0) {
		// Already at grade A — no higher grade to reach
		return 'Already at the highest grade — maintaining these standards requires continued investment';
	}
	const nextGrade = GRADE_BOUNDARIES[currentBoundaryIndex - 1];
	const pointsNeeded = Math.round((nextGrade.min - composite) * 100);

	// Collect all measurable indicators across all dimensions
	const improvements: IndicatorImprovement[] = [];
	for (const dim of dimensions) {
		for (const ind of dim.indicators) {
			if (ind.value === null || ind.normalized === null) continue;
			// Skip indicators already scoring well (>0.7) — diminishing returns
			if (ind.normalized > 0.7) continue;

			const def = findIndicatorDef(ind.key);
			if (!def) continue;

			const target = realisticTarget(ind.key, ind.value, def.effect);
			// Only consider if the target actually differs meaningfully from current
			if (Math.abs(target - ind.value) < 0.01) continue;

			const newComposite = simulateComposite(cityId, overrides, ind.key, target);
			const gain = newComposite - composite;

			if (gain > 0.001) {
				const descFn = UPGRADE_DESCRIPTIONS[ind.key];
				improvements.push({
					key: ind.key,
					label: ind.label,
					currentValue: ind.value,
					targetValue: target,
					compositeGain: gain,
					description: descFn ? descFn(ind.value, target) : `improving ${ind.label}`
				});
			}
		}
	}

	if (improvements.length === 0) {
		return `${pointsNeeded} points from grade ${nextGrade.grade} — improving data coverage would enable targeted upgrade analysis`;
	}

	// Sort by composite gain (most impactful first)
	improvements.sort((a, b) => b.compositeGain - a.compositeGain);

	// Greedily pick improvements until we bridge the gap (or run out)
	const picked: IndicatorImprovement[] = [];
	let totalGain = 0;

	for (const imp of improvements) {
		picked.push(imp);
		totalGain += imp.compositeGain;
		if (totalGain >= nextGrade.min - composite) break;
		if (picked.length >= 3) break; // Cap at 3 improvements for readability
	}

	const totalGainPts = Math.round(totalGain * 100);
	const canBridge = totalGain >= nextGrade.min - composite;

	// Build the sentence
	const actionParts = picked.map((p) => p.description);
	let actions: string;
	if (actionParts.length === 1) {
		actions = actionParts[0];
	} else if (actionParts.length === 2) {
		actions = `${actionParts[0]} and ${actionParts[1]}`;
	} else {
		actions = `${actionParts.slice(0, -1).join(', ')}, and ${actionParts[actionParts.length - 1]}`;
	}

	if (canBridge) {
		return `${pointsNeeded} points from grade ${nextGrade.grade} \u2014 ${actions} would bridge this gap (+${totalGainPts} points)`;
	} else {
		return `${pointsNeeded} points from grade ${nextGrade.grade} \u2014 ${actions} would add ${totalGainPts} points toward this target`;
	}
}

/** Static data-unlock sentences per city (about data availability, not scores). */
const DATA_UNLOCK: Record<string, string> = {
	ahmedabad: 'Publishing AMTS GTFS feeds and walking infrastructure data enables corridor-level access analysis',
	bengaluru: 'Publishing walking/cycling infrastructure GIS data enables corridor-level gap analysis',
	chennai: 'Publishing walking/cycling infrastructure data enables corridor-level safety analysis',
	delhi: 'Publishing walking/cycling infrastructure data enables corridor-level air quality impact analysis',
	hyderabad: 'Publishing walking/cycling infrastructure data would enable complete active mobility assessment',
	indore: 'Publishing bus frequency and walking infrastructure data enables transit coverage gap analysis',
	kochi: 'Publishing safety and NMT infrastructure data unlocks health dimension scoring',
	mumbai: 'Publishing BEST GTFS feeds and walking infrastructure data enables corridor-level gap analysis',
	pune: 'Publishing ridership, safety, and NMT infrastructure data enables full multi-modal analysis'
};

/**
 * Compute gap analysis for a single city.
 * Gap sentences, recommendations, and upgrade paths are generated dynamically
 * from the current indicator values, so they always reflect live data.
 */
export function computeCityGap(cityId: string, overrides?: QoLOverrides): CityGapAnalysis | undefined {
	const qol = computeCityQoL(cityId, overrides);
	if (!qol) return undefined;

	// Find worst dimension (lowest score)
	const worstDim = qol.dimensions.reduce((a, b) => (a.score < b.score ? a : b));

	// Find worst indicator within that dimension
	const worstInd = worstDim.indicators.reduce((a, b) => {
		const aScore = a.normalized ?? 1;
		const bScore = b.normalized ?? 1;
		return aScore < bScore ? a : b;
	});

	return {
		cityId,
		worstDimension: worstDim.label,
		worstIndicator: worstInd.label,
		gapSentence: generateGapSentence(worstDim),
		recommendation: generateRecommendation(worstInd),
		upgradeSentence: generateUpgradeSentence(cityId, qol.composite, qol.grade, qol.dimensions, overrides),
		dataUnlockSentence: DATA_UNLOCK[cityId] ?? 'Publishing open transport and infrastructure data enables comprehensive analysis'
	};
}

/**
 * Compute gap analysis for all cities, sorted by QoL rank (highest composite first).
 */
export function computeAllGaps(overrides?: QoLOverrides): CityGapAnalysis[] {
	const allQoL = computeAllQoL(overrides);
	return allQoL
		.map((q) => computeCityGap(q.cityId, overrides))
		.filter((g): g is CityGapAnalysis => g !== undefined);
}
