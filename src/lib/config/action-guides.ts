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
// Per-city bike-share URLs
// ---------------------------------------------------------------------------

export const BIKE_SHARE_URLS: Record<string, string | null> = {
	ahmedabad: null,
	bengaluru: 'https://www.yulu.bike',
	chennai: null,
	delhi: 'https://www.yulu.bike',
	hyderabad: 'https://www.bounceshare.com',
	indore: null,
	kochi: null,
	mumbai: 'https://www.yulu.bike',
	pune: 'https://www.yulu.bike'
};

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
		label: 'Download the Altmo app',
		description:
			'Track your walks and rides. Every trip you log strengthens your city\'s mobility data and contributes to better infrastructure decisions.',
		icon: 'fa-solid fa-mobile-screen',
		roles: ['everyone'],
		url: 'https://www.altmo.app',
		cityScoped: false
	},
	{
		id: 'use-bike-share',
		label: 'Use bike-share',
		description:
			'Rent a bike for short trips. Bike-share services like Yulu and Bounce make cycling accessible without owning a bicycle.',
		icon: 'fa-solid fa-bicycle',
		roles: ['everyone'],
		url: null, // resolved per-city via BIKE_SHARE_URLS
		cityScoped: true
	},
	{
		id: 'first-last-mile',
		label: 'Walk or cycle to the metro',
		description:
			'First and last mile trips matter. Walking or cycling to transit stops reduces car dependency and is tracked by Altmo as a transit-connected trip.',
		icon: 'fa-solid fa-person-walking-arrow-right',
		roles: ['everyone'],
		url: null,
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
			'Onboard your company onto Altmo to track employee active mobility, measure CO2 offsets, and build ESG-reportable sustainability metrics.',
		icon: 'fa-solid fa-building',
		roles: ['corporate'],
		url: 'https://www.altmo.app',
		cityScoped: false
	},
	{
		id: 'cycling-challenge',
		label: 'Run an employee cycling challenge',
		description:
			'Launch a 30-day cycling challenge for employees. Companies that run challenges see 3x engagement spikes in active commuting.',
		icon: 'fa-solid fa-trophy',
		roles: ['corporate'],
		url: null,
		cityScoped: false
	},
	{
		id: 'incentivize-flm',
		label: 'Incentivize first/last mile',
		description:
			'Encourage employees to walk or cycle to transit stops. Provide secure bike parking at office campuses and subsidize bike-share memberships.',
		icon: 'fa-solid fa-route',
		roles: ['corporate'],
		url: null,
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
			resolved.url = BIKE_SHARE_URLS[cityId] ?? null;
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
