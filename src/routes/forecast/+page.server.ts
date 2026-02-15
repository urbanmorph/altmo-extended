import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const city = url.searchParams.get('city') ?? 'bengaluru';
	redirect(301, `/city/${city}#scenarios`);
};
