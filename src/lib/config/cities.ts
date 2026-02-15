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
	/** Subtitle listing member cities in a region, e.g. "Delhi, Noida, Gurugram, Ghaziabad" */
	regionCities?: string;
	lat: number;
	lng: number;
	zoom: number;
	/** Rails API city_ids for activity/geo-marker aggregation (primary + satellite cities) */
	railsCityIds: number[];
	transitSources?: TransitDataSources;
}

export interface SuburbanRailQuery {
	network: string;
	operator?: string;
	/** Overpass route type — defaults to 'train'. Use 'subway' for systems tagged as subway in OSM (e.g. Delhi RRTS / RapidX). */
	routeType?: 'train' | 'subway' | 'light_rail';
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
	/** Fetch bus stops from Overpass when TransitRouter data is unavailable */
	busStopsOverpass?: { city: string };
	metroOverpass?: { network: string; lines: Record<string, string> };
	suburbanRailOverpass?: { queries: SuburbanRailQuery[] };
	/**
	 * Whitelist of operational metro/rail line names for scoring.
	 * When set, only stations on these lines are used for transit proximity
	 * scoring and QoL rail_transit_km computation. Stations on unlisted lines
	 * (planned/under construction) are excluded from scoring but still shown
	 * on the transit map for reference.
	 *
	 * Line names must match the `line` field on parsed station objects.
	 * When not set, all lines are included (assumed operational).
	 */
	operationalLines?: string[];
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
	metroStations: 'https://raw.githubusercontent.com/geohacker/namma-metro/master/metro-lines-stations.geojson',
	// Blue (ORR) and Pink (RV Road-Bommasandra extension) are under construction
	operationalLines: ['green', 'purple', 'yellow']
};

const DELHI_TRANSIT: TransitDataSources = {
	...transitRouterSources('delhi'),
	metroStations: 'https://raw.githubusercontent.com/dhirajt/delhi-metro-stations/master/metro.json',
	metroLines: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/delhi/Delhi_NCR_metro_lines.json',
	suburbanRailOverpass: {
		queries: [{
			network: 'RapidX',
			routeType: 'subway',
			lines: {
				'Delhi-Meerut RRTS': '#F0631E'
			}
		}]
	}
};

const HYDERABAD_TRANSIT: TransitDataSources = {
	...transitRouterSources('telangana'),
	metroStations: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/hyderabad/Hyderabad_station_buildings.geojson',
	metroLines: 'https://raw.githubusercontent.com/kavyajeetbora/metro_accessibility/master/data/hyderabad/Hyderabad_public_transport_route.geojson',
	suburbanRailOverpass: {
		queries: [{
			network: 'Hyderabad MMTS',
			lines: {
				'MMTS': '#dc2626'
			}
		}]
	}
};

const AHMEDABAD_TRANSIT: TransitDataSources = {
	busStopsOverpass: { city: 'Ahmedabad' },
	metroOverpass: {
		network: 'Ahmedabad Metro',
		lines: {
			'Blue Line (East-West)': '#2563eb',
			'Red Line (North-South)': '#dc2626'
		}
	}
};

const KOLKATA_TRANSIT: TransitDataSources = {
	busStopsOverpass: { city: 'Kolkata' },
	metroOverpass: {
		network: 'Kolkata Metro',
		lines: {
			'Blue Line (North-South)': '#2563eb',
			'Green Line (East-West)': '#16a34a',
			'Orange Line (Joka-Esplanade)': '#f97316',
			'Purple Line (Baranagar-Barrackpore)': '#9333ea',
			'Yellow Line (Noapara-Jai Hind)': '#eab308'
		}
	},
	operationalLines: [
		'Blue Line (North-South)', 'Green Line (East-West)',
		'Orange Line (Joka-Esplanade)', 'Purple Line (Baranagar-Barrackpore)',
		'Yellow Line (Noapara-Jai Hind)'
	],
	suburbanRailOverpass: {
		queries: [
			{
				network: 'Eastern Railway',
				operator: 'Kolkata Suburban Railway',
				lines: {
					'Eastern Railway Suburban': '#2563eb'
				}
			},
			{
				network: 'South Eastern Railway',
				lines: {
					'South Eastern Railway Suburban': '#dc2626'
				}
			}
		]
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
		railsCityIds: [18220],
		transitSources: AHMEDABAD_TRANSIT
	},
	{
		id: 'bengaluru',
		name: 'Bengaluru',
		lat: 12.9716,
		lng: 77.5946,
		zoom: 12,
		railsCityIds: [18326],
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
							'Chennai Suburban': '#2563eb'
						}
					},
					{
						network: 'Chennai MRTS',
						lines: {
							'MRTS': '#ec4899'
						}
					}
				]
			}
		},
		railsCityIds: [18586]
	},
	{
		id: 'delhi',
		name: 'National Capital Region',
		regionCities: 'Delhi, Noida, Gurugram, Ghaziabad',
		lat: 28.6139,
		lng: 77.209,
		zoom: 11,
		railsCityIds: [18215, 18714, 18258, 18685],
		transitSources: DELHI_TRANSIT
	},
	{
		id: 'hyderabad',
		name: 'Hyderabad',
		lat: 17.385,
		lng: 78.4867,
		zoom: 12,
		railsCityIds: [18629],
		transitSources: HYDERABAD_TRANSIT
	},
	{
		id: 'indore',
		name: 'Indore',
		lat: 22.7196,
		lng: 75.8577,
		zoom: 12,
		railsCityIds: [18396],
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
		},
		railsCityIds: [18363]
	},
	{
		id: 'kolkata',
		name: 'Kolkata Metropolitan Region',
		regionCities: 'Kolkata, New Town Kolkata',
		lat: 22.5726,
		lng: 88.3639,
		zoom: 12,
		railsCityIds: [18765, 18769],
		transitSources: KOLKATA_TRANSIT
	},
	{
		id: 'mumbai',
		name: 'Mumbai Metropolitan Region',
		regionCities: 'Mumbai, Thane, Kalyan-Dombivli, Navi Mumbai',
		lat: 19.076,
		lng: 72.8777,
		zoom: 11,
		railsCityIds: [18445, 18460, 18442],
		transitSources: MUMBAI_TRANSIT
	},
	{
		id: 'pune',
		name: 'Pune Metropolitan Region',
		regionCities: 'Pune, Pimpri-Chinchwad',
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
		},
		railsCityIds: [18455, 18454]
	}
];

export const DEFAULT_CITY = CITIES[0]; // Bengaluru

export function getCityById(id: string): CityConfig | undefined {
	return CITIES.find((c) => c.id === id);
}

/** Get Rails API city_ids for a city slug — includes satellite cities for regions. */
export function getRailsCityIds(cityId: string): number[] {
	return getCityById(cityId)?.railsCityIds ?? [];
}
