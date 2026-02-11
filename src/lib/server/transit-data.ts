/**
 * Server-side transit data fetcher with in-memory cache.
 * Fetches from GitHub sources, transforms, and caches.
 * Runs only on the server (SvelteKit server load functions).
 */

import { inflateRawSync } from 'node:zlib';
import { getCityById } from '$lib/config/cities';
import {
	parseTransitRouterStops,
	computeRouteCountsFromServices,
	parseNammaMetroGeoJSON,
	computeMetrics,
	type TransitData,
	type TransitMetrics,
	type BusStop,
	type RidershipMetrics
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

// --- Metro Ridership (BMRCL) ---

const BMRCL_STATION_HOURLY_URL =
	'https://raw.githubusercontent.com/Vonter/bmrcl-ridership-hourly/main/data/station-hourly.csv.zip';

/**
 * Station-to-line mapping for BMRCL Namma Metro.
 * Source: https://github.com/Vonter/bmrcl-ridership-hourly/blob/main/enhance.py
 * Majestic and RV Road are interchange stations shared by two lines.
 */
const STATION_LINE_MAP: Record<string, string> = {};

// Purple Line stations
[
	'Challaghatta', 'Kengeri', 'Kengeri Bus Terminal', 'Pattanagere',
	'Jnanabharathi', 'Rajarajeshwari Nagar', 'Pantharapalya - Nayandahalli',
	'Mysore Road', 'Deepanjali Nagar', 'Attiguppe', 'Vijayanagar',
	'Sri Balagangadharanatha Swamiji Station', 'Hosahalli', 'Magadi Road',
	'Krantivira Sangolli Rayanna Railway Station',
	'Nadaprabhu Kempegowda Station, Majestic',
	'Sir M. Visvesvaraya Stn., Central College',
	'Dr. B. R. Ambedkar Station, Vidhana Soudha', 'Cubbon Park',
	'Mahatma Gandhi Road', 'Trinity', 'Halasuru', 'Indiranagar',
	'Swami Vivekananda Road', 'Baiyappanahalli', 'Benniganahalli',
	'Krishnarajapura', 'Singayyanapalya', 'Garudacharpalya', 'Hoodi',
	'Seetharampalya', 'Kundalahalli', 'Nallurahalli',
	'Sri Sathya Sai Hospital', 'Pattandur Agrahara', 'Kadugodi Tree Park',
	'Hopefarm Channasandra', 'Whitefield (Kadugodi)'
].forEach((s) => { STATION_LINE_MAP[s] = 'purple'; });

// Green Line stations
[
	'Madavara', 'Chikkabidarakallu', 'Manjunathanagara', 'Nagasandra',
	'Dasarahalli', 'Jalahalli', 'Peenya Industry', 'Peenya',
	'Goraguntepalya', 'Yeshwantpur', 'Sandal Soap Factory', 'Mahalakshmi',
	'Rajajinagar', 'Mahakavi Kuvempu Road', 'Srirampura',
	'Mantri Square Sampige Road',
	'Chickpete', 'Krishna Rajendra Market', 'National College', 'Lalbagh',
	'South End Circle', 'Jayanagar',
	'Rashtreeya Vidyalaya Road',
	'Banashankari', 'Jaya Prakash Nagar', 'Yelachenahalli',
	'Konanakunte Cross', 'Doddakallasandra', 'Vajarahalli',
	'Thalaghattapura', 'Silk Institute'
].forEach((s) => { STATION_LINE_MAP[s] = 'green'; });

// Yellow Line stations
[
	'Ragigudda', 'Jayadeva Hospital', 'BTM Layout',
	'Central Silk Board', 'Bommanahalli', 'Hongasandra', 'Kudlu Gate',
	'Singasandra', 'Hosa Road', 'Beratena Agrahara', 'Electronic City',
	'Infosys Foundation Konappana Agrahara', 'Huskur Road',
	'Biocon Hebbagodi', 'Delta Electronics Bommasandra'
].forEach((s) => { STATION_LINE_MAP[s] = 'yellow'; });

/**
 * Extract the first file from a zip buffer using Node.js built-in zlib.
 * Handles the common case of a single-file zip archive (deflate method 8).
 */
function extractFirstFileFromZip(zipBuffer: Buffer): string {
	// Local file header signature: PK\x03\x04
	const sig = zipBuffer.readUInt32LE(0);
	if (sig !== 0x04034b50) {
		throw new Error('Invalid ZIP file signature');
	}

	const compressionMethod = zipBuffer.readUInt16LE(8);
	const compressedSize = zipBuffer.readUInt32LE(18);
	const fileNameLen = zipBuffer.readUInt16LE(26);
	const extraFieldLen = zipBuffer.readUInt16LE(28);
	const dataOffset = 30 + fileNameLen + extraFieldLen;

	if (compressionMethod === 0) {
		// Stored (no compression)
		return zipBuffer.subarray(dataOffset, dataOffset + compressedSize).toString('utf-8');
	} else if (compressionMethod === 8) {
		// Deflate
		const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
		const decompressed = inflateRawSync(compressedData);
		return decompressed.toString('utf-8');
	} else {
		throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
	}
}

/**
 * Parse station-hourly CSV text into aggregated ridership metrics.
 * CSV columns: Date;Hour;Station;Ridership (semicolon-delimited)
 * Aggregates across all dates to produce summary metrics.
 */
function parseRidershipCSV(csvText: string): RidershipMetrics {
	const lines = csvText.trim().split('\n');
	if (lines.length < 2) {
		return {
			totalDailyRidership: 0,
			busiestStations: [],
			ridershipByLine: {},
			peakHours: [],
			dateRange: { from: '', to: '' }
		};
	}

	// Skip header row
	const dataLines = lines.slice(1);

	const stationTotals = new Map<string, number>();
	const hourTotals = new Map<number, number>();
	const dates = new Set<string>();
	let totalRidership = 0;

	for (const line of dataLines) {
		// CSV format: Date;Hour;Station;Ridership (semicolon-delimited)
		const parts = line.split(';');
		if (parts.length < 4) continue;

		const date = parts[0].trim();
		const hour = parseInt(parts[1].trim(), 10);
		const station = parts[2].trim();
		const ridership = parseInt(parts[3].trim(), 10);

		if (isNaN(ridership) || isNaN(hour)) continue;

		dates.add(date);
		totalRidership += ridership;
		stationTotals.set(station, (stationTotals.get(station) ?? 0) + ridership);
		hourTotals.set(hour, (hourTotals.get(hour) ?? 0) + ridership);
	}

	const numDays = dates.size || 1;
	const sortedDates = [...dates].sort();

	// Busiest stations (top 15, averaged per day)
	const busiestStations = [...stationTotals.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 15)
		.map(([name, total]) => ({
			name,
			ridership: Math.round(total / numDays)
		}));

	// Ridership by line (averaged per day)
	const ridershipByLine: Record<string, number> = {};
	for (const [station, total] of stationTotals) {
		const line = STATION_LINE_MAP[station] ?? 'other';
		ridershipByLine[line] = (ridershipByLine[line] ?? 0) + total;
	}
	for (const line of Object.keys(ridershipByLine)) {
		ridershipByLine[line] = Math.round(ridershipByLine[line] / numDays);
	}

	// Peak hours (averaged per day)
	const peakHours = Array.from({ length: 24 }, (_, h) => ({
		hour: h,
		ridership: Math.round((hourTotals.get(h) ?? 0) / numDays)
	}));

	return {
		totalDailyRidership: Math.round(totalRidership / numDays),
		busiestStations,
		ridershipByLine,
		peakHours,
		dateRange: {
			from: sortedDates[0] ?? '',
			to: sortedDates[sortedDates.length - 1] ?? ''
		}
	};
}

/**
 * Fetch BMRCL metro ridership data for a city.
 * Currently only Bengaluru has ridership data available.
 * Fetches a zipped CSV from GitHub, decompresses, parses, and caches.
 */
export async function fetchMetroRidership(cityId: string): Promise<RidershipMetrics | null> {
	if (cityId !== 'bengaluru') return null;

	const cacheKey = `ridership-${cityId}`;
	const cached = getCached<RidershipMetrics>(cacheKey);
	if (cached) return cached;

	try {
		const res = await fetch(BMRCL_STATION_HOURLY_URL);
		if (!res.ok) {
			console.error(`[ridership] Failed to fetch BMRCL data: ${res.status}`);
			return null;
		}

		const arrayBuffer = await res.arrayBuffer();
		const zipBuffer = Buffer.from(arrayBuffer);
		const csvText = extractFirstFileFromZip(zipBuffer);

		const metrics = parseRidershipCSV(csvText);

		console.log(
			`[ridership] ${cityId}: ${metrics.totalDailyRidership.toLocaleString()} avg daily ridership, ` +
			`${metrics.busiestStations.length} stations tracked, ` +
			`date range ${metrics.dateRange.from} to ${metrics.dateRange.to}`
		);

		setCache(cacheKey, metrics);
		return metrics;
	} catch (e) {
		console.error('[ridership] Error fetching BMRCL data:', (e as Error).message);
		return null;
	}
}
