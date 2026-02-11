import type { PageServerLoad } from './$types';
import { fetchTransitData } from '$lib/server/transit-data';
import {
	busStopsToGeoJSON,
	metroStationsToGeoJSON,
	metroLinesToGeoJSON
} from '$lib/utils/transit';

export const load: PageServerLoad = async () => {
	const data = await fetchTransitData('bengaluru');

	return {
		busStopsGeoJSON: busStopsToGeoJSON(data.busStops),
		metroStationsGeoJSON: metroStationsToGeoJSON(data.metroStations),
		metroLinesGeoJSON: metroLinesToGeoJSON(data.metroLines),
		busStopCount: data.busStops.length,
		metroStationCount: data.metroStations.length
	};
};
