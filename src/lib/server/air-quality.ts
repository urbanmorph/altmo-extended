/**
 * Server-side air quality fetcher with in-memory cache.
 * Fetches PM2.5 data from OpenAQ v3 API, caches for 24h.
 * Same pattern as transit-data.ts.
 */

import { env } from '$env/dynamic/private';
import { CITY_OPENAQ_LOCATIONS, type CityPM25 } from '$lib/config/air-quality';

const OPENAQ_BASE_URL = 'https://api.openaq.org/v3';
const PM25_PARAMETER_ID = 2;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
	data: CityPM25 | null;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();

interface OpenAQMeasurementsResponse {
	results: Array<{
		value: number;
		location: { id: number; name: string };
	}>;
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

async function fetchLocationPM25(
	locationId: number,
	dateFrom: string,
	dateTo: string
): Promise<number[]> {
	try {
		const data = await openaqFetch<OpenAQMeasurementsResponse>(
			`/measurements?locations_id=${locationId}&parameters_id=${PM25_PARAMETER_ID}&date_from=${dateFrom}&date_to=${dateTo}&limit=1000`
		);
		return data.results.map((r) => r.value).filter((v) => v != null && v >= 0 && v < 1000);
	} catch {
		return [];
	}
}

/**
 * Fetch latest PM2.5 for a city (last 24h), with 24h in-memory cache.
 */
export async function getCityPM25(cityId: string): Promise<CityPM25 | null> {
	const cached = cache.get(cityId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const cityConfig = CITY_OPENAQ_LOCATIONS[cityId];
	if (!cityConfig) return null;

	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	const dateFrom = yesterday.toISOString();
	const dateTo = now.toISOString();

	const results = await Promise.all(
		cityConfig.locationIds.map((id) => fetchLocationPM25(id, dateFrom, dateTo))
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
	const cityIds = Object.keys(CITY_OPENAQ_LOCATIONS);
	const results = await Promise.all(
		cityIds.map(async (id) => ({ id, data: await getCityPM25(id) }))
	);
	return Object.fromEntries(results.map((r) => [r.id, r.data]));
}
