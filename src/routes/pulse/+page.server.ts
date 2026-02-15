import type { PageServerLoad } from './$types';
import { getCityById } from '$lib/config/cities';
import { getGlobalStats } from '$lib/server/altmo-core';
import {
	getActivitySummary,
	getActivityTrends,
	getActivityByHour,
	getTopCorridors
} from '$lib/server/activity-data';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';
	const city = getCityById(cityId);
	const resolvedCityId = city ? cityId : 'bengaluru';
	const resolvedCity = city ?? getCityById('bengaluru')!;

	const [stats, summary, commuteSummary, trends, hourly, topCorridors] = await Promise.all([
		getGlobalStats(),
		getActivitySummary(resolvedCityId),
		getActivitySummary(resolvedCityId, 'commute'),
		getActivityTrends(resolvedCityId),
		getActivityByHour(resolvedCityId),
		getTopCorridors(resolvedCityId, 5)
	]);

	// Month-over-month growth
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

	// Peak hour
	let peakHour = '—';
	if (hourly.length > 0) {
		const peak = hourly.reduce((max, h) => (h.count > max.count ? h : max), hourly[0]);
		if (peak.count > 0) {
			const h = peak.hour;
			peakHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
		}
	}

	// Commute share
	const commuteShare =
		summary.totalTrips > 0
			? Math.round((commuteSummary.totalTrips / summary.totalTrips) * 1000) / 10
			: 0;

	// Sparkline data for mini trends chart (last 6 months)
	const recentTrends = trends.slice(-6).map((t) => ({
		month: t.month,
		total: t.rides + t.walks + t.runs
	}));

	return {
		cityId: resolvedCityId,
		cityName: resolvedCity.name,
		stats,
		summary,
		commuteSummary,
		trends: recentTrends,
		momGrowth,
		peakHour,
		commuteShare,
		topCorridors
	};
};
