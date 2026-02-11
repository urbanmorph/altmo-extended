import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON
} from '$lib/utils/transit';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	// If city not found, fall back to Bengaluru
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;
	const data = hasTransitSources
		? await fetchTransitData(resolvedCityId)
		: { busStops: [], metroStations: [], metroLines: [] };

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		cityCenter: [resolvedCity.lng, resolvedCity.lat] as [number, number],
		cityZoom: resolvedCity.zoom,
		hasTransitSources,
		busStopsGeoJSON: busStopsToGeoJSON(data.busStops),
		metroStationsGeoJSON: metroStationsToGeoJSON(data.metroStations),
		metroLinesGeoJSON: metroLinesToGeoJSON(data.metroLines),
		busStopCount: data.busStops.length,
		metroStationCount: data.metroStations.length
	};
};
