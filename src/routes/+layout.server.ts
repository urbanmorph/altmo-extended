import type { LayoutServerLoad } from './$types';
import { CITIES } from '$lib/config/cities';

export const load: LayoutServerLoad = async () => {
	return {
		cities: CITIES.map((c) => ({
			id: c.id,
			name: c.name,
			lat: c.lat,
			lng: c.lng,
			zoom: c.zoom
		}))
	};
};
