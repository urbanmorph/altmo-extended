/**
 * Air quality configuration: station mapping, thresholds, categories.
 * Shared between server and client code.
 */

/**
 * OpenAQ location IDs for PM2.5 monitoring stations near each Altmo city.
 * Discovered via: GET /v3/locations?coordinates={lat},{lng}&radius=25000&parameters_id=2&limit=10
 */
export const CITY_OPENAQ_LOCATIONS: Record<string, { name: string; locationIds: number[] }> = {
	bengaluru: {
		name: 'Bengaluru',
		locationIds: [412, 594, 2592, 6973, 6974, 6975, 6983]
	},
	chennai: {
		name: 'Chennai',
		locationIds: [378, 2549, 2586, 5655, 10780, 11578, 11579, 11581]
	},
	delhi: {
		name: 'Delhi',
		locationIds: [13, 15, 16, 17, 50, 103, 235, 236, 431, 2503]
	},
	hyderabad: {
		name: 'Hyderabad',
		locationIds: [407, 2594, 5599, 5623, 5647, 344103, 344104, 344140]
	},
	indore: {
		name: 'Indore',
		locationIds: [5603, 3409414, 3409498, 3409499, 3409500, 3409501]
	},
	kochi: {
		name: 'Kochi',
		locationIds: [6966, 8916, 10916]
	},
	pune: {
		name: 'Pune',
		locationIds: [2585, 5661, 11608, 11609, 11610, 11613, 12042, 60658, 60660]
	}
};

/**
 * PM2.5 reference thresholds (ug/m3).
 * WHO 2021 annual guideline: 5, 24-hour: 15
 * India NAAQS annual standard: 40, 24-hour: 60
 */
export const PM25_THRESHOLDS = {
	who: { annual: 5, daily: 15, label: 'WHO 2021 Guideline' },
	naaqs: { annual: 40, daily: 60, label: 'India NAAQS Standard' }
} as const;

/** India National AQI breakpoints for PM2.5 */
export const PM25_AQI_CATEGORIES = [
	{ min: 0, max: 30, label: 'Good', color: '#01AA14' },
	{ min: 31, max: 60, label: 'Satisfactory', color: '#C2ED61' },
	{ min: 61, max: 90, label: 'Moderate', color: '#FFB31C' },
	{ min: 91, max: 120, label: 'Poor', color: '#FF7B27' },
	{ min: 121, max: 250, label: 'Very Poor', color: '#dc2626' },
	{ min: 251, max: Infinity, label: 'Severe', color: '#7f1d1d' }
] as const;

/** Get the AQI category for a given PM2.5 value. */
export function getPM25Category(pm25: number): { label: string; color: string } {
	for (const cat of PM25_AQI_CATEGORIES) {
		if (pm25 >= cat.min && pm25 <= cat.max) {
			return { label: cat.label, color: cat.color };
		}
	}
	return { label: 'Unknown', color: '#999999' };
}

export interface CityPM25 {
	pm25Avg: number;
	pm25Max: number;
	stationsReporting: number;
	readings: number;
}
