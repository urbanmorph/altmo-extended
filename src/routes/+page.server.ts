import type { PageServerLoad } from './$types';
import { getLatestSafetyData } from '$lib/server/safety-data';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export const load: PageServerLoad = async () => {
	const safety = await getLatestSafetyData();

	const overrides: QoLOverrides = {};
	for (const [cityId, data] of Object.entries(safety)) {
		overrides[cityId] = { traffic_fatalities: data.fatalitiesPerLakh };
	}

	return { qolOverrides: overrides };
};
