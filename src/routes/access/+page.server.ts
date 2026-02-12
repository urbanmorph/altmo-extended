import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON,
	computeMetroNetworkKm
} from '$lib/utils/transit';
import { getLatestSafetyData } from '$lib/server/safety-data';
import { getAllCityPM25 } from '$lib/server/air-quality';
import { getAllCityCongestion } from '$lib/server/traffic-flow';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	// If city not found, fall back to Bengaluru
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;
	const [transitResult, safety, airQuality, congestion] = await Promise.all([
		hasTransitSources
			? fetchTransitData(resolvedCityId)
			: Promise.resolve({ busStops: [], metroStations: [], metroLines: [] }),
		getLatestSafetyData(),
		getAllCityPM25(),
		getAllCityCongestion()
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
	for (const [id, d] of Object.entries(congestion)) {
		if (d) {
			qolOverrides[id] = { ...qolOverrides[id], congestion_level: d.congestionPct };
		}
	}

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
