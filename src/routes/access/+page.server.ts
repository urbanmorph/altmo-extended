import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON
} from '$lib/utils/transit';
import { getLatestSafetyData } from '$lib/server/safety-data';
import { getAllCityPM25 } from '$lib/server/air-quality';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	// If city not found, fall back to Bengaluru
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;
	const [transitResult, safety, airQuality] = await Promise.all([
		hasTransitSources
			? fetchTransitData(resolvedCityId)
			: Promise.resolve({ busStops: [], metroStations: [], metroLines: [] }),
		getLatestSafetyData(),
		getAllCityPM25()
	]);

	const qolOverrides: QoLOverrides = {};
	for (const [id, d] of Object.entries(safety)) {
		qolOverrides[id] = { traffic_fatalities: d.fatalitiesPerLakh };
	}
	for (const [id, d] of Object.entries(airQuality)) {
		if (d) {
			qolOverrides[id] = { ...qolOverrides[id], pm25_annual: d.pm25Avg };
		}
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
