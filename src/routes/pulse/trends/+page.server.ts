import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getActivitySummary, getActivityTrends } from '$lib/server/activity-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [summary, trends] = await Promise.all([
		getActivitySummary(resolvedCityId),
		getActivityTrends(resolvedCityId)
	]);

	// Compute month-over-month growth for latest month
	let momGrowth: number | null = null;
	if (trends.length >= 2) {
		const latest = trends[trends.length - 1];
		const prev = trends[trends.length - 2];
		const latestTotal = latest.rides + latest.walks + latest.runs;
		const prevTotal = prev.rides + prev.walks + prev.runs;
		if (prevTotal > 0) {
			momGrowth = Math.round(((latestTotal - prevTotal) / prevTotal) * 1000) / 10;
		}
	}

	// Latest month total
	const latestMonth = trends.length > 0 ? trends[trends.length - 1] : null;
	const latestMonthTotal = latestMonth
		? latestMonth.rides + latestMonth.walks + latestMonth.runs
		: 0;

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		summary,
		trends,
		momGrowth,
		latestMonthTotal,
		latestMonthLabel: latestMonth?.month ?? null
	};
};
