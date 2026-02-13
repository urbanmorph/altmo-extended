import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON,
	computeMetroNetworkKm
} from '$lib/utils/transit';
import { buildQoLOverrides } from '$lib/server/qol-overrides';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	// If city not found, fall back to Bengaluru
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;
	const [transitResult, qolOverrides] = await Promise.all([
		hasTransitSources
			? fetchTransitData(resolvedCityId)
			: Promise.resolve({ busStops: [], metroStations: [], metroLines: [] }),
		buildQoLOverrides()
	]);

	// Override metro_network_km from live transit line geometries
	const metroNetworkKm = computeMetroNetworkKm(transitResult.metroLines);
	if (metroNetworkKm > 0) {
		qolOverrides[resolvedCityId] = {
			...qolOverrides[resolvedCityId],
			metro_network_km: metroNetworkKm
		};
	}

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		cityCenter: [resolvedCity.lng, resolvedCity.lat] as [number, number],
		cityZoom: resolvedCity.zoom,
		hasTransitSources,
		busStopsGeoJSON: busStopsToGeoJSON(transitResult.busStops),
		metroStationsGeoJSON: metroStationsToGeoJSON(transitResult.metroStations),
		metroLinesGeoJSON: metroLinesToGeoJSON(transitResult.metroLines),
		busStopCount: transitResult.busStops.length,
		metroStationCount: transitResult.metroStations.length,
		qolOverrides
	};
};
