/**
 * OpenAQ air quality configuration and helpers.
 * Maps Altmo cities to OpenAQ v3 monitoring station location IDs,
 * defines WHO/NAAQS PM2.5 thresholds, and provides a server-side
 * helper to fetch the latest PM2.5 readings for a city.
 *
 * OpenAQ v3 API docs: https://docs.openaq.org/
 * parameters_id=2 corresponds to PM2.5.
 */

import { env } from '$env/dynamic/private';

const OPENAQ_BASE_URL = 'https://api.openaq.org/v3';

/** PM2.5 parameter ID in OpenAQ */
const PM25_PARAMETER_ID = 2;

/**
 * OpenAQ location IDs for PM2.5 monitoring stations near each Altmo city.
 * Discovered via: GET /v3/locations?coordinates={lat},{lng}&radius=25000&parameters_id=2&limit=10
 * Each city maps to multiple stations for better coverage and averaging.
 */
export const CITY_OPENAQ_LOCATIONS: Record<string, { name: string; locationIds: number[] }> = {
	bengaluru: {
		name: 'Bengaluru',
		locationIds: [412, 594, 2592, 6973, 6974, 6975, 6983]
	},
	chennai: {
		name: 'Chennai',
		locationIds: [378, 2549, 2586, 5655, 10780, 11578, 11579, 11581]
	},
	delhi: {
		name: 'Delhi',
		locationIds: [13, 15, 16, 17, 50, 103, 235, 236, 431, 2503]
	},
	hyderabad: {
		name: 'Hyderabad',
		locationIds: [407, 2594, 5599, 5623, 5647, 344103, 344104, 344140]
	},
	indore: {
		name: 'Indore',
		locationIds: [5603, 3409414, 3409498, 3409499, 3409500, 3409501]
	},
	kochi: {
		name: 'Kochi',
		locationIds: [6966, 8916, 10916]
	},
	pune: {
		name: 'Pune',
		locationIds: [2585, 5661, 11608, 11609, 11610, 11613, 12042, 60658, 60660]
	}
};

/**
 * PM2.5 reference thresholds (ug/m3).
 * WHO 2021 annual guideline: 5 ug/m3, 24-hour guideline: 15 ug/m3
 * India NAAQS annual standard: 40 ug/m3, 24-hour standard: 60 ug/m3
 */
export const PM25_THRESHOLDS = {
	who: {
		annual: 5,
		daily: 15,
		label: 'WHO 2021 Guideline'
	},
	naaqs: {
		annual: 40,
		daily: 60,
		label: 'India NAAQS Standard'
	}
} as const;

/**
 * AQI breakpoints for PM2.5 (India National AQI categories).
 * Used to classify daily PM2.5 averages into categories.
 */
export const PM25_AQI_CATEGORIES = [
	{ min: 0, max: 30, label: 'Good', color: '#01AA14' },
	{ min: 31, max: 60, label: 'Satisfactory', color: '#C2ED61' },
	{ min: 61, max: 90, label: 'Moderate', color: '#FFB31C' },
	{ min: 91, max: 120, label: 'Poor', color: '#FF7B27' },
	{ min: 121, max: 250, label: 'Very Poor', color: '#dc2626' },
	{ min: 251, max: Infinity, label: 'Severe', color: '#7f1d1d' }
] as const;

/**
 * Get the AQI category for a given PM2.5 value.
 */
export function getPM25Category(pm25: number): { label: string; color: string } {
	for (const cat of PM25_AQI_CATEGORIES) {
		if (pm25 >= cat.min && pm25 <= cat.max) {
			return { label: cat.label, color: cat.color };
		}
	}
	return { label: 'Unknown', color: '#999999' };
}

/** Shape of a single OpenAQ v3 measurement result */
interface OpenAQMeasurement {
	value: number;
	period: {
		datetimeFrom: { utc: string };
		datetimeTo: { utc: string };
	};
	parameter: {
		id: number;
		name: string;
		units: string;
	};
	location: {
		id: number;
		name: string;
	};
}

interface OpenAQMeasurementsResponse {
	results: OpenAQMeasurement[];
	meta: { found: number; limit: number; page: number };
}

/**
 * Fetch OpenAQ v3 API with authentication.
 * Uses OPENAQ_API_KEY from environment (via $env/dynamic/private).
 */
async function openaqFetch<T>(path: string): Promise<T> {
	const apiKey = env.OPENAQ_API_KEY;
	if (!apiKey) {
		throw new Error('OPENAQ_API_KEY environment variable is not set');
	}

	const url = `${OPENAQ_BASE_URL}${path}`;
	const res = await fetch(url, {
		headers: {
			'X-API-Key': apiKey,
			'Accept': 'application/json'
		}
	});

	if (!res.ok) {
		throw new Error(`OpenAQ API error: ${res.status} ${res.statusText} for ${url}`);
	}

	return res.json() as Promise<T>;
}

/**
 * Fetch latest PM2.5 measurements for a single OpenAQ location.
 * Queries the last 24 hours of data.
 *
 * @param locationId - OpenAQ location ID
 * @param dateFrom - ISO date string for start of period
 * @param dateTo - ISO date string for end of period
 */
export async function fetchPM25ForLocation(
	locationId: number,
	dateFrom: string,
	dateTo: string
): Promise<{ values: number[]; stationName: string }> {
	try {
		const data = await openaqFetch<OpenAQMeasurementsResponse>(
			`/measurements?locations_id=${locationId}&parameters_id=${PM25_PARAMETER_ID}&date_from=${dateFrom}&date_to=${dateTo}&limit=1000`
		);

		const values = data.results
			.map((r) => r.value)
			.filter((v) => v != null && v >= 0 && v < 1000); // Filter obviously invalid readings

		const stationName = data.results[0]?.location?.name ?? `Location ${locationId}`;

		return { values, stationName };
	} catch (err) {
		console.error(`[air-quality] Failed to fetch location ${locationId}:`, (err as Error).message);
		return { values: [], stationName: `Location ${locationId}` };
	}
}

/**
 * Fetch latest PM2.5 for all stations in a city and compute aggregates.
 *
 * @param cityId - Altmo city ID (e.g., 'bengaluru')
 * @param dateFrom - ISO date string for start of period
 * @param dateTo - ISO date string for end of period
 * @returns Aggregated PM2.5 metrics or null if no data available
 */
export async function fetchCityPM25(
	cityId: string,
	dateFrom: string,
	dateTo: string
): Promise<{
	pm25Avg: number;
	pm25Max: number;
	stationsReporting: number;
	readings: number;
} | null> {
	const cityConfig = CITY_OPENAQ_LOCATIONS[cityId];
	if (!cityConfig) {
		console.warn(`[air-quality] No OpenAQ locations configured for city: ${cityId}`);
		return null;
	}

	// Fetch all stations in parallel
	const results = await Promise.all(
		cityConfig.locationIds.map((id) => fetchPM25ForLocation(id, dateFrom, dateTo))
	);

	// Collect all valid readings across all stations
	const allValues: number[] = [];
	let stationsReporting = 0;

	for (const result of results) {
		if (result.values.length > 0) {
			allValues.push(...result.values);
			stationsReporting++;
		}
	}

	if (allValues.length === 0) {
		console.warn(`[air-quality] No PM2.5 data available for ${cityId} (${dateFrom} to ${dateTo})`);
		return null;
	}

	const pm25Avg = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
	const pm25Max = Math.max(...allValues);

	return {
		pm25Avg: Math.round(pm25Avg * 100) / 100,
		pm25Max: Math.round(pm25Max * 100) / 100,
		stationsReporting,
		readings: allValues.length
	};
}
