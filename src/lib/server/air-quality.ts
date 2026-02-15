/**
 * Server-side air quality fetcher with in-memory cache.
 * Fetches PM2.5 data from OpenAQ v3 API (sensor-based endpoints), caches for 24h.
 * Same pattern as transit-data.ts.
 */

import { env } from '$env/dynamic/private';
import { CITY_OPENAQ_SENSORS, CITY_OPENAQ_NO2_SENSORS, PM25_FALLBACK, type CityPM25, type CityNO2 } from '$lib/config/air-quality';

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
 * Falls back to CPCB 2023 annual averages if OpenAQ is unavailable.
 */
export async function getCityPM25(cityId: string): Promise<CityPM25 | null> {
	const cached = cache.get(cityId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const cityConfig = CITY_OPENAQ_SENSORS[cityId];
	const fallback = PM25_FALLBACK[cityId] ?? null;

	if (!cityConfig || cityConfig.sensorIds.length === 0) {
		// No sensors configured — use fallback
		cache.set(cityId, { data: fallback, timestamp: Date.now() });
		return fallback;
	}

	try {
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

		if (allValues.length > 0) {
			const data: CityPM25 = {
				pm25Avg: Math.round((allValues.reduce((s, v) => s + v, 0) / allValues.length) * 100) / 100,
				pm25Max: Math.round(Math.max(...allValues) * 100) / 100,
				stationsReporting,
				readings: allValues.length
			};
			cache.set(cityId, { data, timestamp: Date.now() });
			return data;
		}
	} catch {
		// API error (auth, network, etc.) — fall through to fallback
	}

	// All sensors returned empty or API failed — use fallback
	if (fallback) {
		console.warn(`[air-quality] OpenAQ unavailable for ${cityId}, using CPCB 2023 fallback`);
	}
	cache.set(cityId, { data: fallback, timestamp: Date.now() });
	return fallback;
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

// ---- NO2 fetcher (same pattern as PM2.5) ----

const no2Cache = new Map<string, { data: CityNO2 | null; timestamp: number }>();

/**
 * Fetch recent NO2 readings from a single sensor.
 */
async function fetchSensorNO2(sensorId: number): Promise<number[]> {
	try {
		const data = await openaqFetch<OpenAQSensorResponse>(
			`/sensors/${sensorId}/measurements?limit=100`
		);
		return data.results
			.map((r) => r.value)
			.filter((v) => v != null && v >= 0 && v < 500);
	} catch {
		return [];
	}
}

/**
 * Fetch latest NO2 for a city, with 24h in-memory cache.
 * Returns null if no sensors configured or no data available.
 */
export async function getCityNO2(cityId: string): Promise<CityNO2 | null> {
	const cached = no2Cache.get(cityId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const cityConfig = CITY_OPENAQ_NO2_SENSORS[cityId];
	if (!cityConfig || cityConfig.sensorIds.length === 0) return null;

	const results = await Promise.all(
		cityConfig.sensorIds.map((id) => fetchSensorNO2(id))
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
					no2Avg: Math.round((allValues.reduce((s, v) => s + v, 0) / allValues.length) * 100) / 100,
					no2Max: Math.round(Math.max(...allValues) * 100) / 100,
					stationsReporting,
					readings: allValues.length
				}
			: null;

	no2Cache.set(cityId, { data, timestamp: Date.now() });
	return data;
}

/**
 * Fetch NO2 for all configured cities.
 */
export async function getAllCityNO2(): Promise<Record<string, CityNO2 | null>> {
	const cityIds = Object.keys(CITY_OPENAQ_NO2_SENSORS);
	const results = await Promise.all(
		cityIds.map(async (id) => ({ id, data: await getCityNO2(id) }))
	);
	return Object.fromEntries(results.map((r) => [r.id, r.data]));
}
