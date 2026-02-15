import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getActivitySummary, getTopCorridors, getRouteDensity } from '$lib/server/activity-data';
import { densityToPointGeoJSON } from '$lib/utils/h3';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [summary, corridors, densityCells] = await Promise.all([
		getActivitySummary(resolvedCityId),
		getTopCorridors(resolvedCityId, 20),
		getRouteDensity(resolvedCityId)
	]);

	const densityGeoJSON = densityToPointGeoJSON(densityCells);

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		cityCenter: [resolvedCity.lng, resolvedCity.lat] as [number, number],
		cityZoom: resolvedCity.zoom,
		summary,
		corridors,
		densityGeoJSON,
		densityCellCount: densityCells.length
	};
};
