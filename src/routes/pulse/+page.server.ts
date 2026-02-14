import type { PageServerLoad } from './$types';
import { getGlobalStats } from '$lib/server/altmo-core';

export const load: PageServerLoad = async () => {
	const stats = await getGlobalStats();
	return { stats };
};
