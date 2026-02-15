/**
 * Action guides configuration for the "Take Action" section (Section F).
 * Role-aware, city-scoped action items that give users concrete next steps.
 *
 * Used by the city deep-dive page to render actionable CTAs
 * filtered by persona (citizen, corporate, planner, everyone).
 */

import { getCityById } from './cities.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionRole = 'everyone' | 'citizen' | 'corporate' | 'planner';

export interface ActionGuide {
	id: string;
	label: string;
	description: string;
	/** Font Awesome class, e.g. "fa-solid fa-mobile-screen" */
	icon: string;
	roles: ActionRole[];
	/** URL template — {cityId} will be replaced. null = no link */
	url: string | null;
	/** If true, URL varies by city (bike-share apps, OSM editor links) */
	cityScoped: boolean;
}

// ---------------------------------------------------------------------------
// Per-city shared mobility URLs
// ---------------------------------------------------------------------------

/** Pedal bicycle sharing (PBS) — dock-based or dockless bicycle rentals */
export const PBS_URLS: Record<string, { name: string; url: string } | null> = {
	ahmedabad: { name: 'MYBYK', url: 'https://mybyk.in' },
	bengaluru: { name: 'MYBYK', url: 'https://mybyk.in' },
	chennai: { name: 'SmartBike', url: 'https://smartbikemobility.com' },
	delhi: { name: 'SmartBike', url: 'https://smartbikemobility.com' },
	hyderabad: null,
	indore: { name: 'MYBYK', url: 'https://mybyk.in' },
	kochi: { name: 'MYBYK', url: 'https://mybyk.in' },
	mumbai: null,
	pune: null
};

/** Electric micromobility — e-scooters and e-bikes (Yulu etc.) */
export const EMICRO_URLS: Record<string, { name: string; url: string } | null> = {
	ahmedabad: null,
	bengaluru: { name: 'Yulu', url: 'https://www.yulu.bike' },
	chennai: null,
	delhi: { name: 'Yulu', url: 'https://www.yulu.bike' },
	hyderabad: { name: 'Yulu', url: 'https://www.yulu.bike' },
	indore: null,
	kochi: null,
	mumbai: { name: 'Yulu', url: 'https://www.yulu.bike' },
	pune: { name: 'Yulu', url: 'https://www.yulu.bike' }
};

/** Legacy compat — returns the first available shared mobility URL for a city */
export const BIKE_SHARE_URLS: Record<string, string | null> = Object.fromEntries(
	Object.keys(PBS_URLS).map((cityId) => {
		const pbs = PBS_URLS[cityId];
		const emicro = EMICRO_URLS[cityId];
		return [cityId, pbs?.url ?? emicro?.url ?? null];
	})
);

// ---------------------------------------------------------------------------
// OSM editor URL helper
// ---------------------------------------------------------------------------

/**
 * Returns an OpenStreetMap editor URL centred on the given city.
 * Uses coordinates from cities.ts config.
 */
export function getOsmEditorUrl(cityId: string): string | null {
	const city = getCityById(cityId);
	if (!city) return null;
	return `https://www.openstreetmap.org/#map=13/${city.lat}/${city.lng}`;
}

// ---------------------------------------------------------------------------
// Action definitions (canonical list)
// ---------------------------------------------------------------------------

const ACTION_GUIDES: ActionGuide[] = [
	// ── For Everyone ──────────────────────────────────────────────────────
	{
		id: 'download-altmo',
		label: 'Get the Altmo app',
		description:
			'Track every ride, walk, and first/last mile trip. Your data directly improves your city\'s score on this portal. Available on Android and iOS.',
		icon: 'fa-solid fa-mobile-screen',
		roles: ['everyone'],
		url: 'https://www.altmo.app',
		cityScoped: false
	},
	{
		id: 'use-bike-share',
		label: 'Rent a bicycle',
		description:
			'Use public bicycle sharing for short trips. Services like MYBYK and SmartBike offer pedal bicycles — log your ride on Altmo to count it toward your city\'s active mobility stats.',
		icon: 'fa-solid fa-bicycle',
		roles: ['everyone'],
		url: null, // resolved per-city via PBS_URLS
		cityScoped: true
	},
	{
		id: 'use-emicro',
		label: 'Try electric micromobility',
		description:
			'Use electric scooters and e-bikes from services like Yulu for first/last mile trips. A quick, zero-emission way to connect to transit.',
		icon: 'fa-solid fa-bolt',
		roles: ['everyone'],
		url: null, // resolved per-city via EMICRO_URLS
		cityScoped: true
	},
	{
		id: 'first-last-mile',
		label: 'Walk or cycle to the metro',
		description:
			'First and last mile trips matter. Altmo detects when you connect to transit — every trip logged strengthens the case for better pedestrian and cycling infrastructure around stations.',
		icon: 'fa-solid fa-person-walking-arrow-right',
		roles: ['everyone'],
		url: null,
		cityScoped: false
	},
	{
		id: 'rent-out-bicycle',
		label: 'List your bicycle on Altmo Rentals',
		description:
			'Own a bicycle you\'re not using every day? List it on the Altmo Rentals marketplace and help someone in your neighbourhood start cycling.',
		icon: 'fa-solid fa-shop',
		roles: ['everyone'],
		url: 'https://cbs-two.vercel.app',
		cityScoped: false
	},

	// ── For Citizens & Advocates ──────────────────────────────────────────
	{
		id: 'audit-infrastructure',
		label: 'Audit walking infrastructure',
		description:
			'Walk a route in your neighbourhood and note missing footpaths, broken pavements, or unsafe crossings. Report gaps to your city\'s municipal body.',
		icon: 'fa-solid fa-clipboard-check',
		roles: ['citizen'],
		url: null,
		cityScoped: false
	},
	{
		id: 'map-on-osm',
		label: 'Map on OpenStreetMap',
		description:
			'Add footpaths, cycleways, and bus stops to OpenStreetMap. Better map data helps planners and routing apps serve active mobility users.',
		icon: 'fa-solid fa-map-location-dot',
		roles: ['citizen'],
		url: null, // resolved per-city via getOsmEditorUrl()
		cityScoped: true
	},
	{
		id: 'contribute-transitrouter',
		label: 'Contribute to TransitRouter',
		description:
			'Add or verify bus routes for your city on TransitRouter, the open-source Indian transit data project that powers Altmo\'s bus stop layer.',
		icon: 'fa-solid fa-code-pull-request',
		roles: ['citizen'],
		url: 'https://github.com/Vonter/transitrouter',
		cityScoped: false
	},
	{
		id: 'file-rti',
		label: 'File an RTI for transport data',
		description:
			'Use the Right to Information Act to request transport data from city authorities — bus schedules, ridership counts, cycling infrastructure plans, and accident records.',
		icon: 'fa-solid fa-file-signature',
		roles: ['citizen'],
		url: null,
		cityScoped: false
	},

	// ── For Corporates (ESG) ──────────────────────────────────────────────
	{
		id: 'start-altmo-programme',
		label: 'Start an Altmo programme',
		description:
			'Onboard your company onto Altmo to track employee walks, rides, and transit trips. Measure CO2 offsets, generate ESG-reportable metrics, and see your company on this portal.',
		icon: 'fa-solid fa-building',
		roles: ['corporate'],
		url: 'https://altmo.app/corporates',
		cityScoped: false
	},
	{
		id: 'cycling-challenge',
		label: 'Run an employee cycling challenge',
		description:
			'Launch a 30-day cycling challenge on Altmo. Companies that run challenges see 3x engagement spikes in active commuting — and it shows up on your city\'s scorecard.',
		icon: 'fa-solid fa-trophy',
		roles: ['corporate'],
		url: null,
		cityScoped: false
	},
	{
		id: 'incentivize-flm',
		label: 'Incentivize first/last mile',
		description:
			'Encourage employees to walk or cycle to transit stops. Provide secure bike parking, subsidize bike-share memberships, and track the impact on Altmo.',
		icon: 'fa-solid fa-route',
		roles: ['corporate'],
		url: null,
		cityScoped: false
	},
	{
		id: 'corporate-rentals',
		label: 'Set up a campus bike fleet',
		description:
			'List company bicycles on Altmo Rentals for employees to borrow. A shared campus fleet makes first/last mile cycling effortless.',
		icon: 'fa-solid fa-bicycle',
		roles: ['corporate'],
		url: 'https://cbs-two.vercel.app',
		cityScoped: false
	},

	// ── For Planners & Administrators ─────────────────────────────────────
	{
		id: 'publish-gtfs',
		label: 'Publish GTFS feeds',
		description:
			'Publish your city\'s transit schedules in GTFS format. Open transit data enables better routing apps, accessibility analysis, and cross-city benchmarking.',
		icon: 'fa-solid fa-database',
		roles: ['planner'],
		url: 'https://gtfs.org/getting-started/',
		cityScoped: false
	},
	{
		id: 'fund-air-quality',
		label: 'Fund air quality monitoring',
		description:
			'Set up continuous air quality monitoring stations feeding into OpenAQ. Real-time PM2.5 and NO2 data is essential for evidence-based health policy.',
		icon: 'fa-solid fa-wind',
		roles: ['planner'],
		url: 'https://openaq.org',
		cityScoped: false
	},
	{
		id: 'commission-walking-audit',
		label: 'Commission walking audits',
		description:
			'Use ITDP\'s walkability audit framework to systematically assess pedestrian infrastructure quality across the city\'s key corridors.',
		icon: 'fa-solid fa-person-walking',
		roles: ['planner'],
		url: 'https://www.itdp.org/publication/pedestrians-first/',
		cityScoped: false
	},
	{
		id: 'mandate-open-data',
		label: 'Mandate open data policies',
		description:
			'Adopt open data policies for transport, infrastructure, and safety datasets. Cities that publish data openly score higher on data readiness and attract better analysis.',
		icon: 'fa-solid fa-scale-balanced',
		roles: ['planner'],
		url: null,
		cityScoped: false
	}
];

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Returns all action guides with city-specific URLs resolved.
 * - Bike-share URLs are filled from BIKE_SHARE_URLS
 * - OSM editor URLs are generated from city center coordinates
 * - {cityId} placeholders in URL templates are replaced
 */
export function getActionsForCity(cityId: string): ActionGuide[] {
	return ACTION_GUIDES.map((action) => {
		const resolved = { ...action };

		if (action.id === 'use-bike-share') {
			const pbs = PBS_URLS[cityId];
			resolved.url = pbs?.url ?? null;
			if (pbs) resolved.description = resolved.description.replace('MYBYK and SmartBike', pbs.name);
		} else if (action.id === 'use-emicro') {
			const emicro = EMICRO_URLS[cityId];
			resolved.url = emicro?.url ?? null;
			if (emicro) resolved.description = resolved.description.replace('Yulu', emicro.name);
		} else if (action.id === 'map-on-osm') {
			resolved.url = getOsmEditorUrl(cityId);
		} else if (resolved.url && resolved.url.includes('{cityId}')) {
			resolved.url = resolved.url.replace('{cityId}', cityId);
		}

		return resolved;
	});
}

/**
 * Filters action guides by role. The 'everyone' role is always included
 * regardless of the filter — those actions apply to all personas.
 */
export function getActionsForRole(actions: ActionGuide[], role: ActionRole): ActionGuide[] {
	if (role === 'everyone') {
		return actions.filter((a) => a.roles.includes('everyone'));
	}
	return actions.filter((a) => a.roles.includes(role) || a.roles.includes('everyone'));
}
