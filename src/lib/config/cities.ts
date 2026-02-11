/**
 * City definitions and transit data source configuration.
 * Single source of truth — replaces hardcoded cities in CitySelector and layout.server.ts.
 *
 * TODO: Fetch city list from Altmo API once a cities endpoint is available.
 * These are hardcoded Indian cities with transit data as a stopgap.
 */

export interface CityConfig {
	id: string;
	name: string;
	lat: number;
	lng: number;
	zoom: number;
	transitSources?: TransitDataSources;
}

export interface TransitDataSources {
	busStops?: string;
	busServices?: string;
	busRoutes?: string;
	metroStations?: string;
	cycleways?: string;
}

/**
 * Transit data source URLs per city.
 * TransitRouter (MIT): https://github.com/Vonter/transitrouter
 * Namma Metro: https://github.com/geohacker/namma-metro
 */
const BENGALURU_TRANSIT: TransitDataSources = {
	busStops: 'https://raw.githubusercontent.com/Vonter/transitrouter/main/data/blr/stops.min.json',
	busServices: 'https://raw.githubusercontent.com/Vonter/transitrouter/main/data/blr/services.min.json',
	metroStations: 'https://raw.githubusercontent.com/geohacker/namma-metro/master/metro-lines-stations.geojson'
};

export const CITIES: CityConfig[] = [
	{
		id: 'bengaluru',
		name: 'Bengaluru',
		lat: 12.9716,
		lng: 77.5946,
		zoom: 12,
		transitSources: BENGALURU_TRANSIT
	},
	{
		id: 'chennai',
		name: 'Chennai',
		lat: 13.0827,
		lng: 80.2707,
		zoom: 12
	},
	{
		id: 'delhi',
		name: 'Delhi',
		lat: 28.6139,
		lng: 77.209,
		zoom: 11
	},
	{
		id: 'hyderabad',
		name: 'Hyderabad',
		lat: 17.385,
		lng: 78.4867,
		zoom: 12
	},
	{
		id: 'kochi',
		name: 'Kochi',
		lat: 9.9312,
		lng: 76.2673,
		zoom: 13
	},
	{
		id: 'pune',
		name: 'Pune',
		lat: 18.5204,
		lng: 73.8567,
		zoom: 12
	}
];

export const DEFAULT_CITY = CITIES[0]; // Bengaluru

export function getCityById(id: string): CityConfig | undefined {
	return CITIES.find((c) => c.id === id);
}
