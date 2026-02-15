/**
 * Internal dev-only endpoint: dumps transit data as JSON for a given city.
 * Used by scripts/refresh-transit-data.sh to generate static JSON files.
 *
 * Usage: curl http://localhost:5173/api/internal/dump-transit?city=bengaluru
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById, CITIES } from '$lib/config/cities';
import { computeMetroNetworkKm, computeRailNetworkKm } from '$lib/utils/transit';

// ── Cycleway km from Overpass ──

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * City bounding boxes for Overpass cycleway queries.
 * Format: [south, west, north, east]
 * Approx 15-20 km radius from city center.
 */
const CITY_BBOX: Record<string, [number, number, number, number]> = {
	ahmedabad: [22.90, 72.45, 23.15, 72.70],
	bengaluru: [12.85, 77.45, 13.15, 77.75],
	chennai: [12.90, 80.10, 13.20, 80.35],
	delhi: [28.40, 76.85, 28.85, 77.35],
	hyderabad: [17.25, 78.30, 17.55, 78.60],
	indore: [22.60, 75.75, 22.85, 75.95],
	kochi: [9.85, 76.20, 10.10, 76.40],
	kolkata: [22.45, 88.25, 22.70, 88.50],
	mumbai: [18.85, 72.75, 19.30, 73.00],
	pune: [18.40, 73.70, 18.65, 74.00]
};

/**
 * Query Overpass for total cycleway km in a city's bounding box.
 * Includes: highway=cycleway, cycleway=track/lane/shared_lane, cycleway:left/right=track/lane
 * Uses [out:csv] with length() to get geodesic meters without downloading all geometries.
 */
async function fetchCyclewayKm(cityId: string): Promise<number> {
	const bbox = CITY_BBOX[cityId];
	if (!bbox) return 0;

	const [s, w, n, e] = bbox;
	const query = `[out:json][timeout:60];
(
  way["highway"="cycleway"](${s},${w},${n},${e});
  way["cycleway"~"track|lane|shared_lane"](${s},${w},${n},${e});
  way["cycleway:left"~"track|lane"](${s},${w},${n},${e});
  way["cycleway:right"~"track|lane"](${s},${w},${n},${e});
);
out geom;`;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60_000);
		const res = await fetch(OVERPASS_API, {
			method: 'POST',
			body: `data=${encodeURIComponent(query)}`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			signal: controller.signal
		});
		clearTimeout(timeout);

		if (!res.ok) {
			console.warn(`[dump-transit] Cycleway Overpass error for ${cityId}: ${res.status}`);
			return 0;
		}

		const data = await res.json();
		const ways = (data.elements ?? []).filter((el: { type: string }) => el.type === 'way');

		// Compute total length using haversine on each way's geometry
		let totalM = 0;
		for (const way of ways) {
			const geom = way.geometry as { lat: number; lon: number }[] | undefined;
			if (!geom || geom.length < 2) continue;
			for (let i = 1; i < geom.length; i++) {
				const R = 6371000;
				const dLat = (geom[i].lat - geom[i - 1].lat) * Math.PI / 180;
				const dLon = (geom[i].lon - geom[i - 1].lon) * Math.PI / 180;
				const a = Math.sin(dLat / 2) ** 2 +
					Math.cos(geom[i - 1].lat * Math.PI / 180) * Math.cos(geom[i].lat * Math.PI / 180) *
					Math.sin(dLon / 2) ** 2;
				totalM += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			}
		}

		const km = totalM / 1000;
		console.log(`[dump-transit] ${cityId}: ${ways.length} cycleway ways, ${km.toFixed(1)} km`);
		return km;
	} catch (err) {
		console.warn(`[dump-transit] Cycleway fetch failed for ${cityId}:`, (err as Error).message);
		return 0;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const cityId = url.searchParams.get('city');

	// If no city specified, dump all cities
	if (!cityId || cityId === 'all') {
		const results: Record<string, unknown> = {};
		for (const city of CITIES) {
			if (!city.transitSources) continue;
			try {
				console.log(`[dump-transit] Fetching ${city.id}...`);
				const data = await fetchTransitData(city.id);
				const metroKm = computeMetroNetworkKm(data.metroLines);
				const railKm = computeRailNetworkKm(data.railLines);
				const cyclewayKm = await fetchCyclewayKm(city.id);
				// Pause between cities to avoid Overpass rate limiting
				await new Promise((r) => setTimeout(r, 2000));
				results[city.id] = {
					...data,
					_metrics: {
						metroKm: Math.round(metroKm * 10) / 10,
						suburbanRailKm: Math.round(railKm * 10) / 10,
						totalRailKm: Math.round((metroKm + railKm) * 10) / 10,
						cyclewayKm: Math.round(cyclewayKm * 10) / 10
					}
				};
			} catch (e) {
				console.error(`[dump-transit] Failed for ${city.id}:`, (e as Error).message);
				results[city.id] = { error: (e as Error).message };
			}
		}
		return json(results);
	}

	const city = getCityById(cityId);
	if (!city) {
		return json({ error: `Unknown city: ${cityId}` }, { status: 404 });
	}

	const data = await fetchTransitData(cityId);
	const metroKm = computeMetroNetworkKm(data.metroLines);
	const railKm = computeRailNetworkKm(data.railLines);
	const cyclewayKm = await fetchCyclewayKm(cityId);

	return json({
		...data,
		_metrics: {
			metroKm: Math.round(metroKm * 10) / 10,
			suburbanRailKm: Math.round(railKm * 10) / 10,
			totalRailKm: Math.round((metroKm + railKm) * 10) / 10,
			cyclewayKm: Math.round(cyclewayKm * 10) / 10
		}
	});
};
