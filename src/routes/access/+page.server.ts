import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON,
	railStationsToGeoJSON,
	railLinesToGeoJSON
} from '$lib/utils/transit';
import { buildQoLOverrides } from '$lib/server/qol-overrides';
import { getGeoMarkers } from '$lib/server/altmo-core';
import type { GeoMarker } from '$lib/server/altmo-core';

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Build GeoJSON from geo_markers, filtering by associable_type */
function geoMarkersToGeoJSON(markers: GeoMarker[], types: string[]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: markers
			.filter((m) => m.lat && m.lon && types.includes(m.type))
			.map((m) => ({
				type: 'Feature' as const,
				geometry: {
					type: 'Point' as const,
					coordinates: [m.lon, m.lat]
				},
				properties: {
					id: m.id,
					name: m.name,
					marker_type: m.type
				}
			}))
	};
}

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	// If city not found, fall back to Bengaluru
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;
	const [transitResult, qolOverrides, geoMarkers] = await Promise.all([
		hasTransitSources
			? fetchTransitData(resolvedCityId)
			: Promise.resolve({ busStops: [], metroStations: [], metroLines: [], railStations: [], railLines: [] }),
		buildQoLOverrides(),
		getGeoMarkers()
	]);

	// rail_transit_km override is handled centrally by buildQoLOverrides()

	// Split geo_markers by type: Company/Campus → commuter destinations, TransitPoint → separate layer
	const companiesGeoJSON = geoMarkers ? geoMarkersToGeoJSON(geoMarkers, ['Company', 'Campus']) : emptyFC;
	const transitPointsGeoJSON = geoMarkers ? geoMarkersToGeoJSON(geoMarkers, ['TransitPoint']) : emptyFC;

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		cityCenter: [resolvedCity.lng, resolvedCity.lat] as [number, number],
		cityZoom: resolvedCity.zoom,
		hasTransitSources,
		busStopsGeoJSON: busStopsToGeoJSON(transitResult.busStops),
		metroStationsGeoJSON: metroStationsToGeoJSON(transitResult.metroStations),
		metroLinesGeoJSON: metroLinesToGeoJSON(transitResult.metroLines),
		railStationsGeoJSON: railStationsToGeoJSON(transitResult.railStations),
		railLinesGeoJSON: railLinesToGeoJSON(transitResult.railLines),
		busStopCount: transitResult.busStops.length,
		metroStationCount: transitResult.metroStations.length,
		railStationCount: transitResult.railStations.length,
		companiesGeoJSON,
		companyCount: companiesGeoJSON.features.length,
		transitPointsGeoJSON,
		transitPointCount: transitPointsGeoJSON.features.length,
		qolOverrides
	};
};
