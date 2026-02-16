import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { railsApi } from '$lib/rails-api';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { getGeoMarkers } from '$lib/server/altmo-core';
import { getStaticTransitData } from '$lib/server/transit-static';
import { getCityById } from '$lib/config/cities';
import { latLngToCell } from 'h3-js';
import { getRailsPool } from '$lib/server/rails-db';

/**
 * Actual response shape from Rails /routes/bulk endpoint (verified 2026-02-14):
 *   { success, data: { routes: [...], paginationMeta: { currentPage, totalPages, totalCount, hasNextPage } } }
 */
interface BulkRoutesResponse {
	success: boolean;
	data: {
		routes: RawRoute[];
		paginationMeta: {
			currentPage: number;
			perPage: number | null;
			totalPages: number;
			totalCount: number;
			hasNextPage: boolean;
			hasPrevPage: boolean;
		};
	};
}

interface RawRoute {
	activity_id: number;
	activity_type: string | null;
	start_date: string | null;
	distance: number | null;
	moving_time: number | null;
	start_lat: number | null;
	start_lng: number | null;
	end_lat: number | null;
	end_lng: number | null;
	direction: string | null;
	company_id: number | null;
	city_id: number | null;
	user_id: number | null;
	path: [number, number][] | null;
}

// ── Direction normalization ──

function normalizeDirection(dir: string | null | undefined): 'to_work' | 'from_work' | 'leisure' {
	if (!dir) return 'leisure';
	if (dir === 'to_destination' || dir === 'to_work') return 'to_work';
	if (dir === 'from_destination' || dir === 'from_work') return 'from_work';
	return 'leisure';
}

function normalizeActivityType(type: string | null | undefined): 'Ride' | 'Walk' | 'Run' | 'Unknown' {
	if (!type) return 'Unknown';
	const lower = type.toLowerCase();
	if (lower === 'ride') return 'Ride';
	if (lower === 'walk') return 'Walk';
	if (lower === 'run') return 'Run';
	return 'Unknown';
}

// ── Distance buckets ──

const DISTANCE_BUCKETS = [
	{ label: '0-2 km', min: 0, max: 2000 },
	{ label: '2-5 km', min: 2000, max: 5000 },
	{ label: '5-10 km', min: 5000, max: 10000 },
	{ label: '10-20 km', min: 10000, max: 20000 },
	{ label: '20+ km', min: 20000, max: Infinity }
];

function getDistanceBucket(distM: number): string {
	for (const b of DISTANCE_BUCKETS) {
		if (distM >= b.min && distM < b.max) return b.label;
	}
	return '20+ km';
}

// ── Corridor bucketing (~1km precision = 2 decimal places) ──

function corridorKey(sLat: number, sLng: number, eLat: number, eLng: number): string | null {
	const s1 = Math.round(sLat * 100) / 100;
	const s2 = Math.round(sLng * 100) / 100;
	const e1 = Math.round(eLat * 100) / 100;
	const e2 = Math.round(eLng * 100) / 100;
	if (!s1 || !s2 || !e1 || !e2) return null;
	return `${s1},${s2}-${e1},${e2}`;
}

/**
 * Build company_id -> city_id lookup from geo_markers.
 */
async function buildCompanyCityLookup(): Promise<Map<number, number>> {
	const markers = await getGeoMarkers();
	const lookup = new Map<number, number>();
	if (!markers) return lookup;
	for (const m of markers) {
		if (m.type === 'Company' && m.cityId && m.associableId) {
			lookup.set(m.associableId, m.cityId);
		}
	}
	return lookup;
}

/**
 * Map of Rails city_id -> { lat, lng } for coordinate-based city assignment.
 * Used when a route has no company_id (e.g., leisure/recreational rides).
 */
const CITY_COORDS: { id: number; lat: number; lng: number }[] = [
	{ id: 18220, lat: 23.0225, lng: 72.5714 },  // Ahmedabad
	{ id: 18326, lat: 12.9716, lng: 77.5946 },  // Bengaluru
	{ id: 18586, lat: 13.0827, lng: 80.2707 },  // Chennai
	{ id: 18215, lat: 28.6139, lng: 77.2090 },  // Delhi
	{ id: 18629, lat: 17.3850, lng: 78.4867 },  // Hyderabad
	{ id: 18396, lat: 22.7196, lng: 75.8577 },  // Indore
	{ id: 18363, lat: 9.9312, lng: 76.2673 },   // Kochi
	{ id: 18445, lat: 19.0760, lng: 72.8777 },  // Mumbai
	{ id: 18455, lat: 18.5204, lng: 73.8567 },  // Pune
];

const MAX_CITY_RADIUS_KM = 50; // Only assign if within 50km of city center

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestCityId(lat: number, lng: number): number | null {
	let best: { id: number; dist: number } | null = null;
	for (const c of CITY_COORDS) {
		const d = haversineKm(lat, lng, c.lat, c.lng);
		if (d < MAX_CITY_RADIUS_KM && (!best || d < best.dist)) {
			best = { id: c.id, dist: d };
		}
	}
	return best?.id ?? null;
}

// ── Monthly aggregation state ──

interface MonthlyAgg {
	totalTrips: number;
	rides: number;
	walks: number;
	runs: number;
	toWork: number;
	fromWork: number;
	leisure: number;
	commuteRides: number;
	commuteWalks: number;
	commuteRuns: number;
	leisureRides: number;
	leisureWalks: number;
	leisureRuns: number;
	totalDistanceM: number;
	hourly: number[];
	hourlyCommute: number[];
	hourlyLeisure: number[];
	weekday: { count: number; distKm: number }[];
	weekdayLeisure: { count: number; distKm: number }[];
	distBuckets: Map<string, number>;
	corridors: Map<string, { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }>;
	corridorsCommute: Map<string, { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }>;
	corridorsLeisure: Map<string, { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }>;
}

function newMonthlyAgg(): MonthlyAgg {
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return {
		totalTrips: 0, rides: 0, walks: 0, runs: 0,
		toWork: 0, fromWork: 0, leisure: 0,
		commuteRides: 0, commuteWalks: 0, commuteRuns: 0,
		leisureRides: 0, leisureWalks: 0, leisureRuns: 0,
		totalDistanceM: 0,
		hourly: new Array(24).fill(0),
		hourlyCommute: new Array(24).fill(0),
		hourlyLeisure: new Array(24).fill(0),
		weekday: DAYS.map(() => ({ count: 0, distKm: 0 })),
		weekdayLeisure: DAYS.map(() => ({ count: 0, distKm: 0 })),
		distBuckets: new Map(),
		corridors: new Map(),
		corridorsCommute: new Map(),
		corridorsLeisure: new Map()
	};
}

function addToCorridor(
	map: Map<string, { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }>,
	key: string,
	sLat: number, sLng: number, eLat: number, eLng: number,
	dist: number, mode: string
) {
	const existing = map.get(key);
	if (existing) {
		existing.count++;
		existing.totalDist += dist;
		existing.modes.set(mode, (existing.modes.get(mode) ?? 0) + 1);
	} else {
		const modes = new Map<string, number>();
		modes.set(mode, 1);
		map.set(key, { count: 1, totalDist: dist, modes, sLat: Math.round(sLat * 100) / 100, sLng: Math.round(sLng * 100) / 100, eLat: Math.round(eLat * 100) / 100, eLng: Math.round(eLng * 100) / 100 });
	}
}

// ── Nominatim reverse geocoding ──

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocode(lat: number, lng: number): Promise<string> {
	try {
		const resp = await fetch(
			`${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
			{ headers: { 'User-Agent': 'AltmoIntelligence/1.0 (ETL sync-routes)' } }
		);
		if (!resp.ok) return `${lat.toFixed(2)}\u00b0N, ${lng.toFixed(2)}\u00b0E`;
		const data = await resp.json();
		const addr = data.address;
		// Prefer: suburb > neighbourhood > city_district > town > city
		return addr?.suburb ?? addr?.neighbourhood ?? addr?.city_district ?? addr?.town ?? addr?.village ?? addr?.city ?? data.display_name?.split(',')[0] ?? `${lat.toFixed(2)}\u00b0N, ${lng.toFixed(2)}\u00b0E`;
	} catch {
		return `${lat.toFixed(2)}\u00b0N, ${lng.toFixed(2)}\u00b0E`;
	}
}

/**
 * Batch reverse geocode a set of coordinates.
 * Checks Supabase `geocode_cache` first, only calls Nominatim for misses.
 * Nominatim rate limit: 1 req/sec.
 */
async function batchReverseGeocode(
	coords: { lat: number; lng: number }[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any
): Promise<Map<string, string>> {
	// Deduplicate coords by rounded key
	const uniqueKeys = new Map<string, { lat: number; lng: number }>();
	for (const { lat, lng } of coords) {
		const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
		if (!uniqueKeys.has(key)) uniqueKeys.set(key, { lat, lng });
	}

	const cache = new Map<string, string>();

	// Load existing cache from Supabase
	const keys = [...uniqueKeys.keys()];
	if (keys.length > 0) {
		const { data: cached } = await supabase
			.from('geocode_cache')
			.select('coord_key, name')
			.in('coord_key', keys);
		if (cached) {
			for (const row of cached) {
				cache.set(row.coord_key, row.name);
			}
		}
	}

	// Geocode only the misses
	const misses: { key: string; lat: number; lng: number }[] = [];
	for (const [key, { lat, lng }] of uniqueKeys) {
		if (!cache.has(key)) misses.push({ key, lat, lng });
	}

	if (misses.length > 0) {
		console.log(`[sync-routes] ${cache.size} cached, ${misses.length} to geocode`);
		const newEntries: { coord_key: string; name: string }[] = [];

		for (const { key, lat, lng } of misses) {
			const name = await reverseGeocode(lat, lng);
			cache.set(key, name);
			newEntries.push({ coord_key: key, name });
			// Rate limit: 1 req/sec
			await new Promise((r) => setTimeout(r, 1100));
		}

		// Save new entries to Supabase cache
		if (newEntries.length > 0) {
			const { error } = await supabase
				.from('geocode_cache')
				.upsert(newEntries, { onConflict: 'coord_key' });
			if (error) console.warn('[sync-routes] Failed to save geocode cache:', error.message);
			else console.log(`[sync-routes] Saved ${newEntries.length} new geocode entries`);
		}
	} else {
		console.log(`[sync-routes] All ${cache.size} locations served from cache`);
	}

	return cache;
}

type CorridorMap = Map<string, { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }>;

function topCorridorsSorted(map: CorridorMap, limit = 20) {
	return [...map.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

function corridorsToJson(
	corridors: { count: number; totalDist: number; modes: Map<string, number>; sLat: number; sLng: number; eLat: number; eLng: number }[],
	nameCache: Map<string, string>
) {
	return corridors.map((c) => {
		const primaryMode = [...c.modes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Ride';
		const startKey = `${c.sLat.toFixed(2)},${c.sLng.toFixed(2)}`;
		const endKey = `${c.eLat.toFixed(2)},${c.eLng.toFixed(2)}`;
		return {
			startArea: nameCache.get(startKey) ?? `${c.sLat.toFixed(2)}\u00b0N, ${c.sLng.toFixed(2)}\u00b0E`,
			endArea: nameCache.get(endKey) ?? `${c.eLat.toFixed(2)}\u00b0N, ${c.eLng.toFixed(2)}\u00b0E`,
			count: c.count,
			avgDistanceKm: Math.round((c.totalDist / c.count / 1000) * 10) / 10,
			primaryMode
		};
	});
}

// ── Transit Proximity Scoring ──
//
// Weighted scoring algorithm to detect first/last mile transit connections
// from GPS activity routes. Each activity route is scored against nearby transit
// stations to determine if it's likely a first-mile (home→station) or last-mile
// (station→destination) trip.
//
// ## Research Basis
// - India-specific: 85.7% of walk-to-metro trips within 800m (Delhi Metro study,
//   https://easts.info/on-line/proceedings/vol.12/pdf/PP2394.pdf)
// - Cycling catchment 1.7-2.3x walking radius (Bicycle-metro transfer research,
//   https://www.sciencedirect.com/science/article/abs/pii/S0966692321002684)
// - Standard catchment: walking 400-800m, cycling 2-3km (Catchment area review,
//   https://www.researchgate.net/publication/269030099_Catchment_areas_for_public_transport)
// - Speed is strongest mode discriminator (GPS mode detection,
//   https://link.springer.com/article/10.1007/s11116-024-10472-x)
//
// ## Score Components (max theoretical = 1.10, clamped to 1.0)
//
// | Factor               | Max Weight | What it measures                              |
// |----------------------|-----------|-----------------------------------------------|
// | Proximity            | 0.35      | Distance from route start/end to nearest station |
// | Trip Distance        | 0.25      | Short trips near stations → likely first/last mile |
// | Time of Day          | 0.15      | Peak commute hours → higher transit likelihood |
// | Direction            | 0.15      | to_work/from_work → higher transit likelihood |
// | Path Convergence     | 0.10      | Last 3 path points approaching station       |
// | Speed Reasonableness | 0.10      | Walking/cycling speed validates non-motorized |
//
// ## Classification
// - Score >= 0.60: Transit-connected (stored)
// - Score < 0.60: Discarded (not stored)
//
// ## Mode-Specific Station Selection
// - Ride: Metro + Rail stations only (bus stops too dense for cycling radius)
// - Walk: All stations including bus stops (walking to bus is common first/last mile)

const TRANSIT_SCORE_THRESHOLD = 0.60;

const CITY_ID_TO_SLUG: Record<number, string> = {
	18220: 'ahmedabad', 18326: 'bengaluru', 18586: 'chennai',
	18215: 'delhi', 18629: 'hyderabad', 18396: 'indore',
	18363: 'kochi', 18445: 'mumbai', 18455: 'pune'
};

interface StationRef {
	name: string;
	lat: number;
	lng: number;
	type: 'metro' | 'rail' | 'bus';
	line: string;
}

interface CityStations {
	metroRail: StationRef[];
	all: StationRef[];
}

/**
 * Build station arrays from static transit data for proximity scoring.
 * metroRail = metro + rail stations (used for Ride mode)
 * all = metro + rail + bus stops (used for Walk mode)
 *
 * When a city has `operationalLines` configured, only stations on those
 * lines are included. This excludes planned/under-construction stations
 * that inflate proximity coverage.
 */
function buildCityStations(): Map<number, CityStations> {
	const result = new Map<number, CityStations>();

	for (const [cityIdStr, slug] of Object.entries(CITY_ID_TO_SLUG)) {
		const cityId = Number(cityIdStr);
		const transit = getStaticTransitData(slug);
		if (!transit) {
			result.set(cityId, { metroRail: [], all: [] });
			continue;
		}

		const cityConfig = getCityById(slug);
		const opLines = cityConfig?.transitSources?.operationalLines;

		const metroRail: StationRef[] = [];
		const all: StationRef[] = [];

		for (const s of transit.metroStations) {
			// Skip stations on non-operational lines when whitelist is configured
			if (opLines && !opLines.includes(s.line)) continue;
			const ref: StationRef = { name: s.name, lat: s.lat, lng: s.lng, type: 'metro', line: s.line };
			metroRail.push(ref);
			all.push(ref);
		}

		for (const s of transit.railStations) {
			const ref: StationRef = { name: s.name, lat: s.lat, lng: s.lng, type: 'rail', line: s.line };
			metroRail.push(ref);
			all.push(ref);
		}

		for (const s of transit.busStops) {
			all.push({ name: s.name, lat: s.lat, lng: s.lng, type: 'bus', line: 'bus' });
		}

		console.log(`[sync-routes] ${slug}: ${metroRail.length} metro+rail stations${opLines ? ` (filtered to ${opLines.join(', ')})` : ''}, ${all.length - metroRail.length} bus stops`);
		result.set(cityId, { metroRail, all });
	}

	return result;
}

/** Haversine distance in metres between two lat/lng points. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
	return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/** Find nearest station and its distance from a point. */
function findNearestStation(
	lat: number, lng: number, stations: StationRef[]
): { station: StationRef; distM: number } | null {
	if (stations.length === 0) return null;

	let best: { station: StationRef; distM: number } | null = null;
	for (const s of stations) {
		const d = haversineM(lat, lng, s.lat, s.lng);
		if (!best || d < best.distM) {
			best = { station: s, distM: d };
		}
	}
	return best;
}

/**
 * Factor 1: Proximity Weight (0 to 0.35)
 * Distance from route start/end to nearest qualifying station.
 * Walk mode has tighter thresholds (research: 85.7% within 800m for Delhi Metro).
 * Ride mode extends to 3km (cycling catchment 1.7-2.3x walking).
 */
function proximityWeight(distM: number, mode: 'Walk' | 'Ride'): number {
	if (mode === 'Walk') {
		if (distM <= 200) return 0.35;
		if (distM <= 500) return 0.30;
		if (distM <= 1000) return 0.20;
		if (distM <= 1500) return 0.10;
		return 0.0;
	}
	// Ride
	if (distM <= 200) return 0.35;
	if (distM <= 500) return 0.33;
	if (distM <= 1000) return 0.30;
	if (distM <= 1500) return 0.25;
	if (distM <= 2000) return 0.20;
	if (distM <= 3000) return 0.10;
	return 0.0;
}

/**
 * Factor 2: Trip Distance Weight (0 to 0.25)
 * Short trips near stations are more likely first/last mile connections.
 * Trips >15km are too long to be reasonable first/last mile.
 */
function tripDistanceWeight(distM: number): number {
	const km = distM / 1000;
	if (km >= 0.5 && km < 2) return 0.25;
	if (km >= 2 && km < 5) return 0.20;
	if (km >= 5 && km < 8) return 0.10;
	if (km >= 8 && km < 15) return 0.05;
	return 0.0;
}

/**
 * Factor 3: Time-of-Day Weight (0 to 0.15)
 * Peak commute hours (7-10 AM, 5-8 PM) have highest transit usage.
 * Off-peak daytime has low weight. Night hours get zero.
 */
function timeOfDayWeight(hour: number): number {
	if (hour >= 7 && hour < 10) return 0.15;
	if (hour >= 17 && hour < 20) return 0.15;
	if (hour >= 10 && hour < 17) return 0.05;
	return 0.0;
}

/**
 * Factor 4: Direction Weight (0 to 0.15)
 * Commute trips (to/from work) are much more likely to involve transit.
 * Leisure trips get zero weight for this factor.
 */
function directionWeight(dir: 'to_work' | 'from_work' | 'leisure'): number {
	if (dir === 'to_work' || dir === 'from_work') return 0.15;
	return 0.0;
}

/**
 * Factor 5: Path Convergence Weight (0 to 0.10)
 * If the route has a path array, check if the last 3 points converge toward
 * the nearest station (each point closer than the previous). This distinguishes
 * "stopped at station" from "passed through station area".
 */
function pathConvergenceWeight(
	path: [number, number][] | null, stationLat: number, stationLng: number
): number {
	if (!path || path.length < 3) return 0.0;

	// Check last 3 points: each should be closer to station than the previous
	const last3 = path.slice(-3);
	const d0 = haversineM(last3[0][0], last3[0][1], stationLat, stationLng);
	const d1 = haversineM(last3[1][0], last3[1][1], stationLat, stationLng);
	const d2 = haversineM(last3[2][0], last3[2][1], stationLat, stationLng);

	if (d2 < d1 && d1 < d0) return 0.10;
	return 0.0;
}

/**
 * Factor 6: Speed Reasonableness Weight (-0.10 to 0.10)
 * Validates that activity speed is consistent with walking/cycling.
 * Based on GPS-based transport mode detection research:
 * - Walking: 3-6 km/h, Cycling: 10-25 km/h, E-bike: 25-35 km/h
 * - >35 km/h likely motorized → negative weight (penalty)
 * - <3 km/h barely moving (GPS noise or stationary) → zero
 */
function speedWeight(distM: number, movingTimeSec: number): number {
	if (!movingTimeSec || movingTimeSec <= 0 || !distM) return 0.0;
	const kmh = (distM / 1000) / (movingTimeSec / 3600);
	if (kmh >= 3 && kmh <= 35) return 0.10;
	if (kmh > 35) return -0.10;
	return 0.0;
}

interface TransitConnection {
	stationName: string;
	stationType: 'metro' | 'rail' | 'bus';
	stationLine: string;
	distM: number;
	connectionEnd: 'first_mile' | 'last_mile';
	mode: string;
	score: number;
}

/**
 * Compute transit proximity score for a single route.
 * Returns a TransitConnection if score >= threshold, else null.
 */
function scoreRoute(
	startLat: number, startLng: number,
	endLat: number, endLng: number,
	distM: number, movingTime: number,
	mode: 'Ride' | 'Walk' | 'Run' | 'Unknown',
	dir: 'to_work' | 'from_work' | 'leisure',
	hour: number,
	path: [number, number][] | null,
	stations: StationRef[]
): TransitConnection | null {
	// Only score Walk and Ride modes (Run could be first/last mile walk but less common)
	const scoringMode = mode === 'Walk' ? 'Walk' : 'Ride';
	if (mode !== 'Walk' && mode !== 'Ride') return null;

	if (stations.length === 0) return null;

	// Find nearest station to start and end
	const nearStart = findNearestStation(startLat, startLng, stations);
	const nearEnd = findNearestStation(endLat, endLng, stations);
	if (!nearStart && !nearEnd) return null;

	// Determine which end is closer to a station
	const startDist = nearStart?.distM ?? Infinity;
	const endDist = nearEnd?.distM ?? Infinity;

	let connectionEnd: 'first_mile' | 'last_mile';
	let primaryStation: StationRef;
	let primaryDist: number;

	const startThreshold = scoringMode === 'Walk' ? 1500 : 3000;
	const endThreshold = startThreshold;
	const startWithin = startDist <= startThreshold;
	const endWithin = endDist <= endThreshold;

	if (startWithin && endWithin) {
		// Both endpoints near a station — this is likely just travelling between
		// two metro-adjacent areas, not a true first/last mile transit connection.
		// True first/last mile is asymmetric: one end at a station, the other not.
		return null;
	} else if (startWithin) {
		connectionEnd = 'first_mile';
		primaryStation = nearStart!.station;
		primaryDist = startDist;
	} else if (endWithin) {
		connectionEnd = 'last_mile';
		primaryStation = nearEnd!.station;
		primaryDist = endDist;
	} else {
		return null; // Neither end near a station
	}

	// Compute weighted score
	const pWeight = proximityWeight(primaryDist, scoringMode);
	if (pWeight === 0) return null; // Too far from any station

	const dWeight = tripDistanceWeight(distM);
	const tWeight = timeOfDayWeight(hour);
	const dirW = directionWeight(dir);
	const pathW = pathConvergenceWeight(path, primaryStation.lat, primaryStation.lng);
	const spdW = speedWeight(distM, movingTime);

	const totalScore = Math.min(1.0, pWeight + dWeight + tWeight + dirW + pathW + spdW);

	if (totalScore < TRANSIT_SCORE_THRESHOLD) return null;

	return {
		stationName: primaryStation.name,
		stationType: primaryStation.type,
		stationLine: primaryStation.line,
		distM: Math.round(primaryDist),
		connectionEnd,
		mode,
		score: Math.round(totalScore * 100) / 100
	};
}

// ── Transit proximity monthly aggregation ──

interface TransitProximityAgg {
	connected: number;
	firstMile: number;
	lastMile: number;
	totalFirstMileDistM: number;
	totalLastMileDistM: number;
	byMode: Map<string, number>;
	byTransitType: Map<string, number>;
	byLine: Map<string, number>;
	stationCounts: Map<string, { name: string; type: string; line: string; count: number; totalDistM: number }>;
}

function newTransitProximityAgg(): TransitProximityAgg {
	return {
		connected: 0,
		firstMile: 0,
		lastMile: 0,
		totalFirstMileDistM: 0,
		totalLastMileDistM: 0,
		byMode: new Map(),
		byTransitType: new Map(),
		byLine: new Map(),
		stationCounts: new Map()
	};
}

function addTransitConnection(agg: TransitProximityAgg, conn: TransitConnection): void {
	agg.connected++;

	if (conn.connectionEnd === 'first_mile') {
		agg.firstMile++;
		agg.totalFirstMileDistM += conn.distM;
	} else {
		agg.lastMile++;
		agg.totalLastMileDistM += conn.distM;
	}

	agg.byMode.set(conn.mode, (agg.byMode.get(conn.mode) ?? 0) + 1);
	agg.byTransitType.set(conn.stationType, (agg.byTransitType.get(conn.stationType) ?? 0) + 1);
	agg.byLine.set(conn.stationLine, (agg.byLine.get(conn.stationLine) ?? 0) + 1);

	const existing = agg.stationCounts.get(conn.stationName);
	if (existing) {
		existing.count++;
		existing.totalDistM += conn.distM;
	} else {
		agg.stationCounts.set(conn.stationName, {
			name: conn.stationName,
			type: conn.stationType,
			line: conn.stationLine,
			count: 1,
			totalDistM: conn.distM
		});
	}
}

function transitProximityToJson(agg: TransitProximityAgg, totalTrips: number): Record<string, unknown> {
	if (agg.connected === 0) return {};

	const topStations = [...agg.stationCounts.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 15)
		.map((s) => ({
			name: s.name,
			type: s.type,
			line: s.line,
			count: s.count,
			avg_dist_m: Math.round(s.totalDistM / s.count)
		}));

	return {
		connected: agg.connected,
		first_mile: agg.firstMile,
		last_mile: agg.lastMile,
		total_trips: totalTrips,
		pct_connected: Math.round((agg.connected / totalTrips) * 1000) / 10,
		avg_first_mile_m: agg.firstMile > 0 ? Math.round(agg.totalFirstMileDistM / agg.firstMile) : 0,
		avg_last_mile_m: agg.lastMile > 0 ? Math.round(agg.totalLastMileDistM / agg.lastMile) : 0,
		by_mode: Object.fromEntries(agg.byMode),
		by_transit_type: Object.fromEntries(agg.byTransitType),
		by_line: Object.fromEntries(agg.byLine),
		top_stations: topStations
	};
}

// ── Trip Chaining (Phase 2: User-Level Analysis) ──
//
// With user_id from the API (PR #59), we can detect:
// 1. Multimodal journeys: User ends trip A near station X, starts trip B near
//    station Y on the same transit line within plausible transit travel time
// 2. Repeated commute patterns: Same user → same station → same time window
//    on weekdays = very high confidence transit connection
// 3. Weekend vs weekday: Same user near stations on weekends → recreational
//
// All processing is in-memory during ETL. Only aggregated results are stored
// in the trip_chaining JSONB column on city_activity_monthly.

interface UserTrip {
	userId: number;
	startDate: Date;
	hour: number;
	dayOfWeek: number; // 0=Sun, 1=Mon, ...
	mode: string;
	dir: 'to_work' | 'from_work' | 'leisure';
	startLat: number;
	startLng: number;
	endLat: number;
	endLng: number;
	distM: number;
	nearestStartStation: { name: string; type: string; line: string; distM: number } | null;
	nearestEndStation: { name: string; type: string; line: string; distM: number } | null;
}

interface TripChainAgg {
	/** Pairs of sequential trips by same user that form a multimodal journey */
	chainedJourneys: number;
	/** Users with 3+ weekday trips to the same station at similar times */
	repeatedCommuteUsers: number;
	/** Total repeated commute trips (across all repeat users) */
	repeatedCommuteTrips: number;
	/** Weekend transit-adjacent trips (lower confidence) */
	weekendTransitTrips: number;
	/** Station-level chaining data */
	chainedStations: Map<string, { name: string; type: string; line: string; asOrigin: number; asDestination: number }>;
	/** Top multimodal corridors: stationA → stationB via transit */
	multimodalCorridors: Map<string, { fromStation: string; toStation: string; line: string; count: number }>;
	/** Unique users with at least one chained journey */
	uniqueChainedUsers: Set<number>;
}

function newTripChainAgg(): TripChainAgg {
	return {
		chainedJourneys: 0,
		repeatedCommuteUsers: 0,
		repeatedCommuteTrips: 0,
		weekendTransitTrips: 0,
		chainedStations: new Map(),
		multimodalCorridors: new Map(),
		uniqueChainedUsers: new Set()
	};
}

/** Max time gap between two trips to consider them part of the same journey (minutes) */
const MAX_CHAIN_GAP_MIN = 120;

/** Min time gap — trips closer than this are likely GPS artifacts, not separate legs */
const MIN_CHAIN_GAP_MIN = 5;

/** Station proximity threshold for trip chaining (metres) */
const CHAIN_STATION_RADIUS_M = 1500;

/** Time window for "same time" repeated commute detection (hours) */
const REPEAT_TIME_WINDOW_H = 2;

/** Min weekday trips to same station at similar time to count as repeated commuter */
const MIN_REPEAT_TRIPS = 3;

/**
 * Process all user trips for a city-month to detect trip chains and patterns.
 */
function processTripChaining(trips: UserTrip[]): TripChainAgg {
	const agg = newTripChainAgg();
	if (trips.length === 0) return agg;

	// Group trips by user
	const byUser = new Map<number, UserTrip[]>();
	for (const t of trips) {
		const existing = byUser.get(t.userId);
		if (existing) existing.push(t);
		else byUser.set(t.userId, [t]);
	}

	for (const [userId, userTrips] of byUser) {
		// Sort by date/time
		userTrips.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

		// ── 1. Sequential trip chaining (multimodal journey detection) ──
		for (let i = 0; i < userTrips.length - 1; i++) {
			const tripA = userTrips[i];
			const tripB = userTrips[i + 1];

			// Both trips must have station proximity data
			if (!tripA.nearestEndStation || !tripB.nearestStartStation) continue;

			// Trip A must end near a station, trip B must start near a station
			if (tripA.nearestEndStation.distM > CHAIN_STATION_RADIUS_M) continue;
			if (tripB.nearestStartStation.distM > CHAIN_STATION_RADIUS_M) continue;

			// Time gap must be plausible for a transit leg
			const gapMin = (tripB.startDate.getTime() - tripA.startDate.getTime()) / 60000;
			if (gapMin < MIN_CHAIN_GAP_MIN || gapMin > MAX_CHAIN_GAP_MIN) continue;

			// Must be on the same transit line or system (stations connected)
			const stationA = tripA.nearestEndStation;
			const stationB = tripB.nearestStartStation;
			const sameLine = stationA.line === stationB.line;
			const sameSystem = stationA.type === stationB.type;
			if (!sameLine && !sameSystem) continue;

			// Same-station pairs are round trips, not multimodal journeys.
			// True multimodal = cycle to station A, transit to station B, cycle from station B.
			if (stationA.name === stationB.name) continue;

			// This is a chained journey (different stations on same line/system)
			agg.chainedJourneys++;
			agg.uniqueChainedUsers.add(userId);

			// Track stations
			const existA = agg.chainedStations.get(stationA.name);
			if (existA) existA.asOrigin++;
			else agg.chainedStations.set(stationA.name, { name: stationA.name, type: stationA.type, line: stationA.line, asOrigin: 1, asDestination: 0 });

			const existB = agg.chainedStations.get(stationB.name);
			if (existB) existB.asDestination++;
			else agg.chainedStations.set(stationB.name, { name: stationB.name, type: stationB.type, line: stationB.line, asOrigin: 0, asDestination: 1 });

			// Track corridor
			const corrKey = `${stationA.name}→${stationB.name}`;
			const existCorr = agg.multimodalCorridors.get(corrKey);
			if (existCorr) existCorr.count++;
			else agg.multimodalCorridors.set(corrKey, { fromStation: stationA.name, toStation: stationB.name, line: sameLine ? stationA.line : `${stationA.type}→${stationB.type}`, count: 1 });
		}

		// ── 2. Repeated commute pattern detection ──
		// Group weekday trips by nearest station (start or end)
		const weekdayByStation = new Map<string, { hour: number; count: number }[]>();
		for (const t of userTrips) {
			// Weekdays only (Mon-Fri = 1-5)
			if (t.dayOfWeek === 0 || t.dayOfWeek === 6) continue;
			if (t.dir === 'leisure') continue;

			// Check which end is near a station
			const station = t.nearestStartStation?.distM !== undefined && t.nearestStartStation.distM <= CHAIN_STATION_RADIUS_M
				? t.nearestStartStation
				: t.nearestEndStation?.distM !== undefined && t.nearestEndStation.distM <= CHAIN_STATION_RADIUS_M
					? t.nearestEndStation
					: null;
			if (!station) continue;

			const existing = weekdayByStation.get(station.name);
			if (existing) existing.push({ hour: t.hour, count: 1 });
			else weekdayByStation.set(station.name, [{ hour: t.hour, count: 1 }]);
		}

		// Check each station for time clustering
		for (const [, visits] of weekdayByStation) {
			if (visits.length < MIN_REPEAT_TRIPS) continue;

			// Group by time window
			const timeGroups = new Map<number, number>();
			for (const v of visits) {
				// Round to 2-hour windows
				const window = Math.floor(v.hour / REPEAT_TIME_WINDOW_H) * REPEAT_TIME_WINDOW_H;
				timeGroups.set(window, (timeGroups.get(window) ?? 0) + 1);
			}

			for (const [, count] of timeGroups) {
				if (count >= MIN_REPEAT_TRIPS) {
					agg.repeatedCommuteUsers++;
					agg.repeatedCommuteTrips += count;
					break; // Count user once per station
				}
			}
		}

		// ── 3. Weekend transit-adjacent trips ──
		for (const t of userTrips) {
			if (t.dayOfWeek !== 0 && t.dayOfWeek !== 6) continue;

			const nearStation =
				(t.nearestStartStation?.distM !== undefined && t.nearestStartStation.distM <= CHAIN_STATION_RADIUS_M) ||
				(t.nearestEndStation?.distM !== undefined && t.nearestEndStation.distM <= CHAIN_STATION_RADIUS_M);
			if (nearStation) agg.weekendTransitTrips++;
		}
	}

	return agg;
}

function tripChainingToJson(agg: TripChainAgg): Record<string, unknown> {
	if (agg.chainedJourneys === 0 && agg.repeatedCommuteUsers === 0 && agg.weekendTransitTrips === 0) {
		return {};
	}

	const topChainedStations = [...agg.chainedStations.values()]
		.sort((a, b) => (b.asOrigin + b.asDestination) - (a.asOrigin + a.asDestination))
		.slice(0, 15);

	const topCorridors = [...agg.multimodalCorridors.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	return {
		chained_journeys: agg.chainedJourneys,
		unique_chained_users: agg.uniqueChainedUsers.size,
		repeated_commute_users: agg.repeatedCommuteUsers,
		repeated_commute_trips: agg.repeatedCommuteTrips,
		weekend_transit_trips: agg.weekendTransitTrips,
		top_chained_stations: topChainedStations.map(s => ({
			name: s.name,
			type: s.type,
			line: s.line,
			as_origin: s.asOrigin,
			as_destination: s.asDestination
		})),
		top_multimodal_corridors: topCorridors.map(c => ({
			from_station: c.fromStation,
			to_station: c.toStation,
			line: c.line,
			count: c.count
		}))
	};
}

// ── Direct DB helpers (used when ?source=db) ──

/**
 * Parse Rails YAML-serialized path array into [lat, lng][] pairs.
 * Rails `serialize :path, Array` produces simple nested YAML that we can
 * parse without a full YAML library.
 */
function parseYamlPath(yaml: string | null): [number, number][] | null {
	if (!yaml || yaml.trim() === '---' || yaml.trim() === '') return null;
	const points: [number, number][] = [];
	// Split into coordinate pairs on `\n- -` boundaries
	const chunks = yaml.split(/\n- -\s*/);
	for (const chunk of chunks) {
		// Extract all numbers from the chunk
		const nums = chunk.match(/-?\d+\.?\d*/g);
		if (nums && nums.length >= 2) {
			const lat = parseFloat(nums[0]);
			const lng = parseFloat(nums[1]);
			if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
				points.push([lat, lng]);
			}
		}
	}
	return points.length > 0 ? points : null;
}

/** Map Rails integer direction enum to string for normalizeDirection(). */
function mapDbDirection(dir: number | null): string | null {
	if (dir === 0) return 'to_destination';
	if (dir === 1) return 'from_destination';
	return null;
}

/**
 * Parse native_providers.route_coordinates JSONB into [lat, lng][] pairs.
 * Format: [{latitude, longitude, accuracy, timestamp, currentSpeed}, ...]
 */
function parseNativeCoordinates(coords: unknown): [number, number][] | null {
	if (!Array.isArray(coords) || coords.length === 0) return null;
	const points: [number, number][] = [];
	for (const pt of coords) {
		if (pt && typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
			points.push([pt.latitude, pt.longitude]);
		}
	}
	return points.length > 0 ? points : null;
}

/**
 * Fetch routes directly from Rails production DB using cursor-based streaming.
 * Pulls from both Strava (activity_routes) and native app (native_providers).
 * Returns RawRoute[] in the same shape as the API response, so all downstream
 * aggregation code works unchanged.
 */
async function fetchRoutesFromDb(startDate: string, endDate: string): Promise<RawRoute[]> {
	const pool = getRailsPool();
	const client = await pool.connect();
	const routes: RawRoute[] = [];

	try {
		await client.query('BEGIN');

		// ── Cursor 1: Strava activities with activity_routes ──
		await client.query(
			`DECLARE strava_cursor CURSOR FOR
			 SELECT a.id, a.activity_type, a.start_date, a.distance, a.moving_time,
			        a.start_latitude, a.start_longitude, a.end_latitude, a.end_longitude,
			        a.direction, a.company_id, a.city_id, a.user_id,
			        ar.path
			 FROM activities a
			 INNER JOIN activity_routes ar ON ar.activity_id = a.id
			 WHERE a.start_date >= $1 AND a.start_date <= $2
			 ORDER BY a.start_date DESC`,
			[startDate, endDate]
		);

		while (true) {
			const { rows } = await client.query('FETCH 2000 FROM strava_cursor');
			if (rows.length === 0) break;

			for (const row of rows) {
				routes.push({
					activity_id: row.id,
					activity_type: row.activity_type,
					start_date: row.start_date ? new Date(row.start_date).toISOString() : null,
					distance: row.distance ? parseFloat(row.distance) : null,
					moving_time: row.moving_time,
					start_lat: row.start_latitude ? parseFloat(row.start_latitude) : null,
					start_lng: row.start_longitude ? parseFloat(row.start_longitude) : null,
					end_lat: row.end_latitude ? parseFloat(row.end_latitude) : null,
					end_lng: row.end_longitude ? parseFloat(row.end_longitude) : null,
					direction: mapDbDirection(row.direction),
					company_id: row.company_id,
					city_id: row.city_id,
					user_id: row.user_id,
					path: parseYamlPath(row.path)
				});
			}
			console.log(`[sync-routes] Strava cursor: ${routes.length} routes so far...`);
		}
		await client.query('CLOSE strava_cursor');

		const stravaCount = routes.length;

		// ── Cursor 2: Native app activities with native_providers ──
		await client.query(
			`DECLARE native_cursor CURSOR FOR
			 SELECT a.id, a.activity_type, a.start_date, a.distance, a.moving_time,
			        a.start_latitude, a.start_longitude, a.end_latitude, a.end_longitude,
			        a.direction, a.company_id, a.city_id, a.user_id,
			        np.route_coordinates
			 FROM activities a
			 INNER JOIN native_providers np ON np.id = a.provider_id
			 WHERE a.provider_type = 'NativeProvider'
			   AND a.start_date >= $1 AND a.start_date <= $2
			 ORDER BY a.start_date DESC`,
			[startDate, endDate]
		);

		while (true) {
			const { rows } = await client.query('FETCH 2000 FROM native_cursor');
			if (rows.length === 0) break;

			for (const row of rows) {
				routes.push({
					activity_id: row.id,
					activity_type: row.activity_type,
					start_date: row.start_date ? new Date(row.start_date).toISOString() : null,
					distance: row.distance ? parseFloat(row.distance) : null,
					moving_time: row.moving_time,
					start_lat: row.start_latitude ? parseFloat(row.start_latitude) : null,
					start_lng: row.start_longitude ? parseFloat(row.start_longitude) : null,
					end_lat: row.end_latitude ? parseFloat(row.end_latitude) : null,
					end_lng: row.end_longitude ? parseFloat(row.end_longitude) : null,
					direction: mapDbDirection(row.direction),
					company_id: row.company_id,
					city_id: row.city_id,
					user_id: row.user_id,
					path: parseNativeCoordinates(row.route_coordinates)
				});
			}
			console.log(`[sync-routes] Native cursor: ${routes.length - stravaCount} native routes...`);
		}
		await client.query('CLOSE native_cursor');

		console.log(`[sync-routes] DB total: ${stravaCount} Strava + ${routes.length - stravaCount} native = ${routes.length} routes`);

		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}

	return routes;
}

// ── Main handler ──

export const GET: RequestHandler = async ({ request, url }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		// Default: sync last 90 days, overridable via ?days=N or ?all=1 for full history (back to 2019)
		const fetchAll = url.searchParams.get('all') === '1';
		const source = url.searchParams.get('source');
		const endDate = new Date().toISOString().split('T')[0];

		// Build company->city lookup from geo_markers
		const companyCityMap = await buildCompanyCityLookup();

		// Pre-load station data for transit proximity scoring
		const stationsByCity = buildCityStations();
		console.log(`[sync-routes] Loaded transit stations for ${stationsByCity.size} cities`);

		// ── Step 1+2: Fetch routes and aggregate in-memory ──

		const densityMap = new Map<string, { city_id: number; total: number; rides: number; walks: number }>();
		const monthlyMap = new Map<string, { city_id: number; month: string; agg: MonthlyAgg }>();
		const transitProxMap = new Map<string, TransitProximityAgg>();
		const userTripsMap = new Map<string, UserTrip[]>();
		let citiesMapped = 0;
		let noCityCount = 0;
		let totalRoutes = 0;
		let totalPages = 0;
		let transitConnected = 0;
		let tripChainingCount = 0;

		const useDb = source === 'db';

		/** Process a single route into the aggregation maps (shared by API and DB paths). */
		function processRoute(r: RawRoute): void {
			// Resolve city_id: Rails city_id first, then company lookup, then coordinates
			let cityId: number | null = r.city_id ?? null;
			if (!cityId) {
				const companyId = Number(r.company_id);
				cityId = companyId ? companyCityMap.get(companyId) ?? null : null;
			}
			if (!cityId && r.start_lat && r.start_lng) {
				cityId = nearestCityId(r.start_lat, r.start_lng);
			}
			if (!cityId) {
				noCityCount++;
				return;
			}
			citiesMapped++;

			const mode = normalizeActivityType(r.activity_type);
			const dir = normalizeDirection(r.direction);
			const dist = Number(r.distance) || 0;
			const isCommute = dir === 'to_work' || dir === 'from_work';

			// Parse date for monthly key
			let monthKey = '';
			let hour = -1;
			let dayOfWeek = -1;
			if (r.start_date) {
				const d = new Date(r.start_date);
				const yyyy = d.getFullYear();
				const mm = String(d.getMonth() + 1).padStart(2, '0');
				monthKey = `${yyyy}-${mm}-01`;
				hour = d.getHours();
				dayOfWeek = d.getDay();
			}
			if (!monthKey) return;

			// ── H3 density (only routes with a path) ──
			if (r.path && Array.isArray(r.path) && r.path.length > 0) {
				const seenCells = new Set<string>();
				for (const point of r.path) {
					if (!Array.isArray(point) || point.length < 2) continue;
					const [lat, lng] = point;
					if (typeof lat !== 'number' || typeof lng !== 'number') continue;
					try {
						const cell = latLngToCell(lat, lng, 10);
						if (seenCells.has(cell)) continue;
						seenCells.add(cell);

						const dKey = `${cell}|${cityId}`;
						const existing = densityMap.get(dKey);
						if (existing) {
							existing.total++;
							if (mode === 'Ride') existing.rides++;
							else if (mode === 'Walk') existing.walks++;
						} else {
							densityMap.set(dKey, {
								city_id: cityId,
								total: 1,
								rides: mode === 'Ride' ? 1 : 0,
								walks: mode === 'Walk' ? 1 : 0
							});
						}
					} catch {
						// Invalid coordinates — skip
					}
				}
			}

			// ── Monthly aggregation ──
			const mKey = `${cityId}|${monthKey}`;
			if (!monthlyMap.has(mKey)) {
				monthlyMap.set(mKey, { city_id: cityId, month: monthKey, agg: newMonthlyAgg() });
			}
			const m = monthlyMap.get(mKey)!.agg;

			m.totalTrips++;
			if (mode === 'Ride') m.rides++;
			else if (mode === 'Walk') m.walks++;
			else if (mode === 'Run') m.runs++;

			if (dir === 'to_work') m.toWork++;
			else if (dir === 'from_work') m.fromWork++;
			else m.leisure++;

			// Cross-tabulated mode x direction
			if (isCommute) {
				if (mode === 'Ride') m.commuteRides++;
				else if (mode === 'Walk') m.commuteWalks++;
				else if (mode === 'Run') m.commuteRuns++;
			} else {
				if (mode === 'Ride') m.leisureRides++;
				else if (mode === 'Walk') m.leisureWalks++;
				else if (mode === 'Run') m.leisureRuns++;
			}

			m.totalDistanceM += dist;

			// Hourly
			if (hour >= 0 && hour < 24) {
				m.hourly[hour]++;
				if (isCommute) m.hourlyCommute[hour]++;
				else m.hourlyLeisure[hour]++;
			}

			// Weekday
			if (dayOfWeek >= 0 && dayOfWeek < 7) {
				m.weekday[dayOfWeek].count++;
				m.weekday[dayOfWeek].distKm += dist / 1000;
				if (!isCommute) {
					m.weekdayLeisure[dayOfWeek].count++;
					m.weekdayLeisure[dayOfWeek].distKm += dist / 1000;
				}
			}

			// Distance bucket
			const bucket = getDistanceBucket(dist);
			m.distBuckets.set(bucket, (m.distBuckets.get(bucket) ?? 0) + 1);

			// Corridors
			if (r.start_lat && r.start_lng && r.end_lat && r.end_lng) {
				const cKey = corridorKey(r.start_lat, r.start_lng, r.end_lat, r.end_lng);
				if (cKey) {
					addToCorridor(m.corridors, cKey, r.start_lat, r.start_lng, r.end_lat, r.end_lng, dist, mode);
					if (isCommute) {
						addToCorridor(m.corridorsCommute, cKey, r.start_lat, r.start_lng, r.end_lat, r.end_lng, dist, mode);
					} else {
						addToCorridor(m.corridorsLeisure, cKey, r.start_lat, r.start_lng, r.end_lat, r.end_lng, dist, mode);
					}
				}
			}

			// ── Transit proximity scoring ──
			let nearestStartStation: UserTrip['nearestStartStation'] = null;
			let nearestEndStation: UserTrip['nearestEndStation'] = null;

			if (r.start_lat && r.start_lng && r.end_lat && r.end_lng && cityId) {
				const cityStations = stationsByCity.get(cityId);
				if (cityStations) {
					// Walk → all stations (including bus); Ride → metro+rail only
					const stationsForMode = mode === 'Walk' ? cityStations.all : cityStations.metroRail;
					const conn = scoreRoute(
						r.start_lat, r.start_lng,
						r.end_lat, r.end_lng,
						dist,
						Number(r.moving_time) || 0,
						mode,
						dir,
						hour,
						r.path,
						stationsForMode
					);
					if (conn) {
						if (!transitProxMap.has(mKey)) {
							transitProxMap.set(mKey, newTransitProximityAgg());
						}
						addTransitConnection(transitProxMap.get(mKey)!, conn);
						transitConnected++;
					}

					// Compute nearest stations for trip chaining (regardless of transit score)
					const nearStart = findNearestStation(r.start_lat, r.start_lng, stationsForMode);
					const nearEnd = findNearestStation(r.end_lat, r.end_lng, stationsForMode);
					if (nearStart && nearStart.distM <= 3000) {
						nearestStartStation = { name: nearStart.station.name, type: nearStart.station.type, line: nearStart.station.line, distM: nearStart.distM };
					}
					if (nearEnd && nearEnd.distM <= 3000) {
						nearestEndStation = { name: nearEnd.station.name, type: nearEnd.station.type, line: nearEnd.station.line, distM: nearEnd.distM };
					}
				}
			}

			// ── Collect user trips for trip chaining ──
			if (r.user_id && r.start_lat && r.start_lng && r.end_lat && r.end_lng && r.start_date) {
				const userTrip: UserTrip = {
					userId: r.user_id,
					startDate: new Date(r.start_date),
					hour,
					dayOfWeek,
					mode,
					dir,
					startLat: r.start_lat,
					startLng: r.start_lng,
					endLat: r.end_lat,
					endLng: r.end_lng,
					distM: dist,
					nearestStartStation,
					nearestEndStation
				};

				const existing = userTripsMap.get(mKey);
				if (existing) existing.push(userTrip);
				else userTripsMap.set(mKey, [userTrip]);
			}
		} // end processRoute

		// Track date range for response
		let dateRangeStart = '';
		let dateRangeEnd = endDate;
		let dateWindowCount = 0;

		if (useDb) {
			// ── DB source: single query, no pagination needed ──
			const days = parseInt(url.searchParams.get('days') ?? '90', 10);
			const dbStartDate = fetchAll
				? '2019-01-01'
				: new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

			dateRangeStart = dbStartDate;
			dateWindowCount = 1;

			console.log(`[sync-routes] Fetching from DB: ${dbStartDate} → ${endDate}`);
			const dbRoutes = await fetchRoutesFromDb(dbStartDate, endDate);
			totalRoutes = dbRoutes.length;
			console.log(`[sync-routes] DB returned ${totalRoutes} routes`);

			for (const r of dbRoutes) {
				processRoute(r);
			}
		} else {
			// ── API source: paginated fetch with yearly windows ──
			// Rails API enforces max 365-day windows. Process each window's routes
			// immediately to avoid holding all raw route paths in memory at once.
			const dateWindows: { start: string; end: string }[] = [];
			if (fetchAll) {
				const earliest = new Date('2019-01-01');
				const latest = new Date(endDate);
				let windowStart = earliest;
				while (windowStart < latest) {
					const windowEnd = new Date(Math.min(windowStart.getTime() + 364 * 86_400_000, latest.getTime()));
					dateWindows.push({
						start: windowStart.toISOString().split('T')[0],
						end: windowEnd.toISOString().split('T')[0]
					});
					windowStart = new Date(windowEnd.getTime() + 86_400_000);
				}
			} else {
				const days = parseInt(url.searchParams.get('days') ?? '90', 10);
				dateWindows.push({
					start: new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0],
					end: endDate
				});
			}

			dateRangeStart = dateWindows[0]?.start ?? '';
			dateWindowCount = dateWindows.length;

			for (const window of dateWindows) {
				let page = 1;
				while (true) {
					const resp = await railsApi<BulkRoutesResponse>(
						`/routes/bulk?start_date=${window.start}&end_date=${window.end}&page=${page}&per_page=500`
					);

					const routes = resp.data?.routes ?? [];
					totalPages++;
					if (routes.length === 0) break;
					totalRoutes += routes.length;

					// Process this batch immediately, then discard raw routes
					for (const r of routes) {
						processRoute(r);
					}

					if (!resp.data?.paginationMeta?.hasNextPage) break;
					page++;
				} // end while (pagination)
				console.log(`[sync-routes] Window ${window.start}→${window.end}: ${totalRoutes} routes total so far`);
			} // end for (const window of dateWindows)
		}

		// ── Step 3: Upsert route_density ──
		// Collect affected city_ids for bulk delete
		const affectedCities = new Set<number>();
		for (const v of densityMap.values()) affectedCities.add(v.city_id);

		// Delete old density rows for affected cities, then batch insert
		for (const cId of affectedCities) {
			await supabaseAdmin.from('route_density').delete().eq('city_id', cId);
		}

		const densityRows = [...densityMap.entries()].map(([key, v]) => {
			const h3Index = key.split('|')[0];
			return { h3_index: h3Index, city_id: v.city_id, total: v.total, rides: v.rides, walks: v.walks };
		});

		for (let i = 0; i < densityRows.length; i += 500) {
			const batch = densityRows.slice(i, i + 500);
			const { error } = await supabaseAdmin.from('route_density').insert(batch);
			if (error) throw error;
		}

		// ── Step 4: Reverse geocode corridor endpoints ──
		// Collect all unique coordinates from top corridors across all months
		const allCoords: { lat: number; lng: number }[] = [];
		const allTopCorridors = new Map<string, { corridors: ReturnType<typeof topCorridorsSorted>; commute: ReturnType<typeof topCorridorsSorted>; leisure: ReturnType<typeof topCorridorsSorted> }>();

		for (const [mKey, { agg }] of monthlyMap) {
			const corridors = topCorridorsSorted(agg.corridors);
			const commute = topCorridorsSorted(agg.corridorsCommute);
			const leisure = topCorridorsSorted(agg.corridorsLeisure);
			allTopCorridors.set(mKey, { corridors, commute, leisure });

			for (const list of [corridors, commute, leisure]) {
				for (const c of list) {
					allCoords.push({ lat: c.sLat, lng: c.sLng });
					allCoords.push({ lat: c.eLat, lng: c.eLng });
				}
			}
		}

		console.log(`[sync-routes] Reverse geocoding ${allCoords.length} corridor endpoints...`);
		const nameCache = await batchReverseGeocode(allCoords, supabaseAdmin);
		console.log(`[sync-routes] Geocoded ${nameCache.size} unique locations`);

		// ── Step 5: Process trip chaining per city-month ──
		const tripChainResults = new Map<string, Record<string, unknown>>();
		for (const [mKey, trips] of userTripsMap) {
			const chainAgg = processTripChaining(trips);
			const chainJson = tripChainingToJson(chainAgg);
			tripChainResults.set(mKey, chainJson);
			tripChainingCount += chainAgg.chainedJourneys;
		}
		console.log(`[sync-routes] Trip chaining: ${tripChainingCount} chained journeys across ${userTripsMap.size} city-months`);

		// Free user trips memory now that chaining is done
		userTripsMap.clear();

		// ── Step 6: Upsert city_activity_monthly ──
		const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const monthlyRows = [...monthlyMap.entries()].map(([mKey, { city_id, month, agg }]) => {
			const tops = allTopCorridors.get(mKey)!;
			return {
				city_id,
				month,
				total_trips: agg.totalTrips,
				rides: agg.rides,
				walks: agg.walks,
				runs: agg.runs,
				to_work: agg.toWork,
				from_work: agg.fromWork,
				leisure: agg.leisure,
				commute_rides: agg.commuteRides,
				commute_walks: agg.commuteWalks,
				commute_runs: agg.commuteRuns,
				leisure_rides: agg.leisureRides,
				leisure_walks: agg.leisureWalks,
				leisure_runs: agg.leisureRuns,
				total_distance_m: agg.totalDistanceM,
				avg_distance_m: agg.totalTrips > 0 ? Math.round(agg.totalDistanceM / agg.totalTrips) : 0,
				hourly_distribution: agg.hourly.map((count, hour) => ({ hour, count })),
				hourly_commute: agg.hourlyCommute.map((count, hour) => ({ hour, count })),
				hourly_leisure: agg.hourlyLeisure.map((count, hour) => ({ hour, count })),
				weekday_distribution: [1, 2, 3, 4, 5, 6, 0].map((i) => ({
					day: DAYS[i],
					count: agg.weekday[i].count,
					distanceKm: Math.round(agg.weekday[i].distKm)
				})),
				weekday_leisure: [1, 2, 3, 4, 5, 6, 0].map((i) => ({
					day: DAYS[i],
					count: agg.weekdayLeisure[i].count,
					distanceKm: Math.round(agg.weekdayLeisure[i].distKm)
				})),
				distance_buckets: DISTANCE_BUCKETS.map((b) => {
					const count = agg.distBuckets.get(b.label) ?? 0;
					return { bucket: b.label, count, pct: agg.totalTrips > 0 ? Math.round((count / agg.totalTrips) * 1000) / 10 : 0 };
				}),
				top_corridors: corridorsToJson(tops.corridors, nameCache),
				top_corridors_commute: corridorsToJson(tops.commute, nameCache),
				top_corridors_leisure: corridorsToJson(tops.leisure, nameCache),
				transit_proximity: transitProxMap.has(mKey)
					? transitProximityToJson(transitProxMap.get(mKey)!, agg.totalTrips)
					: {},
				trip_chaining: tripChainResults.get(mKey) ?? {},
				synced_at: new Date().toISOString()
			};
		});

		for (let i = 0; i < monthlyRows.length; i += 50) {
			const batch = monthlyRows.slice(i, i + 50);
			const { error } = await supabaseAdmin
				.from('city_activity_monthly')
				.upsert(batch, { onConflict: 'city_id,month' });
			if (error) throw error;
		}

		return json({
			success: true,
			source: useDb ? 'db' : 'api',
			routes_fetched: totalRoutes,
			cities_mapped: citiesMapped,
			no_city_skipped: noCityCount,
			density_cells: densityRows.length,
			monthly_rows: monthlyRows.length,
			transit_connected: transitConnected,
			trip_chaining_journeys: tripChainingCount,
			pages_fetched: totalPages,
			date_windows: dateWindowCount,
			date_range: { start: dateRangeStart, end: dateRangeEnd }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
		console.error('[sync-routes] ETL error:', err);
		return json({ error: message }, { status: 500 });
	}
};
