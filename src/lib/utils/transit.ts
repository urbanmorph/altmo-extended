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
	rail: '#dc2626',
	catchmentWalk: '#ea580c',
	catchmentCycle: '#000080'
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
			geometry: { type: 'LineString' as const, coordinates: l.coordinates }
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
