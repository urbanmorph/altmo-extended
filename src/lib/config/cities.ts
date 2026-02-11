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
	metroLines?: string;
	metroGTFS?: string;
	cycleways?: string;
	metroOverpass?: { network: string; lines: Record<string, string> };
}

/**
 * Transit data source URLs per city.
 * TransitRouter (MIT): https://github.com/Vonter/transitrouter
 * Namma Metro: https://github.com/geohacker/namma-metro
 *
 * TransitRouter city codes:
 *   blr=Bengaluru, chennai=Chennai, delhi=Delhi,
 *   telangana=Hyderabad (TSRTC), kochi=Kochi, pune=Pune
 */
function transitRouterSources(code: string): Pick<TransitDataSources, 'busStops' | 'busServices'> {
	const base = `https://raw.githubusercontent.com/Vonter/transitrouter/main/data/${code}`;
	return {
		busStops: `${base}/stops.min.json`,
		busServices: `${base}/services.min.json`
	};
}

const BENGALURU_TRANSIT: TransitDataSources = {
	...transitRouterSources('blr'),
	metroStations: 'https://raw.githubusercontent.com/geohacker/namma-metro/master/metro-lines-stations.geojson'
};

const DELHI_TRANSIT: TransitDataSources = {
	...transitRouterSources('delhi'),
	metroStations: 'https://raw.githubusercontent.com/dhirajt/delhi-metro-stations/master/metro.json',
	metroLines: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/delhi/Delhi_NCR_metro_lines.json'
};

const HYDERABAD_TRANSIT: TransitDataSources = {
	...transitRouterSources('telangana'),
	metroStations: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/hyderabad/Hyderabad_station_buildings.geojson',
	metroLines: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/hyderabad/Hyderabad_public_transport_route.geojson'
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
		zoom: 12,
		transitSources: {
			...transitRouterSources('chennai'),
			metroOverpass: {
				network: 'Chennai Metro',
				lines: { 'Blue Line': '#2563eb', 'Green Line': '#16a34a' }
			}
		}
	},
	{
		id: 'delhi',
		name: 'Delhi',
		lat: 28.6139,
		lng: 77.209,
		zoom: 11,
		transitSources: DELHI_TRANSIT
	},
	{
		id: 'hyderabad',
		name: 'Hyderabad',
		lat: 17.385,
		lng: 78.4867,
		zoom: 12,
		transitSources: HYDERABAD_TRANSIT
	},
	{
		id: 'kochi',
		name: 'Kochi',
		lat: 9.9312,
		lng: 76.2673,
		zoom: 13,
		transitSources: {
			...transitRouterSources('kochi'),
			metroGTFS: 'http://kochimetro.org/opendata/KMRLOpenData.zip'
		}
	},
	{
		id: 'pune',
		name: 'Pune',
		lat: 18.5204,
		lng: 73.8567,
		zoom: 12,
		transitSources: {
			...transitRouterSources('pune'),
			metroOverpass: {
				network: 'Pune Metro',
				lines: { 'Purple Line': '#9333ea', 'Aqua Line': '#06b6d4' }
			}
		}
	}
];

export const DEFAULT_CITY = CITIES[0]; // Bengaluru

export function getCityById(id: string): CityConfig | undefined {
	return CITIES.find((c) => c.id === id);
}
