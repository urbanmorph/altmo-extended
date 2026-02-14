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

export interface SuburbanRailQuery {
	network: string;
	operator?: string;
	lines: Record<string, string>; // display name -> hex color
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
	suburbanRailOverpass?: { queries: SuburbanRailQuery[] };
}

/**
 * Transit data source URLs per city.
 * TransitRouter (MIT): https://github.com/Vonter/transitrouter
 * Namma Metro: https://github.com/geohacker/namma-metro
 *
 * TransitRouter city codes:
 *   blr=Bengaluru, chennai=Chennai, delhi=Delhi,
 *   telangana=Hyderabad (TSRTC), indore=Indore, kochi=Kochi, pune=Pune
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
	metroLines: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/hyderabad/Hyderabad_public_transport_route.geojson',
	suburbanRailOverpass: {
		queries: [{
			network: 'Hyderabad MMTS',
			lines: {
				'Lingampalli-Falaknuma': '#dc2626',
				'Secunderabad-Medchal': '#2563eb',
				'Lingampalli-Ghatkesar': '#16a34a'
			}
		}]
	}
};

const AHMEDABAD_TRANSIT: TransitDataSources = {
	...transitRouterSources('ahmedabad'),
	metroOverpass: {
		network: 'Ahmedabad Metro',
		lines: {
			'Blue Line (East-West)': '#2563eb',
			'Red Line (North-South)': '#dc2626'
		}
	}
};

const MUMBAI_TRANSIT: TransitDataSources = {
	// TransitRouter does NOT have Mumbai — bus data from ChaloBEST/OpenCity
	metroOverpass: {
		network: 'Mumbai Metro',
		lines: {
			'Blue Line (Line 1)': '#2563eb',
			'Yellow Line (Line 2A)': '#eab308',
			'Red Line (Line 7)': '#dc2626',
			'Aqua Line (Line 3)': '#06b6d4'
		}
	},
	suburbanRailOverpass: {
		queries: [{
			network: 'Mumbai Suburban Railway',
			lines: {
				'Western Line': '#2563eb',
				'Central Line': '#dc2626',
				'Harbour Line': '#16a34a',
				'Trans-Harbour Line': '#9333ea',
				'Vasai-Diva Line': '#f97316',
				'Nerul-Uran Line': '#06b6d4'
			}
		}]
	}
};

export const CITIES: CityConfig[] = [
	{
		id: 'ahmedabad',
		name: 'Ahmedabad',
		lat: 23.0225,
		lng: 72.5714,
		zoom: 12,
		transitSources: AHMEDABAD_TRANSIT
	},
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
			},
			suburbanRailOverpass: {
				queries: [
					{
						network: 'Southern Railway',
						operator: 'Chennai Suburban Railway',
						lines: {
							'Beach-Tambaram': '#dc2626',
							'Beach-Velachery': '#9333ea',
							'Chennai Central-Arakkonam': '#2563eb',
							'Chennai Central-Tiruvallur': '#f97316',
							'Chennai Central-Gummidipoondi': '#16a34a'
						}
					},
					{
						network: 'Chennai MRTS',
						lines: {
							'MRTS (Beach-Velachery)': '#ec4899'
						}
					}
				]
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
		id: 'indore',
		name: 'Indore',
		lat: 22.7196,
		lng: 75.8577,
		zoom: 12,
		transitSources: transitRouterSources('indore')
	},
	{
		id: 'kochi',
		name: 'Kochi',
		lat: 9.9312,
		lng: 76.2673,
		zoom: 13,
		transitSources: {
			...transitRouterSources('kochi'),
			metroGTFS: 'https://kochimetro.org/opendata/KMRLOpenData.zip'
		}
	},
	{
		id: 'mumbai',
		name: 'Mumbai',
		lat: 19.076,
		lng: 72.8777,
		zoom: 11,
		transitSources: MUMBAI_TRANSIT
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
			},
			suburbanRailOverpass: {
				queries: [{
					network: 'Pune Suburban Railway',
					lines: {
						'Pune-Lonavala': '#dc2626'
					}
				}]
			}
		}
	}
];

export const DEFAULT_CITY = CITIES[0]; // Bengaluru

export function getCityById(id: string): CityConfig | undefined {
	return CITIES.find((c) => c.id === id);
}
