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
 *
 * Satellite city coverage:
 * - Delhi includes NCR satellites: Noida, Gurugram, Ghaziabad
 * - Mumbai includes MMR satellites: Thane, Navi Mumbai
 * - Pune includes PCMC: Pimpri-Chinchwad
 *
 * TODO: Populate satellite city sensor IDs once OpenAQ API key is renewed.
 * The OPENAQ_API_KEY expired/became invalid as of 2026-02-15.
 * Renew at https://explore.openaq.org/account, then run these discovery queries:
 *
 * Noida:            /v3/locations?coordinates=28.5355,77.3910&radius=25000&parameters_id=2
 * Gurugram:         /v3/locations?coordinates=28.4595,77.0266&radius=25000&parameters_id=2
 * Ghaziabad:        /v3/locations?coordinates=28.6692,77.4538&radius=25000&parameters_id=2
 * Mumbai (primary): /v3/locations?coordinates=19.076,72.878&radius=25000&parameters_id=2
 * Thane:            /v3/locations?coordinates=19.2183,72.9780&radius=25000&parameters_id=2
 * Navi Mumbai:      /v3/locations?coordinates=19.0330,73.0297&radius=25000&parameters_id=2
 * Pimpri-Chinchwad: /v3/locations?coordinates=18.6298,73.8000&radius=25000&parameters_id=2
 *
 * For each location returned, get sensor IDs via: /v3/locations/{locationId}/sensors
 * Pick sensors where parameter.name === "pm25" and lastUpdated is recent (2025+).
 *
 * Known OpenAQ location counts (from search, unverified):
 * - Noida: 1 location, Ghaziabad: 2 locations, Thane: 3 locations, Navi Mumbai: 1 location
 * - Mumbai (IITM stations): location IDs 12024 (Chakala-Andheri East), 3409329 (Deonar)
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
		name: 'National Capital Region',
		// Delhi-proper (10 sensors)
		// TODO: Add Noida sensors (discover via coordinates 28.5355,77.3910)
		// TODO: Add Gurugram sensors (discover via coordinates 28.4595,77.0266)
		// TODO: Add Ghaziabad sensors (discover via coordinates 28.6692,77.4538)
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
	kolkata: {
		name: 'Kolkata Metropolitan Region',
		sensorIds: [] // Discover via: /v3/locations?coordinates=22.573,88.364&radius=25000&parameters_id=2
	},
	mumbai: {
		name: 'Mumbai Metropolitan Region',
		// TODO: Add Mumbai-proper sensors (discover via coordinates 19.076,72.878)
		//   Known locations: 12024 (Chakala-Andheri East, IITM), 3409329 (Deonar, IITM)
		// TODO: Add Thane sensors (discover via coordinates 19.2183,72.9780)
		// TODO: Add Navi Mumbai sensors (discover via coordinates 19.0330,73.0297)
		sensorIds: []
	},
	pune: {
		name: 'Pune',
		// Pune-proper (7 sensors)
		// TODO: Add Pimpri-Chinchwad sensors (discover via coordinates 18.6298,73.8000)
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
	kolkata: { name: 'Kolkata', sensorIds: [] },
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
	/** True when using CPCB 2023 annual averages instead of live OpenAQ data. */
	isFallback?: boolean;
}

/**
 * CPCB 2023 annual average PM2.5 fallback values (µg/m³).
 * Used when OpenAQ API is unavailable (key expired, account suspended, etc.).
 * Sources: CPCB Annual Reports 2023, IQAir World Air Quality Report 2023,
 * UrbanEmissions city-level estimates.
 */
export const PM25_FALLBACK: Record<string, CityPM25> = {
	ahmedabad: { pm25Avg: 55, pm25Max: 89, stationsReporting: 0, readings: 0, isFallback: true },
	bengaluru: { pm25Avg: 34, pm25Max: 62, stationsReporting: 0, readings: 0, isFallback: true },
	chennai:   { pm25Avg: 31, pm25Max: 55, stationsReporting: 0, readings: 0, isFallback: true },
	delhi:     { pm25Avg: 99, pm25Max: 312, stationsReporting: 0, readings: 0, isFallback: true },
	hyderabad: { pm25Avg: 37, pm25Max: 68, stationsReporting: 0, readings: 0, isFallback: true },
	indore:    { pm25Avg: 56, pm25Max: 94, stationsReporting: 0, readings: 0, isFallback: true },
	kochi:     { pm25Avg: 27, pm25Max: 48, stationsReporting: 0, readings: 0, isFallback: true },
	kolkata:   { pm25Avg: 60, pm25Max: 105, stationsReporting: 0, readings: 0, isFallback: true },
	mumbai:    { pm25Avg: 38, pm25Max: 72, stationsReporting: 0, readings: 0, isFallback: true },
	pune:      { pm25Avg: 36, pm25Max: 65, stationsReporting: 0, readings: 0, isFallback: true }
};
