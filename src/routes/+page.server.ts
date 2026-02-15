import type { PageServerLoad } from './$types';
import { buildQoLOverrides } from '$lib/server/qol-overrides';
import { getGlobalStats } from '$lib/server/altmo-core';
import { getActivitySummary } from '$lib/server/activity-data';

export const load: PageServerLoad = async () => {
	const [qolOverrides, globalStats, activitySummary] = await Promise.all([
		buildQoLOverrides(),
		getGlobalStats(),
		getActivitySummary('bengaluru')
	]);
	return { qolOverrides, globalStats, activitySummary };
};
