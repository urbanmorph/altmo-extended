import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getActivitySummary, getActivityByHour, getTopCorridors } from '$lib/server/activity-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [summary, hourly, corridors] = await Promise.all([
		getActivitySummary(resolvedCityId, 'commute'),
		getActivityByHour(resolvedCityId, 'commute'),
		getTopCorridors(resolvedCityId, 10, 'commute')
	]);

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		summary,
		hourly,
		corridors
	};
};
