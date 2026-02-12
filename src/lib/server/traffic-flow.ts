/**
 * Server-side TomTom Traffic Flow fetcher with in-memory cache.
 * Fetches congestion data from TomTom Flow Segment Data API, caches for 24h.
 * Same pattern as air-quality.ts.
 *
 * API: https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
 * Returns currentSpeed + freeFlowSpeed per road segment.
 * congestionPct = ((freeFlowSpeed / currentSpeed) - 1) * 100
 */

import { env } from '$env/dynamic/private';
import { CITY_TRAFFIC_POINTS, type CongestionData } from '$lib/config/traffic-flow';

const TOMTOM_BASE = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
	data: CongestionData | null;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();

interface TomTomFlowResponse {
	flowSegmentData: {
		currentSpeed: number;
		freeFlowSpeed: number;
		currentTravelTime: number;
		freeFlowTravelTime: number;
		confidence: number;
	};
}

/**
 * Fetch traffic flow data for a single sample point.
 * Returns { currentSpeed, freeFlowSpeed } or null on failure.
 */
async function fetchPointFlow(
	lat: number,
	lng: number
): Promise<{ currentSpeed: number; freeFlowSpeed: number } | null> {
	const apiKey = env.TOMTOM_API_KEY;
	if (!apiKey) return null;

	try {
		const url = `${TOMTOM_BASE}?point=${lat},${lng}&key=${apiKey}&unit=KMPH`;
		const res = await fetch(url);
		if (!res.ok) return null;

		const json = (await res.json()) as TomTomFlowResponse;
		const { currentSpeed, freeFlowSpeed } = json.flowSegmentData;

		if (currentSpeed > 0 && freeFlowSpeed > 0) {
			return { currentSpeed, freeFlowSpeed };
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Fetch congestion data for a city by averaging across sample arterial points.
 * Uses 24h in-memory cache.
 */
export async function getCityCongestion(cityId: string): Promise<CongestionData | null> {
	const cached = cache.get(cityId);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data;
	}

	const cityConfig = CITY_TRAFFIC_POINTS[cityId];
	if (!cityConfig) return null;

	const results = await Promise.all(
		cityConfig.samplePoints.map((pt) => fetchPointFlow(pt.lat, pt.lng))
	);

	const validResults = results.filter(
		(r): r is { currentSpeed: number; freeFlowSpeed: number } => r !== null
	);

	if (validResults.length === 0) {
		cache.set(cityId, { data: null, timestamp: Date.now() });
		return null;
	}

	const avgCurrentSpeed =
		validResults.reduce((sum, r) => sum + r.currentSpeed, 0) / validResults.length;
	const avgFreeFlowSpeed =
		validResults.reduce((sum, r) => sum + r.freeFlowSpeed, 0) / validResults.length;

	// congestionPct = % extra travel time = ((freeFlow / current) - 1) * 100
	const congestionPct =
		Math.round(((avgFreeFlowSpeed / avgCurrentSpeed) - 1) * 100 * 10) / 10;

	const data: CongestionData = {
		congestionPct: Math.max(0, congestionPct), // floor at 0 — no negative congestion
		avgCurrentSpeed: Math.round(avgCurrentSpeed * 10) / 10,
		avgFreeFlowSpeed: Math.round(avgFreeFlowSpeed * 10) / 10,
		pointsReporting: validResults.length
	};

	cache.set(cityId, { data, timestamp: Date.now() });
	return data;
}

/**
 * Fetch congestion data for all configured cities.
 */
export async function getAllCityCongestion(): Promise<Record<string, CongestionData | null>> {
	const cityIds = Object.keys(CITY_TRAFFIC_POINTS);
	const results = await Promise.all(
		cityIds.map(async (id) => ({ id, data: await getCityCongestion(id) }))
	);
	return Object.fromEntries(results.map((r) => [r.id, r.data]));
}
