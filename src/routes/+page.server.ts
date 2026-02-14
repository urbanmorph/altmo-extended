import type { PageServerLoad } from './$types';
import { buildQoLOverrides } from '$lib/server/qol-overrides';
import { getGlobalStats } from '$lib/server/altmo-core';

export const load: PageServerLoad = async () => {
	const [qolOverrides, globalStats] = await Promise.all([buildQoLOverrides(), getGlobalStats()]);
	return { qolOverrides, globalStats };
};
