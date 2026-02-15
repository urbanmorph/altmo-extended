import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getActivitySummary, getActivityByHour, getDistanceDistribution } from '$lib/server/activity-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [summary, hourly, distanceDistribution] = await Promise.all([
		getActivitySummary(resolvedCityId),
		getActivityByHour(resolvedCityId),
		getDistanceDistribution(resolvedCityId)
	]);

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		summary,
		hourly,
		distanceDistribution
	};
};
