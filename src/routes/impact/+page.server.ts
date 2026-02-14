import type { PageServerLoad } from './$types';
import { getGlobalStats } from '$lib/server/altmo-core';
import { getAllCityPM25 } from '$lib/server/air-quality';
import { getLatestSafetyData } from '$lib/server/safety-data';
import { getAllCityCongestion } from '$lib/server/traffic-flow';

export const load: PageServerLoad = async () => {
	const [stats, pm25, safety, congestion] = await Promise.all([
		getGlobalStats(),
		getAllCityPM25(),
		getLatestSafetyData(),
		getAllCityCongestion()
	]);
	return { stats, pm25, safety, congestion };
};
