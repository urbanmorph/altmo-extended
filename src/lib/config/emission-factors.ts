/**
 * Per-city CO2 emission factors for active mobility substitution.
 *
 * Methodology:
 *   1. From ETQOLI city-qol-data.ts, extract each city's mode shares:
 *      - walking_share, cycling_share, sustainable_mode_share (from Census/CMP/CTTS)
 *      - Public transit share = sustainable_mode_share - walking_share - cycling_share
 *      - Private motorized share = 100 - sustainable_mode_share
 *
 *   2. Split private motorized into car/taxi, two-wheeler, auto-rickshaw
 *      using city CMP reports and vehicle registration data.
 *
 *   3. For Altmo's user base (employer-affiliated, Strava-connected), apply a
 *      substitution adjustment: these users skew toward car/taxi replacement
 *      (~1.5x city average car share) since they are typically corporate employees.
 *
 *   4. Compute weighted CO2 factor:
 *      factor = Σ (substitution_share × vehicle_emission_rate)
 *
 * Vehicle emission rates (India):
 *   - Car/taxi:        0.142 kg/km  (BEE India average passenger car)
 *   - Two-wheeler:     0.045 kg/km  (BEE India average)
 *   - Auto-rickshaw:   0.060 kg/km  (CNG/petrol three-wheeler)
 *   - Bus/metro:       0.025 kg/km  (per passenger-km, net saving if replaced)
 *   - New/no trip:     0.000 kg/km  (trip wouldn't have happened)
 *
 * Sources:
 *   - Bureau of Energy Efficiency (BEE) India fuel economy standards
 *   - City CMP/CTTS reports (mode shares) — same as ETQOLI indicators
 *   - IPCC AR6 Chapter 10 (transport emission factors)
 *   - European Cyclists' Federation lifecycle analysis (cross-reference)
 */

interface CityEmissionProfile {
	/** Weighted CO2 avoided per km of active mobility (kg/km) */
	co2KgPerKm: number;
	/** Mode substitution assumptions for this city (% of active trips replacing each mode) */
	substitution: {
		car: number;
		twoWheeler: number;
		auto: number;
		transit: number;
		newTrip: number;
	};
	/** Source notes */
	source: string;
}

// Vehicle emission rates (kg CO2 per km)
const RATES = {
	car: 0.142,
	twoWheeler: 0.045,
	auto: 0.060,
	transit: 0.025,
	newTrip: 0,
} as const;

function computeFactor(sub: CityEmissionProfile['substitution']): number {
	return Math.round((
		sub.car * RATES.car +
		sub.twoWheeler * RATES.twoWheeler +
		sub.auto * RATES.auto +
		sub.transit * RATES.transit +
		sub.newTrip * RATES.newTrip
	) * 10000) / 10000; // 4 decimal places
}

/**
 * Per-city emission profiles derived from ETQOLI mode share data.
 *
 * Private motorized split estimated from city CMP vehicle registration data:
 * - IT/services cities (Bengaluru, Hyderabad, Pune): higher car share
 * - Two-wheeler dominant (Chennai, Indore, Ahmedabad): higher 2W share
 * - Metro cities with transit (Delhi, Mumbai, Kolkata): moderate car, higher transit substitution
 */
const CITY_PROFILES: Record<string, CityEmissionProfile> = {
	ahmedabad: {
		// Motorized 57%: Gujarat has high two-wheeler ownership
		// Altmo substitution: car 40%, 2W 35%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.40, twoWheeler: 0.35, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'CEPT CTTS 2019: sustainable 43% (walk 24 + cycle 8 + transit 11)',
	},
	bengaluru: {
		// Motorized 52%: IT city, high car ownership among corporate employees
		// Altmo substitution: car 50%, 2W 25%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.50, twoWheeler: 0.25, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'CMP 2020: sustainable 48% (walk 22 + cycle 5 + transit 21)',
	},
	chennai: {
		// Motorized 48%: Strong two-wheeler culture (highest in India)
		// Altmo substitution: car 35%, 2W 40%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.35, twoWheeler: 0.40, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'CTTS: sustainable 52% (walk 24 + cycle 4 + transit 24)',
	},
	delhi: {
		// Motorized 60%: Car + two-wheeler dominant, highest motorized share
		// Altmo substitution: car 45%, 2W 30%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.45, twoWheeler: 0.30, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'Regional pop-weighted: sustainable 40% (walk 15 + cycle 5 + transit 20)',
	},
	hyderabad: {
		// Motorized 54%: IT city, growing car ownership
		// Altmo substitution: car 45%, 2W 30%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.45, twoWheeler: 0.30, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'CMP: sustainable 46% (walk 20 + cycle 5 + transit 21)',
	},
	indore: {
		// Motorized 63%: Highest motorized, strong two-wheeler culture
		// Altmo substitution: car 35%, 2W 40%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.35, twoWheeler: 0.40, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'CMP: sustainable 37% (walk 22 + cycle 5 + bus 10)',
	},
	kochi: {
		// Motorized 58%: High auto-rickshaw usage in Kerala
		// Altmo substitution: car 35%, 2W 25%, auto 20%, transit 5%, new 15%
		substitution: { car: 0.35, twoWheeler: 0.25, auto: 0.20, transit: 0.05, newTrip: 0.15 },
		co2KgPerKm: 0,
		source: 'CMP: sustainable 42% (walk 22 + cycle 5 + transit 15)',
	},
	kolkata: {
		// Motorized 23%: Highest sustainable mode share, strong transit culture
		// Altmo substitution: car 30%, 2W 20%, auto 15%, transit 15%, new 20%
		substitution: { car: 0.30, twoWheeler: 0.20, auto: 0.15, transit: 0.15, newTrip: 0.20 },
		co2KgPerKm: 0,
		source: 'Regional: sustainable 77% (walk 37 + cycle 9 + transit 31)',
	},
	mumbai: {
		// Motorized 49%: Strong suburban rail, but high car use in suburbs
		// Altmo substitution: car 40%, 2W 25%, auto 15%, transit 10%, new 10%
		substitution: { car: 0.40, twoWheeler: 0.25, auto: 0.15, transit: 0.10, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'Regional: sustainable 51% (walk 25 + cycle 3 + transit 23)',
	},
	pune: {
		// Motorized 53%: High two-wheeler + growing car ownership, IT sector
		// Altmo substitution: car 45%, 2W 30%, auto 10%, transit 5%, new 10%
		substitution: { car: 0.45, twoWheeler: 0.30, auto: 0.10, transit: 0.05, newTrip: 0.10 },
		co2KgPerKm: 0,
		source: 'Regional: sustainable 47% (walk 23 + cycle 13 + transit 11)',
	},
};

// Compute the weighted CO2 factor for each city
for (const [, profile] of Object.entries(CITY_PROFILES)) {
	profile.co2KgPerKm = computeFactor(profile.substitution);
}

/** Default factor for cities without a specific profile */
const DEFAULT_CO2_FACTOR = 0.085;

/**
 * Get CO2 emission factor (kg/km) for a city.
 * Uses city-specific mode substitution data from CMP/ETQOLI.
 */
export function getCityEmissionFactor(cityId: string): number {
	return CITY_PROFILES[cityId]?.co2KgPerKm ?? DEFAULT_CO2_FACTOR;
}

/**
 * Get the full emission profile for a city (factor + substitution breakdown).
 */
export function getCityEmissionProfile(cityId: string): CityEmissionProfile | null {
	return CITY_PROFILES[cityId] ?? null;
}

/**
 * Compute CO2 avoided (kg) for a given distance in a city.
 */
export function computeCO2Avoided(cityId: string, distanceKm: number): number {
	return Math.round(distanceKm * getCityEmissionFactor(cityId));
}
