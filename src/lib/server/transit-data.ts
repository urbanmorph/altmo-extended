/**
 * Server-side transit data fetcher with in-memory cache.
 * Fetches from GitHub sources, transforms, and caches.
 * Runs only on the server (SvelteKit server load functions).
 */

import { inflateRawSync } from 'node:zlib';
import { getCityById, type TransitDataSources, type SuburbanRailQuery } from '$lib/config/cities';
import {
	parseTransitRouterStops,
	computeRouteCountsFromServices,
	parseNammaMetroGeoJSON,
	parseDelhiMetroStations,
	parseDelhiMetroLines,
	parseHyderabadMetroRoutes,
	parseHyderabadMetroStations,
	computeMetrics,
	haversine,
	type TransitData,
	type TransitMetrics,
	type BusStop,
	type MetroStation,
	type MetroLine,
	type RailStation,
	type RailLine,
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

// --- Overpass API (OpenStreetMap) ---

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/** OSM element types returned by the Overpass JSON response */
interface OverpassNode {
	type: 'node';
	id: number;
	lat: number;
	lon: number;
	tags?: Record<string, string>;
}

interface OverpassWay {
	type: 'way';
	id: number;
	nodes: number[];
	tags?: Record<string, string>;
}

interface OverpassRelation {
	type: 'relation';
	id: number;
	tags?: Record<string, string>;
	members: { type: string; ref: number; role: string }[];
}

type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

interface OverpassResponse {
	elements: OverpassElement[];
}

/**
 * Fetch metro station and line data from the Overpass API for a given network.
 * Constructs an Overpass QL query to retrieve all route relations for the network,
 * then recursively resolves member ways and nodes to build line geometries.
 * Stations are identified by railway/station/public_transport tags on nodes
 * and assigned to the nearest line by haversine proximity.
 */
async function fetchMetroFromOverpass(
	config: { network: string; lines: Record<string, string> }
): Promise<{ stations: MetroStation[]; lines: MetroLine[] }> {
	const query = `[out:json][timeout:60];
relation["network"="${config.network}"]["route"~"subway|light_rail"];
out body;
>;
out body qt;`;

	const res = await fetch(OVERPASS_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `data=${encodeURIComponent(query)}`
	});

	if (!res.ok) {
		throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
	}

	const data: OverpassResponse = await res.json();

	// Build lookup maps from the flat element array
	const nodeMap = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
	const wayMap = new Map<number, number[]>();
	const relations: OverpassRelation[] = [];

	for (const el of data.elements) {
		if (el.type === 'node') {
			nodeMap.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
		} else if (el.type === 'way') {
			wayMap.set(el.id, el.nodes);
		} else if (el.type === 'relation') {
			relations.push(el);
		}
	}

	// Build a reverse lookup: line name from config -> lowercase key
	// e.g. "Blue Line" -> "blue", "Purple Line" -> "purple"
	const lineNameToKey = new Map<string, string>();
	for (const lineName of Object.keys(config.lines)) {
		const key = lineName.replace(/\s+Line$/i, '').toLowerCase();
		lineNameToKey.set(lineName.toLowerCase(), key);
	}

	// Process relations to build MetroLine[]
	const metroLines: MetroLine[] = [];

	for (const rel of relations) {
		const tags = rel.tags ?? {};
		const relName = tags.name ?? tags.ref ?? '';

		// Match this relation to a configured line name
		let matchedLineName: string | undefined;
		let matchedColor: string | undefined;

		// First try: full name containment
		for (const [configName, color] of Object.entries(config.lines)) {
			if (
				relName.toLowerCase().includes(configName.toLowerCase()) ||
				configName.toLowerCase().includes(relName.toLowerCase())
			) {
				matchedLineName = configName;
				matchedColor = color;
				break;
			}
		}

		// Second try: match by color word (e.g. "Blue" in "Metro Blue Line ...")
		if (!matchedLineName) {
			for (const [configName, color] of Object.entries(config.lines)) {
				const colorWord = configName.replace(/\s+Line$/i, '').toLowerCase();
				if (relName.toLowerCase().includes(colorWord)) {
					matchedLineName = configName;
					matchedColor = color;
					break;
				}
			}
		}

		if (!matchedLineName || !matchedColor) continue;

		// Skip if we already have a line with this name (avoid duplicates from multiple relations)
		if (metroLines.some((l) => l.name === matchedLineName)) continue;

		// Collect member ways and resolve to coordinate arrays
		const wayRefs = rel.members.filter((m) => m.type === 'way').map((m) => m.ref);

		// Build segments by chaining contiguous ways; start a new segment on gaps
		const segments: [number, number][][] = [];
		let currentSegment: [number, number][] = [];

		for (const wayId of wayRefs) {
			const nodeRefs = wayMap.get(wayId);
			if (!nodeRefs) continue;

			const wayCoords: [number, number][] = [];
			for (const nid of nodeRefs) {
				const node = nodeMap.get(nid);
				if (node) {
					wayCoords.push([node.lon, node.lat]); // [lng, lat] for GeoJSON/MapLibre
				}
			}

			if (wayCoords.length === 0) continue;

			if (currentSegment.length > 0) {
				const lastCoord = currentSegment[currentSegment.length - 1];
				const firstWay = wayCoords[0];
				const lastWay = wayCoords[wayCoords.length - 1];

				if (lastCoord[0] === firstWay[0] && lastCoord[1] === firstWay[1]) {
					// Normal order — skip duplicate start point
					currentSegment.push(...wayCoords.slice(1));
				} else if (lastCoord[0] === lastWay[0] && lastCoord[1] === lastWay[1]) {
					// Reverse this way segment to maintain continuity
					wayCoords.reverse();
					currentSegment.push(...wayCoords.slice(1));
				} else {
					// Disjoint — finish current segment, start a new one
					segments.push(currentSegment);
					currentSegment = [...wayCoords];
				}
			} else {
				currentSegment = [...wayCoords];
			}
		}
		if (currentSegment.length > 0) segments.push(currentSegment);

		if (segments.length > 0) {
			metroLines.push({
				name: matchedLineName,
				color: matchedColor,
				coordinates: segments.flat(),
				segments
			});
		}
	}

	// Identify station nodes from the full node map
	// Stations tagged: railway=station, station=subway, or public_transport=station
	const stationNodes: { name: string; lat: number; lon: number }[] = [];
	for (const [, node] of nodeMap) {
		const tags = node.tags;
		if (!tags) continue;

		const isStation =
			tags['railway'] === 'station' ||
			tags['railway'] === 'stop' ||
			tags['railway'] === 'halt' ||
			tags['station'] === 'subway' ||
			tags['public_transport'] === 'station' ||
			tags['public_transport'] === 'stop_position';

		if (isStation && tags['name']) {
			stationNodes.push({ name: tags['name'], lat: node.lat, lon: node.lon });
		}
	}

	// Deduplicate stations by name (OSM may have overlapping tags on the same physical station)
	const seenNames = new Set<string>();
	const uniqueStations = stationNodes.filter((s) => {
		if (seenNames.has(s.name)) return false;
		seenNames.add(s.name);
		return true;
	});

	// Assign each station to the nearest line using haversine proximity
	const metroStations: MetroStation[] = uniqueStations.map((stn) => {
		let nearestLineKey = 'blue'; // fallback
		let minDist = Infinity;

		for (const line of metroLines) {
			for (const [lng, lat] of line.coordinates) {
				const d = haversine(stn.lat, stn.lon, lat, lng);
				if (d < minDist) {
					minDist = d;
					nearestLineKey =
						lineNameToKey.get(line.name.toLowerCase()) ?? line.name.toLowerCase();
				}
			}
		}

		return { name: stn.name, lng: stn.lon, lat: stn.lat, line: nearestLineKey };
	});

	return { stations: metroStations, lines: metroLines };
}

/**
 * Regex to normalize suburban rail corridor names.
 * Strips "Fast", "Slow", "Up", "Down", "Local" suffixes and route direction variants
 * so all relations for the same corridor collapse into a single line.
 */
const CORRIDOR_STRIP_RE = /\s*\(?(Fast|Slow|Up|Down|Local|Express|Stopping|Semi-?Fast)\)?/gi;

/**
 * Fetch suburban/commuter rail data from the Overpass API for a single query.
 * Uses route=train (not subway/light_rail which is metro).
 * Stations: railway=station or railway=halt (exclude station=subway).
 */
async function fetchSuburbanRailSingleQuery(
	query: SuburbanRailQuery
): Promise<{ stations: RailStation[]; lines: RailLine[] }> {
	// Build the Overpass QL — include optional operator filter
	const operatorFilter = query.operator ? `["operator"="${query.operator}"]` : '';
	const overpassQL = `[out:json][timeout:90];
relation["network"="${query.network}"]["route"="train"]${operatorFilter};
out body;
>;
out body qt;`;

	const res = await fetch(OVERPASS_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `data=${encodeURIComponent(overpassQL)}`
	});

	if (!res.ok) {
		throw new Error(`Overpass API error for ${query.network}: ${res.status} ${res.statusText}`);
	}

	const data: OverpassResponse = await res.json();

	// Build lookup maps
	const nodeMap = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
	const wayMap = new Map<number, number[]>();
	const relations: OverpassRelation[] = [];

	for (const el of data.elements) {
		if (el.type === 'node') {
			nodeMap.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
		} else if (el.type === 'way') {
			wayMap.set(el.id, el.nodes);
		} else if (el.type === 'relation') {
			relations.push(el);
		}
	}

	// Group relations by corridor name (strip fast/slow/up/down variants)
	const corridors = new Map<string, { relName: string; wayRefs: number[] }>();

	for (const rel of relations) {
		const tags = rel.tags ?? {};
		const relName = tags.name ?? tags.ref ?? '';
		if (!relName) continue;

		// Normalize: strip direction/speed variants to get corridor name
		const corridorKey = relName.replace(CORRIDOR_STRIP_RE, '').trim().toLowerCase();

		if (!corridors.has(corridorKey)) {
			corridors.set(corridorKey, { relName, wayRefs: [] });
		}

		// Collect way refs from all relations in this corridor
		const wayRefs = rel.members.filter((m) => m.type === 'way').map((m) => m.ref);
		corridors.get(corridorKey)!.wayRefs.push(...wayRefs);
	}

	// Build RailLine[] — match corridors to configured line names
	const railLines: RailLine[] = [];
	const configLineNames = Object.keys(query.lines);

	for (const [, corridor] of corridors) {
		// Match this corridor to a configured line name
		let matchedName: string | undefined;
		let matchedColor: string | undefined;

		for (const [configName, color] of Object.entries(query.lines)) {
			if (
				corridor.relName.toLowerCase().includes(configName.toLowerCase()) ||
				configName.toLowerCase().includes(corridor.relName.toLowerCase())
			) {
				matchedName = configName;
				matchedColor = color;
				break;
			}
		}

		// Second pass: partial keyword match
		if (!matchedName) {
			for (const [configName, color] of Object.entries(query.lines)) {
				const keywords = configName.toLowerCase().split(/[-\s]+/).filter((w) => w.length > 2);
				const corridorLower = corridor.relName.toLowerCase();
				if (keywords.some((kw) => corridorLower.includes(kw))) {
					matchedName = configName;
					matchedColor = color;
					break;
				}
			}
		}

		if (!matchedName || !matchedColor) continue;

		// Skip if we already built this line
		if (railLines.some((l) => l.name === matchedName)) continue;

		// Deduplicate way refs and build geometry
		const uniqueWayRefs = [...new Set(corridor.wayRefs)];
		const segments: [number, number][][] = [];
		let currentSegment: [number, number][] = [];

		for (const wayId of uniqueWayRefs) {
			const nodeRefs = wayMap.get(wayId);
			if (!nodeRefs) continue;

			const wayCoords: [number, number][] = [];
			for (const nid of nodeRefs) {
				const node = nodeMap.get(nid);
				if (node) {
					wayCoords.push([node.lon, node.lat]);
				}
			}

			if (wayCoords.length === 0) continue;

			if (currentSegment.length > 0) {
				const lastCoord = currentSegment[currentSegment.length - 1];
				const firstWay = wayCoords[0];
				const lastWay = wayCoords[wayCoords.length - 1];

				if (lastCoord[0] === firstWay[0] && lastCoord[1] === firstWay[1]) {
					currentSegment.push(...wayCoords.slice(1));
				} else if (lastCoord[0] === lastWay[0] && lastCoord[1] === lastWay[1]) {
					wayCoords.reverse();
					currentSegment.push(...wayCoords.slice(1));
				} else {
					segments.push(currentSegment);
					currentSegment = [...wayCoords];
				}
			} else {
				currentSegment = [...wayCoords];
			}
		}
		if (currentSegment.length > 0) segments.push(currentSegment);

		if (segments.length > 0) {
			railLines.push({
				name: matchedName,
				color: matchedColor,
				coordinates: segments.flat(),
				segments
			});
		}
	}

	// Identify station nodes — railway=station or railway=halt, exclude station=subway
	const stationNodes: { name: string; lat: number; lon: number }[] = [];
	for (const [, node] of nodeMap) {
		const tags = node.tags;
		if (!tags) continue;

		const isRailStation =
			(tags['railway'] === 'station' || tags['railway'] === 'halt') &&
			tags['station'] !== 'subway' &&
			tags['station'] !== 'light_rail';

		if (isRailStation && tags['name']) {
			stationNodes.push({ name: tags['name'], lat: node.lat, lon: node.lon });
		}
	}

	// Deduplicate stations by name
	const seenNames = new Set<string>();
	const uniqueStations = stationNodes.filter((s) => {
		if (seenNames.has(s.name)) return false;
		seenNames.add(s.name);
		return true;
	});

	// Assign each station to the nearest line
	const railStations: RailStation[] = uniqueStations.map((stn) => {
		let nearestLine = configLineNames[0] ?? 'suburban';
		let minDist = Infinity;

		for (const line of railLines) {
			// Sample every 10th coordinate for performance
			for (let i = 0; i < line.coordinates.length; i += 10) {
				const [lng, lat] = line.coordinates[i];
				const d = haversine(stn.lat, stn.lon, lat, lng);
				if (d < minDist) {
					minDist = d;
					nearestLine = line.name;
				}
			}
		}

		return { name: stn.name, lng: stn.lon, lat: stn.lat, line: nearestLine };
	});

	return { stations: railStations, lines: railLines };
}

/**
 * Fetch suburban rail data for a city by iterating over all configured queries.
 * Chennai needs 2 queries (Southern Railway + MRTS), others need 1.
 */
async function fetchSuburbanRailData(
	cityId: string,
	sources: TransitDataSources
): Promise<{ stations: RailStation[]; lines: RailLine[] }> {
	const empty = { stations: [] as RailStation[], lines: [] as RailLine[] };

	if (!sources.suburbanRailOverpass) return empty;

	try {
		const results = await Promise.all(
			sources.suburbanRailOverpass.queries.map((q) => fetchSuburbanRailSingleQuery(q))
		);

		const stations = results.flatMap((r) => r.stations);
		const lines = results.flatMap((r) => r.lines);

		console.log(`[transit] ${cityId}: suburban rail — ${stations.length} stations, ${lines.length} lines`);

		return { stations, lines };
	} catch (e) {
		console.error(`[transit] Failed to fetch suburban rail for ${cityId}:`, (e as Error).message);
		return empty;
	}
}

/**
 * Fetch and parse metro station/line data, dispatching to the correct parser per city.
 * Returns { stations, lines } or empty arrays if no metro sources are configured.
 */
async function fetchMetroData(
	cityId: string,
	sources: TransitDataSources
): Promise<{ stations: MetroStation[]; lines: MetroLine[] }> {
	const empty = { stations: [] as MetroStation[], lines: [] as MetroLine[] };

	try {
		// --- Delhi: separate station JSON + line geometry JSON ---
		if (cityId === 'delhi') {
			const [rawStations, rawLines] = await Promise.all([
				sources.metroStations ? fetchJSON<{ name: string; details: { line: string[]; latitude: number; longitude: number; layout: string } }[]>(sources.metroStations) : null,
				sources.metroLines ? fetchJSON<{ name: Record<string, string>; color: Record<string, [number, number, number]>; path: Record<string, [number, number][]> }>(sources.metroLines) : null
			]);

			return {
				stations: rawStations ? parseDelhiMetroStations(rawStations) : [],
				lines: rawLines ? parseDelhiMetroLines(rawLines) : []
			};
		}

		// --- Hyderabad: separate route GeoJSON + station buildings GeoJSON ---
		if (cityId === 'hyderabad') {
			const [rawRoutes, rawStations] = await Promise.all([
				sources.metroLines ? fetchJSON<GeoJSON.FeatureCollection>(sources.metroLines) : null,
				sources.metroStations ? fetchJSON<GeoJSON.FeatureCollection>(sources.metroStations) : null
			]);

			// Parse lines first (needed for station proximity assignment)
			const lines = rawRoutes ? parseHyderabadMetroRoutes(rawRoutes) : [];
			const stations = rawStations ? parseHyderabadMetroStations(rawStations, lines) : [];

			return { stations, lines };
		}

		// --- Bengaluru: combined namma-metro GeoJSON ---
		if (sources.metroStations && !sources.metroLines && !sources.metroGTFS) {
			const metroGeoJSON = await fetchJSON<GeoJSON.FeatureCollection>(sources.metroStations);
			return parseNammaMetroGeoJSON(metroGeoJSON);
		}

		// --- GTFS-based (e.g., Kochi) ---
		if (sources.metroGTFS) {
			const gtfsResult = await fetchGTFSMetroData(sources.metroGTFS);
			// Also merge any GeoJSON metro data if present alongside GTFS
			if (sources.metroStations) {
				const metroGeoJSON = await fetchJSON<GeoJSON.FeatureCollection>(sources.metroStations);
				const geojsonResult = parseNammaMetroGeoJSON(metroGeoJSON);
				gtfsResult.stations.push(...geojsonResult.stations);
				gtfsResult.lines.push(...geojsonResult.lines);
			}
			return gtfsResult;
		}

		// --- Overpass API (e.g., Chennai, Pune) ---
		if (sources.metroOverpass) {
			return fetchMetroFromOverpass(sources.metroOverpass);
		}

		return empty;
	} catch (e) {
		console.error(`[transit] Failed to fetch metro data for ${cityId}:`, (e as Error).message, (e as Error).stack);
		return empty;
	}
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
		return { busStops: [], metroStations: [], metroLines: [], railStations: [], railLines: [] };
	}

	// Fetch bus, metro, and suburban rail in parallel
	const [busResult, metro, suburbanRail] = await Promise.all([
		(async () => {
			const [rawStops, rawServices] = await Promise.all([
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
					: null
			]);

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
			return busStops;
		})(),
		fetchMetroData(cityId, sources),
		fetchSuburbanRailData(cityId, sources)
	]);

	const data: TransitData = {
		busStops: busResult,
		metroStations: metro.stations,
		metroLines: metro.lines,
		railStations: suburbanRail.stations,
		railLines: suburbanRail.lines
	};

	console.log(`[transit] ${cityId}: ${busResult.length} bus stops, ${metro.stations.length} metro stations, ${metro.lines.length} metro lines, ${suburbanRail.stations.length} rail stations, ${suburbanRail.lines.length} rail lines`);

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
 * Extract a specific file by name from a ZIP buffer.
 * Scans local file headers sequentially until the target file is found.
 */
function extractFileFromZip(zipBuffer: Buffer, fileName: string): string {
	let offset = 0;

	while (offset < zipBuffer.length - 4) {
		const sig = zipBuffer.readUInt32LE(offset);
		if (sig !== 0x04034b50) break; // Not a local file header

		const generalFlag = zipBuffer.readUInt16LE(offset + 6);
		const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
		const compressedSize = zipBuffer.readUInt32LE(offset + 18);
		const fileNameLen = zipBuffer.readUInt16LE(offset + 26);
		const extraFieldLen = zipBuffer.readUInt16LE(offset + 28);
		const entryName = zipBuffer.subarray(offset + 30, offset + 30 + fileNameLen).toString('utf-8');
		const dataOffset = offset + 30 + fileNameLen + extraFieldLen;

		if (entryName === fileName) {
			if (compressionMethod === 0) {
				return zipBuffer.subarray(dataOffset, dataOffset + compressedSize).toString('utf-8');
			} else if (compressionMethod === 8) {
				const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);
				return inflateRawSync(compressedData).toString('utf-8');
			} else {
				throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
			}
		}

		// Advance past file data to next local file header
		offset = dataOffset + compressedSize;

		// Handle data descriptor (bit 3 of general purpose flag)
		if (generalFlag & 0x0008) {
			// Data descriptor may have optional signature (4 bytes) + crc32 (4) + compressed size (4) + uncompressed size (4)
			if (offset + 4 <= zipBuffer.length && zipBuffer.readUInt32LE(offset) === 0x08074b50) {
				offset += 16; // signature + crc32 + compressed + uncompressed
			} else {
				offset += 12; // crc32 + compressed + uncompressed (no signature)
			}
		}
	}

	throw new Error(`File "${fileName}" not found in ZIP archive`);
}

// --- GTFS CSV Parsers (server-only, used for Kochi metro) ---

/**
 * Parse a CSV string into an array of records.
 * Handles standard GTFS CSV: comma-delimited, first row is header, values may be quoted.
 */
function parseCSV(csvText: string): Record<string, string>[] {
	const lines = csvText.trim().split('\n');
	if (lines.length < 2) return [];

	// Remove BOM if present and trim carriage returns
	const headers = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
	const records: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
		const record: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			record[headers[j]] = values[j] ?? '';
		}
		records.push(record);
	}

	return records;
}

/**
 * Parse GTFS stops.txt CSV into MetroStation[].
 * Sets line to 'blue' for all stations (Kochi has a single Blue Line).
 */
function parseGTFSStops(csvText: string): MetroStation[] {
	const records = parseCSV(csvText);
	const stations: MetroStation[] = [];

	for (const row of records) {
		const lat = parseFloat(row['stop_lat']);
		const lng = parseFloat(row['stop_lon']);
		const name = row['stop_name'] ?? '';

		if (isNaN(lat) || isNaN(lng) || !name) continue;

		stations.push({ name, lng, lat, line: 'blue' });
	}

	return stations;
}

/**
 * Parse GTFS shapes.txt CSV into MetroLine[].
 * Groups by shape_id, orders by shape_pt_sequence, returns coordinates as [lng, lat].
 * Uses route color from routes.txt if provided, otherwise defaults to blue.
 */
function parseGTFSShapes(csvText: string, routeColor?: string): MetroLine[] {
	const records = parseCSV(csvText);

	// Group points by shape_id
	const shapes = new Map<string, { lat: number; lng: number; seq: number }[]>();
	for (const row of records) {
		const shapeId = row['shape_id'] ?? '';
		const lat = parseFloat(row['shape_pt_lat']);
		const lng = parseFloat(row['shape_pt_lon']);
		const seq = parseInt(row['shape_pt_sequence'], 10);

		if (!shapeId || isNaN(lat) || isNaN(lng) || isNaN(seq)) continue;

		if (!shapes.has(shapeId)) shapes.set(shapeId, []);
		shapes.get(shapeId)!.push({ lat, lng, seq });
	}

	const color = routeColor ? `#${routeColor}` : '#2563eb'; // Default to blue
	const lines: MetroLine[] = [];

	for (const [shapeId, points] of shapes) {
		// Sort by sequence number
		points.sort((a, b) => a.seq - b.seq);

		// Convert to [lng, lat] coordinate pairs
		const coordinates: [number, number][] = points.map((p) => [p.lng, p.lat]);

		lines.push({
			name: `Kochi Metro - ${shapeId}`,
			color,
			coordinates
		});
	}

	return lines;
}

/**
 * Fetch and parse GTFS ZIP for metro station and line data.
 * Extracts stops.txt, shapes.txt, and optionally routes.txt from the ZIP.
 */
async function fetchGTFSMetroData(
	gtfsUrl: string
): Promise<{ stations: MetroStation[]; lines: MetroLine[] }> {
	const res = await fetch(gtfsUrl);
	if (!res.ok) throw new Error(`Failed to fetch GTFS ZIP: ${res.status}`);

	const arrayBuffer = await res.arrayBuffer();
	const zipBuffer = Buffer.from(arrayBuffer);

	// Extract the required GTFS files
	const stopsCSV = extractFileFromZip(zipBuffer, 'stops.txt');
	const shapesCSV = extractFileFromZip(zipBuffer, 'shapes.txt');

	// Optionally extract route color from routes.txt
	let routeColor: string | undefined;
	try {
		const routesCSV = extractFileFromZip(zipBuffer, 'routes.txt');
		const routeRecords = parseCSV(routesCSV);
		if (routeRecords.length > 0 && routeRecords[0]['route_color']) {
			routeColor = routeRecords[0]['route_color'];
		}
	} catch {
		// routes.txt not found or unparseable — use default color
	}

	const stations = parseGTFSStops(stopsCSV);
	const lines = parseGTFSShapes(shapesCSV, routeColor);

	return { stations, lines };
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
