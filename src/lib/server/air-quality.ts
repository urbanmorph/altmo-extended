/**
 * Server-side air quality fetcher with in-memory cache.
 * Fetches PM2.5 data from OpenAQ v3 API (sensor-based endpoints), caches for 24h.
 * Same pattern as transit-data.ts.
 */

import { env } from '$env/dynamic/private';
import { CITY_OPENAQ_SENSORS, type CityPM25 } from '$lib/config/air-quality';

const OPENAQ_BASE_URL = 'https://api.openaq.org/v3';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
	data: CityPM25 | null;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();

interface OpenAQSensorMeasurement {
	value: number;
	parameter: { id: number; name: string };
	period: {
		datetimeFrom: { utc: string };
		datetimeTo: { utc: string };
	};
}

interface OpenAQSensorResponse {
	results: OpenAQSensorMeasurement[];
}

async function openaqFetch<T>(path: string): Promise<T> {
	const apiKey = env.OPENAQ_API_KEY;
	if (!apiKey) throw new Error('OPENAQ_API_KEY not set');

	const res = await fetch(`${OPENAQ_BASE_URL}${path}`, {
		headers: { 'X-API-Key': apiKey, Accept: 'application/json' }
	});

	if (!res.ok) {
		throw new Error(`OpenAQ API ${res.status}: ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

/**
 * Fetch recent PM2.5 readings from a single sensor.
 * v3 endpoint: /sensors/{sensorId}/measurements
 */
async function fetchSensorPM25(sensorId: number): Promise<number[]> {
	try {
		const data = await openaqFetch<OpenAQSensorResponse>(
			`/sensors/${sensorId}/measurements?limit=100`
		);
		return data.results
			.map((r) => r.value)
			.filter((v) => v != null && v >= 0 && v < 1000);
	} catch {
		return [];
	}
}

/**
 * Fetch latest PM2.5 for a city (recent readings), with 24h in-memory cache.
 */
export async function getCityPM25(cityId: string): Promise<CityPM25 | null> {
	const cached = cache.get(cityId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const cityConfig = CITY_OPENAQ_SENSORS[cityId];
	if (!cityConfig) return null;

	const results = await Promise.all(
		cityConfig.sensorIds.map((id) => fetchSensorPM25(id))
	);

	const allValues: number[] = [];
	let stationsReporting = 0;
	for (const values of results) {
		if (values.length > 0) {
			allValues.push(...values);
			stationsReporting++;
		}
	}

	const data =
		allValues.length > 0
			? {
					pm25Avg: Math.round((allValues.reduce((s, v) => s + v, 0) / allValues.length) * 100) / 100,
					pm25Max: Math.round(Math.max(...allValues) * 100) / 100,
					stationsReporting,
					readings: allValues.length
				}
			: null;

	cache.set(cityId, { data, timestamp: Date.now() });
	return data;
}

/**
 * Fetch PM2.5 for all configured cities.
 */
export async function getAllCityPM25(): Promise<Record<string, CityPM25 | null>> {
	const cityIds = Object.keys(CITY_OPENAQ_SENSORS);
	const results = await Promise.all(
		cityIds.map(async (id) => ({ id, data: await getCityPM25(id) }))
	);
	return Object.fromEntries(results.map((r) => [r.id, r.data]));
}
