/**
 * Transit data types and helpers.
 * Haversine distance, catchment classification, GeoJSON conversion, source data parsing.
 */

// --- Types ---

export interface BusStop {
	id: string;
	name: string;
	lng: number;
	lat: number;
	direction?: string;
	routeCount: number;
}

export interface MetroStation {
	name: string;
	lng: number;
	lat: number;
	line: string; // purple | green | yellow | blue
}

export interface MetroLine {
	name: string;
	color: string;
	coordinates: [number, number][];
	/** Multiple disjoint segments — when set, rendered as MultiLineString */
	segments?: [number, number][][];
}

export interface TransitData {
	busStops: BusStop[];
	metroStations: MetroStation[];
	metroLines: MetroLine[];
}

export interface TransitMetrics {
	totalBusStops: number;
	totalMetroStations: number;
	totalBusRoutes: number;
	avgRoutesPerStop: number;
	topHubs: BusStop[];
	metroByLine: Record<string, MetroStation[]>;
}

// --- Ridership Types ---

export interface MetroRidership {
	date: string;
	hour: number;
	station: string;
	ridership: number;
}

export interface RidershipMetrics {
	totalDailyRidership: number;
	busiestStations: { name: string; ridership: number }[];
	ridershipByLine: Record<string, number>;
	peakHours: { hour: number; ridership: number }[];
	dateRange: { from: string; to: string };
}

// --- Constants ---

/** Catchment radii in meters */
export const CATCHMENT = {
	WALK_NEAR: 400,
	WALK_FAR: 800,
	CYCLE: 2000
} as const;

/** Transit layer colors (match CSS @theme tokens) */
export const TRANSIT_COLORS = {
	bus: '#2563eb',
	metro: '#9333ea',
	metroPurple: '#9333ea',
	metroGreen: '#16a34a',
	metroYellow: '#eab308',
	metroPink: '#ec4899',
	metroBlue: '#2563eb',
	metroRed: '#dc2626',
	metroAqua: '#06b6d4',
	rail: '#dc2626',
	catchmentWalk: '#FF7B27',
	catchmentCycle: '#008409'
} as const;

// --- Helpers ---

/** Haversine distance between two points in meters */
export function haversine(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 6371000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Classify a distance into catchment type */
export function catchmentType(
	distanceMeters: number
): 'walk_near' | 'walk_far' | 'cycle' | 'beyond' {
	if (distanceMeters <= CATCHMENT.WALK_NEAR) return 'walk_near';
	if (distanceMeters <= CATCHMENT.WALK_FAR) return 'walk_far';
	if (distanceMeters <= CATCHMENT.CYCLE) return 'cycle';
	return 'beyond';
}

// --- Source Data Parsers ---

/**
 * Parse TransitRouter stops.min.json format:
 * { stop_id: [lng, lat, name, direction, ""] }
 */
export function parseTransitRouterStops(
	raw: Record<string, [number, number, string, string, string]>
): Omit<BusStop, 'routeCount'>[] {
	return Object.entries(raw).map(([id, [lng, lat, name, direction]]) => ({
		id,
		name,
		lng,
		lat,
		direction: direction || undefined
	}));
}

/**
 * Parse TransitRouter services.min.json to compute route count per stop.
 * Format: { route_id: { name, terminus_id: [[stop_sequence]] } }
 */
export function computeRouteCountsFromServices(
	services: Record<string, { name: string; [terminus: string]: string | string[][] }>
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const [, service] of Object.entries(services)) {
		const stopsSeen = new Set<string>();
		for (const [key, value] of Object.entries(service)) {
			if (key === 'name') continue;
			// Each terminus has an array of stop sequences
			if (Array.isArray(value)) {
				for (const sequence of value) {
					if (Array.isArray(sequence)) {
						for (const stopId of sequence) {
							stopsSeen.add(String(stopId));
						}
					}
				}
			}
		}
		for (const stopId of stopsSeen) {
			counts.set(stopId, (counts.get(stopId) ?? 0) + 1);
		}
	}
	return counts;
}

/** Map color name strings to hex codes */
const LINE_COLOR_MAP: Record<string, string> = {
	purple: '#9333ea',
	green: '#16a34a',
	yellow: '#eab308',
	pink: '#ec4899',
	blue: '#2563eb'
};

/**
 * Extract line color from namma-metro GeoJSON line Name.
 * Name format: "Line-1 (Purple): Mysore Road - Baiyappanahalli - 18.10 km"
 */
function extractLineColorFromName(name: string): string {
	const lower = name.toLowerCase();
	for (const [colorName, hex] of Object.entries(LINE_COLOR_MAP)) {
		if (lower.includes(colorName)) return colorName;
	}
	return 'purple';
}

/**
 * Parse namma-metro GeoJSON features into stations and lines.
 * Separates Point features (stations) from LineString features (lines).
 * Note: namma-metro uses "Name" (capital N) and "description" for line color.
 * Station Points have null description, so we assign lines by proximity.
 */
export function parseNammaMetroGeoJSON(geojson: GeoJSON.FeatureCollection): {
	stations: MetroStation[];
	lines: MetroLine[];
} {
	const stations: MetroStation[] = [];
	const lines: MetroLine[] = [];

	// First pass: extract lines (LineStrings have color info)
	for (const feature of geojson.features) {
		const props = feature.properties ?? {};
		const name = props.Name ?? props.name ?? '';

		if (
			feature.geometry.type === 'LineString' ||
			feature.geometry.type === 'MultiLineString'
		) {
			const coords =
				feature.geometry.type === 'LineString'
					? (feature.geometry.coordinates as [number, number][])
					: (feature.geometry.coordinates as [number, number][][]).flat();
			const colorName = props.description ?? extractLineColorFromName(name);
			lines.push({
				name,
				color: LINE_COLOR_MAP[colorName] ?? '#9333ea',
				coordinates: coords
			});
		}
	}

	// Pre-compute color name per line (avoid repeated lookups)
	const lineColorNames = lines.map((line) => {
		return Object.entries(LINE_COLOR_MAP).find(([, hex]) => hex === line.color)?.[0] ?? 'purple';
	});

	// Second pass: extract stations and assign to nearest line
	// Check distance to every coordinate point on each line for accurate matching
	for (const feature of geojson.features) {
		if (feature.geometry.type === 'Point') {
			const props = feature.properties ?? {};
			const [lng, lat] = feature.geometry.coordinates as [number, number];
			const name = props.Name ?? props.name ?? 'Unknown';

			let nearestLine = 'purple';
			let minDist = Infinity;
			for (let i = 0; i < lines.length; i++) {
				const coords = lines[i].coordinates;
				for (const [lx, ly] of coords) {
					const d = haversine(lat, lng, ly, lx);
					if (d < minDist) {
						minDist = d;
						nearestLine = lineColorNames[i];
					}
				}
			}

			stations.push({ name, lng, lat, line: nearestLine });
		}
	}

	return { stations, lines };
}

// --- Delhi Metro Parsers ---

/** Line name to color-key mapping for Delhi Metro */
const DELHI_LINE_COLOR_KEY: Record<string, string> = {
	'yellow line': 'yellow',
	'blue line': 'blue',
	'blue line branch': 'blue',
	'red line': 'red',
	'green line': 'green',
	'green line branch': 'green',
	'violet line': 'violet',
	'airport express': 'orange',
	'pink line': 'pink',
	'magenta line': 'magenta',
	'gray line': 'gray',
	'grey line': 'gray'
};

/** Hex colors for Delhi Metro lines */
const DELHI_LINE_HEX: Record<string, string> = {
	yellow: '#eab308',
	blue: '#2563eb',
	red: '#dc2626',
	green: '#16a34a',
	violet: '#7c3aed',
	pink: '#ec4899',
	magenta: '#d946ef',
	gray: '#6b7280',
	orange: '#f97316'
};

/**
 * Parse dhirajt/delhi-metro-stations JSON into MetroStation[].
 * Format: array of { name, details: { line: string[], latitude, longitude, layout } }
 */
export function parseDelhiMetroStations(
	raw: { name: string; details: { line: string[]; latitude: number; longitude: number; layout: string } }[]
): MetroStation[] {
	const stations: MetroStation[] = [];
	for (const entry of raw) {
		const { name, details } = entry;
		if (!details || typeof details.latitude !== 'number' || typeof details.longitude !== 'number') continue;

		// Use the first line for color assignment; interchange stations get their primary line
		const lineName = (details.line?.[0] ?? '').toLowerCase();
		const colorKey = DELHI_LINE_COLOR_KEY[lineName] ?? 'blue';

		stations.push({
			name,
			lng: details.longitude,
			lat: details.latitude,
			line: colorKey
		});
	}
	return stations;
}

/**
 * Parse kavyajeetbora Delhi_NCR_metro_lines.json into MetroLine[].
 * Format: { name: {0: "...", 1: "..."}, color: {0: [r,g,b], ...}, path: {0: [[lng,lat], ...], ...} }
 * Coordinates are already [lng, lat] in this dataset.
 */
export function parseDelhiMetroLines(
	raw: {
		name: Record<string, string>;
		color: Record<string, [number, number, number]>;
		path: Record<string, [number, number][]>;
	}
): MetroLine[] {
	const lines: MetroLine[] = [];
	const keys = Object.keys(raw.name);

	for (const key of keys) {
		const name = raw.name[key];
		const rgb = raw.color[key];
		const path = raw.path[key];
		if (!name || !rgb || !path) continue;

		// Try to match to our standard hex colors by line name; fall back to RGB conversion
		const lowerName = name.toLowerCase();
		let hex: string | undefined;
		for (const [pattern, colorKey] of Object.entries(DELHI_LINE_COLOR_KEY)) {
			if (lowerName.includes(pattern.replace(' line', '').trim())) {
				hex = DELHI_LINE_HEX[colorKey];
				break;
			}
		}
		if (!hex) {
			// Convert RGB array to hex
			hex = `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
		}

		// Coordinates are already [lng, lat]
		const coordinates: [number, number][] = path.map(([lng, lat]) => [lng, lat]);

		lines.push({ name, color: hex, coordinates });
	}

	return lines;
}

// --- Hyderabad Metro Parsers ---

/** Hex colors for Hyderabad Metro lines */
const HYDERABAD_LINE_HEX: Record<string, string> = {
	red: '#dc2626',
	green: '#16a34a',
	blue: '#2563eb'
};

/**
 * Extract color key from Hyderabad Metro line name.
 * Name format: "Hyderabad Metro Line 1 (red)" or "Hyderabad Metro Line 2 (green)"
 */
function extractHyderabadLineColor(name: string): string {
	const lower = name.toLowerCase();
	for (const color of Object.keys(HYDERABAD_LINE_HEX)) {
		if (lower.includes(color)) return color;
	}
	return 'red';
}

/**
 * Parse Hyderabad Metro route GeoJSON into MetroLine[].
 * The GeoJSON has ~130 LineString segments that need grouping by line name/color.
 * Groups all segments sharing the same line (e.g., "Line 1 (red)") into consolidated lines.
 */
export function parseHyderabadMetroRoutes(geojson: GeoJSON.FeatureCollection): MetroLine[] {
	// Group segments by line color — keep each segment separate for MultiLineString
	const lineGroups = new Map<string, { name: string; segments: [number, number][][] }>();

	for (const feature of geojson.features) {
		if (feature.geometry.type !== 'LineString') continue;
		const props = feature.properties ?? {};
		const name = props.name ?? '';
		const colorKey = extractHyderabadLineColor(name);

		if (!lineGroups.has(colorKey)) {
			const lineNum = name.match(/Line\s*(\d+)/i)?.[1] ?? '';
			const displayName = lineNum
				? `Line ${lineNum} (${colorKey.charAt(0).toUpperCase() + colorKey.slice(1)})`
				: name;
			lineGroups.set(colorKey, { name: displayName, segments: [] });
		}

		const coords = feature.geometry.coordinates as [number, number][];
		if (coords.length > 1) {
			lineGroups.get(colorKey)!.segments.push(coords);
		}
	}

	return Array.from(lineGroups.entries()).map(([colorKey, { name, segments }]) => ({
		name,
		color: HYDERABAD_LINE_HEX[colorKey] ?? '#dc2626',
		coordinates: segments.flat(),
		segments
	}));
}

/**
 * Compute the centroid of a polygon's exterior ring.
 * Takes an array of [lng, lat] coordinate pairs (the outer ring of a GeoJSON Polygon).
 */
function polygonCentroid(ring: [number, number][]): [number, number] {
	let lngSum = 0;
	let latSum = 0;
	// Exclude the closing point (last == first in GeoJSON polygons)
	const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
		? ring.length - 1
		: ring.length;
	for (let i = 0; i < n; i++) {
		lngSum += ring[i][0];
		latSum += ring[i][1];
	}
	return [lngSum / n, latSum / n];
}

/**
 * Parse Hyderabad Metro station buildings GeoJSON into MetroStation[].
 * Station geometries are Polygon/MultiPolygon building footprints — centroids are computed.
 * Line assignment uses station_name hints (e.g., "Ameerpet (Red Line)") when available,
 * otherwise assigns by proximity to the parsed metro lines.
 */
export function parseHyderabadMetroStations(
	geojson: GeoJSON.FeatureCollection,
	metroLines?: MetroLine[]
): MetroStation[] {
	const stations: MetroStation[] = [];

	// Pre-compute line color keys for proximity matching
	const lineColorKeys = metroLines?.map((line) => {
		for (const [color, hex] of Object.entries(HYDERABAD_LINE_HEX)) {
			if (line.color === hex) return color;
		}
		return 'red';
	}) ?? [];

	for (const feature of geojson.features) {
		const props = feature.properties ?? {};
		const stationName: string = props.station_name ?? props.name ?? 'Unknown';
		if (stationName === 'Unknown' && !props.station_name) continue;

		// Compute centroid from polygon geometry
		let lng: number;
		let lat: number;

		if (feature.geometry.type === 'Polygon') {
			const ring = feature.geometry.coordinates[0] as [number, number][];
			[lng, lat] = polygonCentroid(ring);
		} else if (feature.geometry.type === 'MultiPolygon') {
			// Use the first polygon's exterior ring
			const ring = (feature.geometry.coordinates as [number, number][][][])[0][0];
			[lng, lat] = polygonCentroid(ring);
		} else {
			continue;
		}

		// Try to extract line from station name (e.g., "Ameerpet (Red Line)")
		let colorKey: string | undefined;
		const nameMatch = stationName.match(/\((Red|Green|Blue)\s*Line\)/i);
		if (nameMatch) {
			colorKey = nameMatch[1].toLowerCase();
		}

		// Fall back to proximity-based assignment if no hint in name
		if (!colorKey && metroLines && metroLines.length > 0) {
			let minDist = Infinity;
			let nearestColor = 'red';
			for (let i = 0; i < metroLines.length; i++) {
				// Sample every 5th coordinate for performance (lines can have thousands of points)
				const coords = metroLines[i].coordinates;
				for (let j = 0; j < coords.length; j += 5) {
					const d = haversine(lat, lng, coords[j][1], coords[j][0]);
					if (d < minDist) {
						minDist = d;
						nearestColor = lineColorKeys[i];
					}
				}
			}
			colorKey = nearestColor;
		}

		// Clean up station name: remove the "(Red Line)" suffix if present
		const cleanName = stationName.replace(/\s*\((Red|Green|Blue)\s*Line\)/i, '').trim();

		stations.push({
			name: cleanName,
			lng,
			lat,
			line: colorKey ?? 'red'
		});
	}

	// Deduplicate by name — multiple building footprints can exist per station
	const seen = new Set<string>();
	return stations.filter((s) => {
		if (seen.has(s.name)) return false;
		seen.add(s.name);
		return true;
	});
}

// --- GeoJSON Builders (for MapLibre) ---

export function busStopsToGeoJSON(stops: BusStop[]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: stops.map((s) => ({
			type: 'Feature' as const,
			properties: { id: s.id, name: s.name, routeCount: s.routeCount, direction: s.direction },
			geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] }
		}))
	};
}

export function metroStationsToGeoJSON(stations: MetroStation[]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: stations.map((s) => ({
			type: 'Feature' as const,
			properties: { name: s.name, line: s.line },
			geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] }
		}))
	};
}

export function metroLinesToGeoJSON(lines: MetroLine[]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: lines.map((l) => ({
			type: 'Feature' as const,
			properties: { name: l.name, color: l.color },
			geometry: l.segments
				? { type: 'MultiLineString' as const, coordinates: l.segments }
				: { type: 'LineString' as const, coordinates: l.coordinates }
		}))
	};
}

/** Generate a circle polygon (for catchment rings on the map) */
export function circlePolygon(
	centerLng: number,
	centerLat: number,
	radiusMeters: number,
	steps: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
	const coords: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const dx = radiusMeters * Math.cos(angle);
		const dy = radiusMeters * Math.sin(angle);
		const lat = centerLat + (dy / 6371000) * (180 / Math.PI);
		const lng =
			centerLng + ((dx / 6371000) * (180 / Math.PI)) / Math.cos((centerLat * Math.PI) / 180);
		coords.push([lng, lat]);
	}
	return {
		type: 'Feature',
		properties: {},
		geometry: { type: 'Polygon', coordinates: [coords] }
	};
}

/** Compute aggregate transit metrics from transit data */
export function computeMetrics(data: TransitData, totalBusRoutes: number): TransitMetrics {
	const routeCounts = data.busStops.map((s) => s.routeCount);
	const avgRoutesPerStop =
		routeCounts.length > 0
			? routeCounts.reduce((a, b) => a + b, 0) / routeCounts.length
			: 0;

	const topHubs = [...data.busStops]
		.sort((a, b) => b.routeCount - a.routeCount)
		.slice(0, 20);

	const metroByLine: Record<string, MetroStation[]> = {};
	for (const station of data.metroStations) {
		const line = station.line;
		if (!metroByLine[line]) metroByLine[line] = [];
		metroByLine[line].push(station);
	}

	return {
		totalBusStops: data.busStops.length,
		totalMetroStations: data.metroStations.length,
		totalBusRoutes,
		avgRoutesPerStop: Math.round(avgRoutesPerStop * 10) / 10,
		topHubs,
		metroByLine
	};
}
