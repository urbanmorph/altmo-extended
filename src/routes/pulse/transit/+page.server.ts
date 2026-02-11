import type { PageServerLoad } from './$types';
import { fetchTransitMetrics, fetchMetroRidership } from '$lib/server/transit-data';
import { getCityById } from '$lib/config/cities';

export const load: PageServerLoad = async ({ url }) => {
	const cityId = url.searchParams.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);

	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const hasTransitSources = !!resolvedCity.transitSources;

	if (!hasTransitSources) {
		return {
			cityId: resolvedCityId,
			cityName: resolvedCity.name,
			hasTransitSources: false,
			metrics: {
				totalBusStops: 0,
				totalMetroStations: 0,
				totalBusRoutes: 0,
				avgRoutesPerStop: 0
			},
			topHubs: [],
			metroByLine: {},
			ridership: null
		};
	}

	const [{ data, metrics }, ridership] = await Promise.all([
		fetchTransitMetrics(resolvedCityId),
		fetchMetroRidership(resolvedCityId)
	]);

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		hasTransitSources: true,
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
		),
		ridership
	};
};
