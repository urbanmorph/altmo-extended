import type { PageServerLoad } from './$types';
import { getLatestSafetyData } from '$lib/server/safety-data';
import { getAllCityPM25 } from '$lib/server/air-quality';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export const load: PageServerLoad = async () => {
	const [safety, airQuality] = await Promise.all([
		getLatestSafetyData(),
		getAllCityPM25()
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

	return { qolOverrides: overrides };
};
