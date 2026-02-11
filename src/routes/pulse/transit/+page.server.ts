import type { PageServerLoad } from './$types';
import { fetchTransitMetrics } from '$lib/server/transit-data';

export const load: PageServerLoad = async () => {
	const { data, metrics } = await fetchTransitMetrics('bengaluru');

	return {
		metrics: {
			totalBusStops: metrics.totalBusStops,
			totalMetroStations: metrics.totalMetroStations,
			totalBusRoutes: metrics.totalBusRoutes,
			avgRoutesPerStop: metrics.avgRoutesPerStop
		},
		topHubs: metrics.topHubs.map(h => ({
			name: h.name,
			routeCount: h.routeCount
		})),
		metroByLine: Object.fromEntries(
			Object.entries(metrics.metroByLine).map(([line, stations]) => [
				line,
				stations.map(s => ({ name: s.name }))
			])
		)
	};
};
