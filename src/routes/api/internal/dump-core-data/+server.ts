/**
 * Internal dev-only endpoint: dumps Altmo Core API data as JSON.
 * Used by scripts/refresh-core-data.sh to generate static JSON files.
 *
 * Usage: curl http://localhost:5173/api/internal/dump-core-data?type=geo-markers
 *        curl http://localhost:5173/api/internal/dump-core-data?type=global-stats
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGlobalStats, getGeoMarkers } from '$lib/server/altmo-core';

export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type');

	if (type === 'global-stats') {
		const stats = await getGlobalStats();
		return json(stats ?? { error: 'Failed to fetch global stats' });
	}

	if (type === 'geo-markers') {
		const markers = await getGeoMarkers();
		return json(markers ?? []);
	}

	return json(
		{ error: 'Specify ?type=global-stats or ?type=geo-markers' },
		{ status: 400 }
	);
};
