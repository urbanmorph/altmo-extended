import type { PageServerLoad } from './$types';
import { buildQoLOverrides } from '$lib/server/qol-overrides';

export const load: PageServerLoad = async () => {
	const qolOverrides = await buildQoLOverrides();

	return { qolOverrides };
};
