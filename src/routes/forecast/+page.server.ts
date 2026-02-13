import type { PageServerLoad } from './$types';
import { buildQoLOverrides } from '$lib/server/qol-overrides';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const qolOverrides = await buildQoLOverrides();

	// Resolve city from URL param or cookie
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';

	return { qolOverrides, cityId };
};
