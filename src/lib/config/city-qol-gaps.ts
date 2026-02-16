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
	noise_pollution: (v) => `Daytime noise at ${Math.round(v)} dB(A) \u2014 ${Math.round(v) > 55 ? `${Math.round(v - 55)} dB above` : 'within'} the WHO guideline`,
	carbon_emission_intensity: (v) => `Transport CO\u2082 at ${v.toFixed(1)} tonnes per capita per year`,
	fuel_consumption: (v) => `Transport fuel consumption at ${Math.round(v)} litres per capita per year`,
	green_cover: (v) => `Green cover at only ${v.toFixed(1)} m\u00B2 per person \u2014 ${v < 9 ? 'below WHO minimum of 9 m\u00B2' : 'above WHO minimum'}`,
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
	noise_pollution: () => 'Electric vehicle adoption + noise barriers on expressways could bring levels closer to WHO guidelines',
	carbon_emission_intensity: () => 'Fleet electrification + metro expansion + congestion pricing could cut transport CO\u2082 by 40%',
	fuel_consumption: () => 'Modal shift to public transit + EV adoption could halve per-capita fuel consumption',
	green_cover: (v) => v < 2
		? 'Urban greening programme with street trees + pocket parks could triple per-capita green cover'
		: 'Expanding urban forests + greening transport corridors could significantly improve per-capita green cover',
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
	noise_pollution: (from, to) => `reducing noise from ${Math.round(from)} to ${Math.round(to)} dB(A)`,
	carbon_emission_intensity: (from, to) => `reducing transport CO\u2082 from ${from.toFixed(1)} to ${to.toFixed(1)} t/cap/yr`,
	fuel_consumption: (from, to) => `reducing fuel consumption from ${Math.round(from)} to ${Math.round(to)} L/cap/yr`,
	green_cover: (from, to) => `increasing green cover from ${from.toFixed(1)} to ${to.toFixed(1)} m\u00B2/person`,
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
 * For multi-city regions, appends satellite city context explaining
 * why the indicator is dragged down by constituent cities.
 */
function generateRecommendation(cityId: string, worstInd: { key: string; value: number | null }): string {
	if (worstInd.value === null) return 'Improving data availability would enable targeted recommendations';
	const template = RECOMMENDATION_TEMPLATES[worstInd.key];
	const base = template ? template(worstInd.value) : 'Targeted investment in this area would improve the city\'s overall quality of life score';
	const regionalCtx = REGIONAL_RECOMMENDATION_CONTEXT[cityId]?.[worstInd.key] ?? '';
	return base + regionalCtx;
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
	const pointsNeeded = Math.max(1, Math.ceil((nextGrade.min - composite) * 100));

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
	delhi: 'Noida and Ghaziabad publish no city bus data (zero dedicated services), Gurugram lacks pedestrian audit data, and none of the satellite cities publish open GTFS feeds or walking infrastructure data',
	hyderabad: 'Publishing walking/cycling infrastructure data would enable complete active mobility assessment',
	indore: 'Publishing bus frequency and walking infrastructure data enables transit coverage gap analysis',
	kochi: 'Publishing safety and NMT infrastructure data unlocks health dimension scoring',
	kolkata: 'New Town Rajarhat lacks published bus route and walking infrastructure data; WBTC publishing GTFS feeds and KMC mapping footpath encroachment would enable corridor-level NMT analysis',
	mumbai: 'TMT, NMMT, and KDMT do not publish GTFS feeds, making satellite city transit coverage hard to verify; no OpenAQ sensors are configured for the MMR, and walking infrastructure data is unavailable across all four constituent cities',
	pune: 'PMPML does not publish separate ridership data for PMC vs PCMC zones, making it impossible to assess whether Pimpri-Chinchwad gets proportional bus service; PCMC lacks pedestrian audit data'
};

/**
 * Regional context: for multi-city regions, appended to the generic recommendation
 * to explain WHY the region scores poorly (satellite city deficiencies).
 */
const REGIONAL_RECOMMENDATION_CONTEXT: Record<string, Record<string, string>> = {
	delhi: {
		bus_fleet_per_lakh: ' \u2014 critically, Noida and Ghaziabad have zero dedicated city bus services, and Gurugram (GMCBL) operates only 150 buses',
		transit_stop_density: ' \u2014 satellite cities (Noida, Gurugram, Ghaziabad) add 645 km\u00B2 of area with negligible bus stop coverage',
		pt_accessibility: ' \u2014 Gurugram has <20% PT coverage, Noida ~15%, Ghaziabad ~10%; satellite cities drag the regional average from 56% to 44%',
		footpath_coverage: ' \u2014 Gurugram has ~10% footpath coverage (notoriously poor pedestrian infrastructure) vs Delhi\'s 25%',
		walking_share: ' \u2014 Gurugram (~8%) and Noida (~10%) are car-dependent satellite cities with minimal pedestrian culture',
		cycling_share: ' \u2014 Gurugram has near-zero cycling infrastructure; satellite cities average ~2% cycling share',
		sustainable_mode_share: ' \u2014 Gurugram (~20%) and Noida (~25%) are car-dominated; the region drops from Delhi\'s 43% to 40%',
		road_density: ' \u2014 satellite cities have sparser road networks (Gurugram ~8, Noida ~6 km/km\u00B2) vs Delhi\'s 18',
		carbon_emission_intensity: ' \u2014 satellite cities are more car-dependent (~1.5 t CO\u2082/cap/yr) vs Delhi proper (1.2)',
		fuel_consumption: ' \u2014 car-dependent satellite suburbs consume ~250 L/cap/yr vs Delhi\'s 200'
	},
	mumbai: {
		bus_fleet_per_lakh: ' \u2014 TMT (400), NMMT (550), and KDMT (141) add satellite city coverage but regional per-lakh drops from 22 to 21',
		traffic_fatalities: ' \u2014 satellite cities on highway corridors (Eastern Express, NH-8) nearly double the fatality count vs BMC alone',
		walking_share: ' \u2014 satellite cities are less walkable: Navi Mumbai (~15%, planned car-oriented city), Thane and KD (~20%)',
		footpath_coverage: ' \u2014 Kalyan-Dombivli (~15%) and Thane (~25%) have worse footpath coverage than BMC (35%)',
		sustainable_mode_share: ' \u2014 satellite cities are car-dependent: Navi Mumbai ~30%, Thane ~40%, KD ~35% vs BMC\'s 58%',
		pt_accessibility: ' \u2014 Kalyan-Dombivli has only ~35% PT coverage; peripheral areas of Thane and Navi Mumbai are underserved',
		carbon_emission_intensity: ' \u2014 satellite cities average ~0.8 t CO\u2082/cap/yr vs Mumbai island\'s 0.6 (less suburban rail usage)',
		fuel_consumption: ' \u2014 satellite city commuters rely more on private vehicles (~140 L/cap/yr vs Mumbai\'s 110)'
	},
	pune: {
		transit_stop_density: ' \u2014 PCMC adds 181 km\u00B2 of industrial area with sparser PMPML coverage than PMC',
		pt_accessibility: ' \u2014 PCMC industrial zones (~35% coverage) drag the region from PMC\'s 57% to 48%',
		walking_share: ' \u2014 PCMC\'s industrial township layout means longer commutes and less walking (~18% vs PMC\'s 25%)',
		cycling_share: ' \u2014 PCMC\'s industrial traffic makes cycling unsafe (~8% vs PMC\'s 15%)',
		footpath_coverage: ' \u2014 PCMC industrial zones have ~25% footpath coverage vs PMC\'s 40%',
		sustainable_mode_share: ' \u2014 PCMC\'s industrial commuters rely more on private vehicles (~40% vs PMC\'s 50%)',
		green_cover: ' \u2014 PCMC industrial land use (~0.8 m\u00B2/person) drags the region from PMC\'s 1.4'
	},
	kolkata: {
		walking_share: ' \u2014 New Town\'s planned township layout favours driving over walking (~25% vs KMC\'s 39%)',
		sustainable_mode_share: ' \u2014 New Town residents use more private vehicles (~65% sustainable) vs KMC\'s 80%',
		bus_fleet_per_lakh: ' \u2014 New Town adds 15 lakh population with limited WBTC bus service extension'
	}
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
		recommendation: generateRecommendation(cityId, worstInd),
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
