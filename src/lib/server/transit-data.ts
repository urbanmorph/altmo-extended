/**
 * Server-side transit data fetcher with in-memory cache.
 * Fetches from GitHub sources, transforms, and caches.
 * Runs only on the server (SvelteKit server load functions).
 */

import { getCityById } from '$lib/config/cities';
import {
	parseTransitRouterStops,
	computeRouteCountsFromServices,
	parseNammaMetroGeoJSON,
	computeMetrics,
	type TransitData,
	type TransitMetrics,
	type BusStop
} from '$lib/utils/transit';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}

async function fetchJSON<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.json();
}

/**
 * Fetch and transform all transit data for a city.
 * Returns empty data if city has no transit sources configured.
 */
export async function fetchTransitData(cityId: string): Promise<TransitData> {
	const cacheKey = `transit-${cityId}`;
	const cached = getCached<TransitData>(cacheKey);
	if (cached) return cached;

	const city = getCityById(cityId);
	const sources = city?.transitSources;

	if (!sources) {
		return { busStops: [], metroStations: [], metroLines: [] };
	}

	// Fetch all sources in parallel (with error handling per source)
	const [rawStops, rawServices, metroGeoJSON] = await Promise.all([
		sources.busStops
			? fetchJSON<Record<string, [number, number, string, string, string]>>(sources.busStops).catch((e) => {
					console.error('[transit] Failed to fetch bus stops:', e.message);
					return null;
				})
			: null,
		sources.busServices
			? fetchJSON<Record<string, Record<string, unknown>>>(sources.busServices).catch((e) => {
					console.error('[transit] Failed to fetch bus services:', e.message);
					return null;
				})
			: null,
		sources.metroStations
			? fetchJSON<GeoJSON.FeatureCollection>(sources.metroStations).catch((e) => {
					console.error('[transit] Failed to fetch metro data:', e.message);
					return null;
				})
			: null
	]);

	// Parse bus stops and compute route counts
	let busStops: BusStop[] = [];
	if (rawStops) {
		const parsedStops = parseTransitRouterStops(rawStops);
		const routeCounts = rawServices
			? computeRouteCountsFromServices(rawServices as Record<string, { name: string; [k: string]: string | string[][] }>)
			: new Map<string, number>();

		busStops = parsedStops.map((s) => ({
			...s,
			routeCount: routeCounts.get(s.id) ?? 0
		}));
	}

	// Parse metro data
	const metro = metroGeoJSON
		? parseNammaMetroGeoJSON(metroGeoJSON)
		: { stations: [], lines: [] };

	const data: TransitData = {
		busStops,
		metroStations: metro.stations,
		metroLines: metro.lines
	};

	console.log(`[transit] ${cityId}: ${busStops.length} bus stops, ${metro.stations.length} metro stations, ${metro.lines.length} metro lines`);

	setCache(cacheKey, data);
	return data;
}

/**
 * Fetch transit data and compute aggregate metrics.
 * Used by the Pulse/Transit dashboard.
 */
export async function fetchTransitMetrics(cityId: string): Promise<{
	data: TransitData;
	metrics: TransitMetrics;
}> {
	const cacheKey = `transit-metrics-${cityId}`;
	const cached = getCached<{ data: TransitData; metrics: TransitMetrics }>(cacheKey);
	if (cached) return cached;

	const city = getCityById(cityId);
	const sources = city?.transitSources;

	// Count total bus routes from services data
	let totalBusRoutes = 0;
	if (sources?.busServices) {
		const rawServices = await fetchJSON<Record<string, unknown>>(sources.busServices);
		totalBusRoutes = Object.keys(rawServices).length;
	}

	const data = await fetchTransitData(cityId);
	const metrics = computeMetrics(data, totalBusRoutes);

	const result = { data, metrics };
	setCache(cacheKey, result);
	return result;
}
