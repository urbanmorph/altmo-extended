import type { PageServerLoad } from './$types';
import dataSources from '../../../static/data/data-sources.json';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cityId = url.searchParams.get('city') ?? cookies.get('city') ?? 'bengaluru';

	return { dataSources, cityId };
};
