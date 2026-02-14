/**
 * Air quality configuration: station mapping, thresholds, categories.
 * Covers PM2.5 and NO2 parameters from OpenAQ/CPCB stations.
 * Shared between server and client code.
 */

/**
 * OpenAQ v3 PM2.5 sensor IDs for monitoring stations near each Altmo city.
 * v3 uses sensor-based endpoints: /sensors/{id}/measurements
 * Discovered via: /v3/locations?coordinates={lat},{lng}&radius=25000&parameters_id=2
 * then /v3/locations/{id}/sensors to find active PM2.5 sensor IDs (last reported 2025+).
 */
export const CITY_OPENAQ_SENSORS: Record<string, { name: string; sensorIds: number[] }> = {
	ahmedabad: {
		name: 'Ahmedabad',
		sensorIds: [] // Discover via: /v3/locations?coordinates=23.023,72.571&radius=25000&parameters_id=2
	},
	bengaluru: {
		name: 'Bengaluru',
		sensorIds: [12235361, 12235370, 12235267, 12235240, 12235285, 12235258, 12235249]
	},
	chennai: {
		name: 'Chennai',
		sensorIds: [12235653, 12235531, 12235796, 12236299, 12236308, 12236274, 12236290]
	},
	delhi: {
		name: 'Delhi',
		sensorIds: [12234787, 12234796, 12235610, 12234702, 12234684, 12234708, 12234769, 12235187, 12234690, 12234753]
	},
	hyderabad: {
		name: 'Hyderabad',
		sensorIds: [12235583, 12235400, 12242121, 12242129, 12237098, 12237125, 12237116]
	},
	indore: {
		name: 'Indore',
		sensorIds: [12234921, 12237818, 12238477, 12238486, 12815122, 12238495]
	},
	kochi: {
		name: 'Kochi',
		sensorIds: [12235842]
	},
	mumbai: {
		name: 'Mumbai',
		sensorIds: [] // Discover via: /v3/locations?coordinates=19.076,72.878&radius=25000&parameters_id=2
	},
	pune: {
		name: 'Pune',
		sensorIds: [12235540, 12236443, 12236457, 12236463, 12236449, 12304615, 12237987]
	}
};

/**
 * OpenAQ v3 NO2 sensor IDs for monitoring stations near each Altmo city.
 * v3 uses sensor-based endpoints: /sensors/{id}/measurements
 * Discovered via: /v3/locations?coordinates={lat},{lng}&radius=25000&parameters_id=4
 * then /v3/locations/{id}/sensors to find active NO2 sensor IDs.
 *
 * Cities with empty sensorIds fall back to hardcoded values in city-qol-data.ts.
 * To populate: run the discovery query above with OPENAQ_API_KEY set.
 */
export const CITY_OPENAQ_NO2_SENSORS: Record<string, { name: string; sensorIds: number[] }> = {
	ahmedabad: { name: 'Ahmedabad', sensorIds: [] },
	bengaluru: { name: 'Bengaluru', sensorIds: [] },
	chennai: { name: 'Chennai', sensorIds: [] },
	delhi: { name: 'Delhi', sensorIds: [] },
	hyderabad: { name: 'Hyderabad', sensorIds: [] },
	indore: { name: 'Indore', sensorIds: [] },
	kochi: { name: 'Kochi', sensorIds: [] },
	mumbai: { name: 'Mumbai', sensorIds: [] },
	pune: { name: 'Pune', sensorIds: [] }
};

export interface CityNO2 {
	no2Avg: number;
	no2Max: number;
	stationsReporting: number;
	readings: number;
}

/**
 * NO2 reference thresholds (ug/m3).
 * WHO 2021 annual guideline: 10
 * India NAAQS annual standard: 40
 */
export const NO2_THRESHOLDS = {
	who: { annual: 10, label: 'WHO 2021 Guideline' },
	naaqs: { annual: 40, label: 'India NAAQS Standard' }
} as const;

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
