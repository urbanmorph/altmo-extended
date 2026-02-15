import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getActivitySummary, getActivityByDayOfWeek, getTopCorridors } from '$lib/server/activity-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [summary, weekday, topAreas] = await Promise.all([
		getActivitySummary(resolvedCityId, 'leisure'),
		getActivityByDayOfWeek(resolvedCityId, 'leisure'),
		getTopCorridors(resolvedCityId, 10, 'leisure')
	]);

	// Compute weekend share
	const weekendCount = weekday
		.filter((d) => d.day === 'Sat' || d.day === 'Sun')
		.reduce((sum, d) => sum + d.count, 0);
	const weekendShare = summary.totalTrips > 0
		? Math.round((weekendCount / summary.totalTrips) * 1000) / 10
		: 0;

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		summary,
		weekday,
		topAreas,
		weekendShare
	};
};
