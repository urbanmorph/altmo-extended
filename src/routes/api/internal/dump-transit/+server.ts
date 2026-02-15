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
				results[city.id] = {
					...data,
					_metrics: {
						metroKm: Math.round(metroKm * 10) / 10,
						suburbanRailKm: Math.round(railKm * 10) / 10,
						totalRailKm: Math.round((metroKm + railKm) * 10) / 10
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

	return json({
		...data,
		_metrics: {
			metroKm: Math.round(metroKm * 10) / 10,
			suburbanRailKm: Math.round(railKm * 10) / 10,
			totalRailKm: Math.round((metroKm + railKm) * 10) / 10
		}
	});
};
