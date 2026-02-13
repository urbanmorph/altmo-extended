import type { PageServerLoad } from './$types';
import { getLatestSafetyData } from '$lib/server/safety-data';
import { getAllCityPM25 } from '$lib/server/air-quality';
import { getAllCityCongestion } from '$lib/server/traffic-flow';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const [safety, airQuality, congestion] = await Promise.all([
		getLatestSafetyData(),
		getAllCityPM25(),
		getAllCityCongestion()
	]);

	const overrides: QoLOverrides = {};
	for (const [cityId, data] of Object.entries(safety)) {
		overrides[cityId] = { traffic_fatalities: data.fatalitiesPerLakh };
	}
	for (const [cityId, data] of Object.entries(airQuality)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], pm25_annual: data.pm25Avg };
		}
	}
	for (const [cityId, data] of Object.entries(congestion)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], congestion_level: data.congestionPct };
		}
	}

	// Resolve city from URL param or cookie
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';

	return { qolOverrides: overrides, cityId };
};
