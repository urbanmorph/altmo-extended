/**
 * Scenario Comparison Engine for ETQOLI what-if modelling.
 *
 * Builds on the existing scoring engine in city-qol-data.ts.
 * Each intervention slider produces modified indicator values fed into
 * computeCityQoL() as overrides — no parallel scoring system.
 *
 * Coefficients calibrated against:
 *   Allirani & Verma (2025) "A novel transportation Quality of Life Index
 *   framework for evaluating sustainable transport interventions", IISc Bangalore.
 *
 * Bengaluru ST1A preset (metro -> 317 km) targets composite ~0.61.
 */

import {
	CITY_QOL_DATA,
	computeCityQoL,
	type QoLOverrides,
	type CityQoLScore
} from './city-qol-data';

// ---- Types ----

export interface InterventionDef {
	key: string;
	label: string;
	icon: string;
	unit: string;
	min: number | 'city_metro'; // 'city_metro' resolves to city's current metro km
	max: number;
	step: number;
	defaultValue: number | 'city_metro';
	effects: InterventionEffect[];
}

export interface InterventionEffect {
	indicator: string;
	mode: 'set' | 'delta_per_unit' | 'multiply';
	/** For 'set': value is the slider value itself (indicator = slider)
	 *  For 'delta_per_unit': value is change per unit of slider delta from baseline
	 *  For 'multiply': value is the multiplier factor expression */
	value: number;
	/** For 'delta_per_unit', this is the baseline key to compute delta from */
	baselineKey?: string;
}

export interface InterventionValues {
	metro_km: number;
	bus_multiplier: number;
	cycle_lanes_km: number;
	fleet_electrification_pct: number;
	grid_renewables_pct: number;
}

export interface IndicatorChange {
	key: string;
	label: string;
	unit: string;
	baseline: number | null;
	scenario: number | null;
	delta: number | null;
}

export interface ScenarioResult {
	baseline: CityQoLScore;
	scenario: CityQoLScore;
	delta: number;
	gradeChange: string; // e.g. "C -> A"
	indicatorChanges: IndicatorChange[];
}

export interface ScenarioPreset {
	key: string;
	label: string;
	group: 'metro-led' | 'bus-nmt';
	description: string;
	paperScore: number | null; // null for non-paper presets
	paperGrade: string | null;
	values: InterventionValues;
}

// ---- City-specific PM2.5 source apportionment coefficients ----
// Sources: UrbanEmissions APnA, CPCB receptor studies, TERI/ARAI inventories
// transportShare = fraction of ambient PM2.5 from transport (exhaust + road dust)
// powerShare = fraction of ambient PM2.5 from power generation

export const CITY_PM25_COEFFICIENTS: Record<string, { transportShare: number; powerShare: number }> = {
	bengaluru: { transportShare: 0.44, powerShare: 0.01 }, // Guttikunda 2019 — negligible local coal power
	chennai: { transportShare: 0.22, powerShare: 0.20 }, // North Chennai thermal plants in airshed
	delhi: { transportShare: 0.33, powerShare: 0.05 }, // Post-Badarpur closure (2018), TERI 2018
	hyderabad: { transportShare: 0.40, powerShare: 0.04 }, // CPCB receptor + UE inventory
	indore: { transportShare: 0.50, powerShare: 0.02 }, // UE inventory — no nearby coal plants
	kochi: { transportShare: 0.37, powerShare: 0.03 }, // UE inventory — Kerala minimal coal
	pune: { transportShare: 0.35, powerShare: 0.04 } // ARAI 2022 + NCAP convergence
};

// ---- City-specific grid renewable generation share (%) ----
// Based on state-level generation mix estimates for FY 2024-25.
// Sources: CEA, Ember SET 2024, GENCO reports, MNRE statistics

export const CITY_GRID_RENEWABLE_BASELINE: Record<string, number> = {
	bengaluru: 58, // Karnataka — hydro + solar + wind dominant
	chennai: 42, // Tamil Nadu — wind + solar + nuclear
	delhi: 29, // NCT — imports ~90%, ~70% coal
	hyderabad: 21, // Telangana — coal dominant (~80%)
	indore: 28, // Madhya Pradesh — solar + wind growing
	kochi: 28, // Kerala — in-state hydro, but imports ~70% (mostly coal)
	pune: 20 // Maharashtra — coal dominant (~75%)
};

// ---- City-specific transport intervention coefficients ----
// Sources: DIMTS Delhi, CMRL Chennai, HMRL Hyderabad, PMPML Pune, Kochi Metro Ltd,
// Indore BRT/AICTSL, RITES DPRs, Census 2011 mode share, IISc Bengaluru (baseline).
// Bengaluru values match the original Allirani & Verma (2025) calibration.

export const CITY_TRANSPORT_COEFFICIENTS: Record<string, {
	metroCongestionPerKm: number;
	metroModeSharePerKm: number;
	busCongestionPer2x: number;
	busModeSharePer2x: number;
	cycleCyclingSharePerKm: number;
	cycleWalkingSharePerKm: number;
	cycleModeSharePerKm: number;
	cycleCongestionPerKm: number;
	cycleFatalitiesPerKm: number;
}> = {
	bengaluru: {
		metroCongestionPerKm: -0.03, metroModeSharePerKm: 0.03,
		busCongestionPer2x: -4, busModeSharePer2x: 4,
		cycleCyclingSharePerKm: 0.02, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.02, cycleCongestionPerKm: -0.01, cycleFatalitiesPerKm: -0.005
	},
	delhi: {
		metroCongestionPerKm: -0.04, metroModeSharePerKm: 0.04,
		busCongestionPer2x: -3.5, busModeSharePer2x: 3.5,
		cycleCyclingSharePerKm: 0.022, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.022, cycleCongestionPerKm: -0.01, cycleFatalitiesPerKm: -0.005
	},
	chennai: {
		metroCongestionPerKm: -0.02, metroModeSharePerKm: 0.04,
		busCongestionPer2x: -5, busModeSharePer2x: 8,
		cycleCyclingSharePerKm: 0.025, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.025, cycleCongestionPerKm: -0.01, cycleFatalitiesPerKm: -0.005
	},
	hyderabad: {
		metroCongestionPerKm: -0.035, metroModeSharePerKm: 0.04,
		busCongestionPer2x: -3.5, busModeSharePer2x: 5,
		cycleCyclingSharePerKm: 0.015, cycleWalkingSharePerKm: 0.008,
		cycleModeSharePerKm: 0.015, cycleCongestionPerKm: -0.008, cycleFatalitiesPerKm: -0.004
	},
	pune: {
		metroCongestionPerKm: -0.025, metroModeSharePerKm: 0.025,
		busCongestionPer2x: -5, busModeSharePer2x: 6,
		cycleCyclingSharePerKm: 0.03, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.03, cycleCongestionPerKm: -0.01, cycleFatalitiesPerKm: -0.005
	},
	kochi: {
		metroCongestionPerKm: -0.025, metroModeSharePerKm: 0.025,
		busCongestionPer2x: -3.5, busModeSharePer2x: 3.5,
		cycleCyclingSharePerKm: 0.025, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.025, cycleCongestionPerKm: -0.012, cycleFatalitiesPerKm: -0.006
	},
	indore: {
		metroCongestionPerKm: -0.02, metroModeSharePerKm: 0.02,
		busCongestionPer2x: -5, busModeSharePer2x: 5,
		cycleCyclingSharePerKm: 0.03, cycleWalkingSharePerKm: 0.01,
		cycleModeSharePerKm: 0.03, cycleCongestionPerKm: -0.01, cycleFatalitiesPerKm: -0.008
	}
};

// ---- Intervention definitions ----
// NOTE: The `value` fields in effects below are Bengaluru defaults (for display/documentation).
// Actual computation uses city-specific coefficients from CITY_TRANSPORT_COEFFICIENTS.

export const INTERVENTIONS: InterventionDef[] = [
	{
		key: 'metro_km',
		label: 'Metro Expansion',
		icon: 'fa-solid fa-train-subway',
		unit: 'km',
		min: 'city_metro',
		max: 400,
		step: 5,
		defaultValue: 'city_metro',
		effects: [
			{ indicator: 'metro_network_km', mode: 'set', value: 1 },
			{ indicator: 'congestion_level', mode: 'delta_per_unit', value: -0.03, baselineKey: 'metro_network_km' },
			{ indicator: 'sustainable_mode_share', mode: 'delta_per_unit', value: 0.03, baselineKey: 'metro_network_km' }
		]
	},
	{
		key: 'bus_multiplier',
		label: 'Bus Fleet Scale',
		icon: 'fa-solid fa-bus',
		unit: 'x',
		min: 1,
		max: 3,
		step: 0.1,
		defaultValue: 1,
		effects: [
			// bus_fleet_per_lakh = current * multiplier (handled specially)
			{ indicator: 'bus_fleet_per_lakh', mode: 'multiply', value: 1 },
			{ indicator: 'congestion_level', mode: 'delta_per_unit', value: -4, baselineKey: '_bus_multiplier_delta' },
			{ indicator: 'sustainable_mode_share', mode: 'delta_per_unit', value: 4, baselineKey: '_bus_multiplier_delta' }
		]
	},
	{
		key: 'cycle_lanes_km',
		label: 'Cycle Lanes',
		icon: 'fa-solid fa-bicycle',
		unit: 'km',
		min: 0,
		max: 500,
		step: 25,
		defaultValue: 0,
		effects: [
			{ indicator: 'cycling_share', mode: 'delta_per_unit', value: 0.02 },
			{ indicator: 'walking_share', mode: 'delta_per_unit', value: 0.01 },
			{ indicator: 'sustainable_mode_share', mode: 'delta_per_unit', value: 0.02 },
			{ indicator: 'congestion_level', mode: 'delta_per_unit', value: -0.01 },
			{ indicator: 'traffic_fatalities', mode: 'delta_per_unit', value: -0.005 }
		]
	},
	{
		key: 'fleet_electrification_pct',
		label: 'Fleet Electrification',
		icon: 'fa-solid fa-bolt',
		unit: '%',
		min: 0,
		max: 100,
		step: 5,
		defaultValue: 0,
		effects: [
			// pm25 *= (1 - 0.30 * pct/100) — transport ~30% of urban PM2.5
			{ indicator: 'pm25_annual', mode: 'multiply', value: 0.30 }
		]
	},
	{
		key: 'grid_renewables_pct',
		label: 'Grid Renewables',
		icon: 'fa-solid fa-solar-panel',
		unit: '%',
		min: 0,
		max: 100,
		step: 5,
		defaultValue: 0,
		effects: [
			// pm25 *= (1 - 0.15 * pct/100) — power plants ~15% of PM2.5
			{ indicator: 'pm25_annual', mode: 'multiply', value: 0.15 }
		]
	}
];

// ---- Presets ----

export const SCENARIO_PRESETS: ScenarioPreset[] = [
	{
		key: 'reset',
		label: 'Reset',
		group: 'metro-led',
		description: 'Current state — no interventions',
		paperScore: null,
		paperGrade: null,
		values: { metro_km: 0, bus_multiplier: 1, cycle_lanes_km: 0, fleet_electrification_pct: 0, grid_renewables_pct: 0 }
	},
	// Metro-led strategies (ST1x)
	{
		key: 'ST1A',
		label: 'ST1A',
		group: 'metro-led',
		description: 'Metro expansion to 317 km',
		paperScore: 0.613,
		paperGrade: 'A',
		values: { metro_km: 317, bus_multiplier: 1, cycle_lanes_km: 0, fleet_electrification_pct: 0, grid_renewables_pct: 0 }
	},
	{
		key: 'ST1B',
		label: 'ST1B',
		group: 'metro-led',
		description: 'Metro 317 km + fleet electrification + 74% non-renewable grid',
		paperScore: 0.639,
		paperGrade: 'A',
		values: { metro_km: 317, bus_multiplier: 1, cycle_lanes_km: 0, fleet_electrification_pct: 100, grid_renewables_pct: 26 }
	},
	{
		key: 'ST1C',
		label: 'ST1C',
		group: 'metro-led',
		description: 'Metro 317 km + electrification + 50% renewable grid',
		paperScore: 0.647,
		paperGrade: 'A',
		values: { metro_km: 317, bus_multiplier: 1, cycle_lanes_km: 0, fleet_electrification_pct: 100, grid_renewables_pct: 50 }
	},
	{
		key: 'ST1D',
		label: 'ST1D',
		group: 'metro-led',
		description: 'Metro 317 km + electrification + 100% renewable grid',
		paperScore: 0.662,
		paperGrade: 'A',
		values: { metro_km: 317, bus_multiplier: 1, cycle_lanes_km: 0, fleet_electrification_pct: 100, grid_renewables_pct: 100 }
	},
	// Bus + NMT strategies (ST2x)
	{
		key: 'ST2A',
		label: 'ST2A',
		group: 'bus-nmt',
		description: 'Bus fleet 2x + 200 km cycle lanes',
		paperScore: 0.553,
		paperGrade: 'B',
		values: { metro_km: 0, bus_multiplier: 2, cycle_lanes_km: 200, fleet_electrification_pct: 0, grid_renewables_pct: 0 }
	},
	{
		key: 'ST2B',
		label: 'ST2B',
		group: 'bus-nmt',
		description: 'Bus 2x + 200 km cycle + electrification + 74% NR grid',
		paperScore: 0.583,
		paperGrade: 'B',
		values: { metro_km: 0, bus_multiplier: 2, cycle_lanes_km: 200, fleet_electrification_pct: 100, grid_renewables_pct: 26 }
	},
	{
		key: 'ST2C',
		label: 'ST2C',
		group: 'bus-nmt',
		description: 'Bus 2x + 200 km cycle + electrification + 50% renewable',
		paperScore: 0.592,
		paperGrade: 'B',
		values: { metro_km: 0, bus_multiplier: 2, cycle_lanes_km: 200, fleet_electrification_pct: 100, grid_renewables_pct: 50 }
	},
	{
		key: 'ST2D',
		label: 'ST2D',
		group: 'bus-nmt',
		description: 'Bus 2x + 200 km cycle + electrification + 100% renewable',
		paperScore: 0.608,
		paperGrade: 'A',
		values: { metro_km: 0, bus_multiplier: 2, cycle_lanes_km: 200, fleet_electrification_pct: 100, grid_renewables_pct: 100 }
	}
];

// ---- Helpers ----

/** Get a city's baseline indicator value (hardcoded + live overrides). */
function getBaselineValue(
	cityId: string,
	indicatorKey: string,
	overrides?: QoLOverrides
): number | null {
	const overrideVal = overrides?.[cityId]?.[indicatorKey];
	if (overrideVal !== undefined && overrideVal !== null) return overrideVal;

	const cityData = CITY_QOL_DATA.find((c) => c.cityId === cityId);
	return cityData?.values[indicatorKey] ?? null;
}

/** Resolve the city's current metro km for slider defaults/min. */
export function getCityMetroKm(cityId: string, overrides?: QoLOverrides): number {
	return getBaselineValue(cityId, 'metro_network_km', overrides) ?? 0;
}

/** Get default intervention values for a city (all sliders at baseline / no change). */
export function getDefaultInterventions(cityId: string, overrides?: QoLOverrides): InterventionValues {
	const metroKm = getCityMetroKm(cityId, overrides);
	return {
		metro_km: metroKm,
		bus_multiplier: 1,
		cycle_lanes_km: 0,
		fleet_electrification_pct: 0,
		grid_renewables_pct: CITY_GRID_RENEWABLE_BASELINE[cityId] ?? 26
	};
}

/** Resolve preset values for a specific city. Metro "0" and grid_renewables "0" mean "keep current". */
export function resolvePresetForCity(
	preset: ScenarioPreset,
	cityId: string,
	overrides?: QoLOverrides
): InterventionValues {
	const cityMetro = getCityMetroKm(cityId, overrides);
	const cityRenewable = CITY_GRID_RENEWABLE_BASELINE[cityId] ?? 26;
	return {
		...preset.values,
		metro_km: preset.values.metro_km === 0 ? cityMetro : Math.max(preset.values.metro_km, cityMetro),
		grid_renewables_pct:
			preset.values.grid_renewables_pct === 0
				? cityRenewable
				: preset.values.grid_renewables_pct
	};
}

// ---- Core computation ----

/**
 * Compute scenario result by applying intervention effects to baseline values.
 * Feeds modified values into the existing computeCityQoL() engine.
 */
export function computeScenarioResult(
	cityId: string,
	interventions: InterventionValues,
	baselineOverrides?: QoLOverrides
): ScenarioResult | null {
	const baseline = computeCityQoL(cityId, baselineOverrides);
	if (!baseline) return null;

	// Start with baseline values for all indicators
	const modified: Record<string, number | null> = {};
	for (const dim of baseline.dimensions) {
		for (const ind of dim.indicators) {
			modified[ind.key] = ind.value;
		}
	}

	// Get raw baseline values for delta calculations
	const baselineValues: Record<string, number | null> = { ...modified };

	// Apply metro expansion effects
	const metroBaseline = baselineValues.metro_network_km ?? 0;
	const metroDelta = interventions.metro_km - metroBaseline;

	// Apply bus multiplier effects
	const busBaseline = baselineValues.bus_fleet_per_lakh ?? 0;
	const busMultiplierDelta = interventions.bus_multiplier - 1; // delta from 1x

	// Apply cycle lane effects
	const cycleDelta = interventions.cycle_lanes_km;

	// City-specific transport coefficients (fall back to Bengaluru)
	const coeff = CITY_TRANSPORT_COEFFICIENTS[cityId] ?? CITY_TRANSPORT_COEFFICIENTS.bengaluru;

	// Apply each intervention's effects
	for (const intDef of INTERVENTIONS) {
		const sliderValue = interventions[intDef.key as keyof InterventionValues] as number;

		for (const effect of intDef.effects) {
			const currentVal = modified[effect.indicator];
			if (currentVal === null) continue;

			switch (intDef.key) {
				case 'metro_km':
					if (effect.mode === 'set') {
						modified[effect.indicator] = sliderValue;
					} else if (effect.mode === 'delta_per_unit') {
						const metroCoeff = effect.indicator === 'congestion_level'
							? coeff.metroCongestionPerKm
							: coeff.metroModeSharePerKm;
						modified[effect.indicator] = currentVal + metroCoeff * metroDelta;
					}
					break;

				case 'bus_multiplier':
					if (effect.mode === 'multiply') {
						modified[effect.indicator] = busBaseline * sliderValue;
					} else if (effect.mode === 'delta_per_unit') {
						const busCoeff = effect.indicator === 'congestion_level'
							? coeff.busCongestionPer2x
							: coeff.busModeSharePer2x;
						modified[effect.indicator] = currentVal + busCoeff * busMultiplierDelta;
					}
					break;

				case 'cycle_lanes_km':
					if (effect.mode === 'delta_per_unit') {
						const cycleCoeffMap: Record<string, number> = {
							cycling_share: coeff.cycleCyclingSharePerKm,
							walking_share: coeff.cycleWalkingSharePerKm,
							sustainable_mode_share: coeff.cycleModeSharePerKm,
							congestion_level: coeff.cycleCongestionPerKm,
							traffic_fatalities: coeff.cycleFatalitiesPerKm
						};
						const cycleCoeff = cycleCoeffMap[effect.indicator] ?? effect.value;
						modified[effect.indicator] = currentVal + cycleCoeff * cycleDelta;
					}
					break;

				case 'fleet_electrification_pct':
					if (effect.mode === 'multiply' && effect.indicator === 'pm25_annual') {
						// City-specific transport share of PM2.5
						const transportShare = CITY_PM25_COEFFICIENTS[cityId]?.transportShare ?? 0.30;
						const electFactor = 1 - transportShare * (sliderValue / 100);
						modified[effect.indicator] = currentVal * electFactor;
					}
					break;

				case 'grid_renewables_pct':
					if (effect.mode === 'multiply' && effect.indicator === 'pm25_annual') {
						// City-specific power share of PM2.5 + delta from current grid mix
						const powerShare = CITY_PM25_COEFFICIENTS[cityId]?.powerShare ?? 0.15;
						const cityRenewable = CITY_GRID_RENEWABLE_BASELINE[cityId] ?? 26;
						const fossilBaseline = (100 - cityRenewable) / 100;
						const fossilNew = (100 - sliderValue) / 100;
						// If baseline fossil is ~0, renewables slider has no further effect
						const gridFactor = fossilBaseline > 0.01
							? 1 + powerShare * (fossilNew / fossilBaseline - 1)
							: 1;
						modified[effect.indicator] = currentVal * gridFactor;
					}
					break;
			}
		}
	}

	// Clamp all indicators >= 0
	for (const key of Object.keys(modified)) {
		if (modified[key] !== null && modified[key]! < 0) {
			modified[key] = 0;
		}
	}

	// Build scenario overrides and compute score
	const scenarioOverrides: QoLOverrides = {
		...baselineOverrides,
		[cityId]: { ...(baselineOverrides?.[cityId] ?? {}), ...modified }
	};
	const scenario = computeCityQoL(cityId, scenarioOverrides);
	if (!scenario) return null;

	// Build indicator change list
	const indicatorChanges: IndicatorChange[] = [];
	for (const dim of baseline.dimensions) {
		for (const ind of dim.indicators) {
			const baseVal = ind.value;
			const scenarioInd = scenario.dimensions
				.find((d) => d.key === dim.key)
				?.indicators.find((i) => i.key === ind.key);
			const scenVal = scenarioInd?.value ?? null;
			const delta = baseVal !== null && scenVal !== null ? scenVal - baseVal : null;

			indicatorChanges.push({
				key: ind.key,
				label: ind.label,
				unit: ind.unit,
				baseline: baseVal,
				scenario: scenVal,
				delta
			});
		}
	}

	return {
		baseline,
		scenario,
		delta: scenario.composite - baseline.composite,
		gradeChange: `${baseline.grade} \u2192 ${scenario.grade}`,
		indicatorChanges
	};
}
