/**
 * City deep-dive page — consolidated data loader.
 *
 * Gathers ALL data for a single city from multiple sources:
 *   - QoL scoring (ETQOLI composite, dimensions, gap analysis)
 *   - Live overrides (safety, air quality, congestion, transit, cycle infra)
 *   - Transit network (static JSON preferred, live Overpass fallback)
 *   - Activity data (summary, hourly, trends, corridors, distance distribution, transit proximity)
 *   - Scenario engine defaults (intervention sliders, presets)
 *   - Data readiness (layer availability scores)
 *   - Global stats (trust bar / impact numbers)
 *   - Geo markers (company/campus locations for map)
 *
 * Validates cityId param against CITIES — returns 404 if invalid.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { CITIES, getCityById } from '$lib/config/cities';
import { computeCityQoL, computeAllQoL } from '$lib/config/city-qol-data';
import { computeCityGap } from '$lib/config/city-qol-gaps';
import { buildQoLOverrides } from '$lib/server/qol-overrides';
import { getStaticTransitData } from '$lib/server/transit-static';
import { fetchTransitData, fetchMetroRidership } from '$lib/server/transit-data';
import {
	getActivitySummary,
	getActivityByHour,
	getActivityByDayOfWeek,
	getTopCorridors,
	getActivityTrends,
	getDistanceDistribution,
	getTransitProximity,
	getRouteDensity
} from '$lib/server/activity-data';
import { getCityPM25, getCityNO2 } from '$lib/server/air-quality';
import { getLatestSafetyData, getSafetyTrends } from '$lib/server/safety-data';
import { getCityCongestion } from '$lib/server/traffic-flow';
import { getGeoMarkers } from '$lib/server/altmo-core';
import {
	SCENARIO_PRESETS,
	INTERVENTIONS,
	getDefaultInterventions,
	getCityRailKm,
	computeScenarioResult,
	resolvePresetForCity
} from '$lib/config/scenarios';
import {
	getReadiness,
	computeReadinessScore,
	DATA_LAYERS
} from '$lib/config/data-readiness';
import { computeMetrics } from '$lib/utils/transit';

export const load: PageServerLoad = async ({ params }) => {
	const { cityId } = params;

	// Validate cityId against known cities — 404 if invalid
	const city = getCityById(cityId);
	if (!city) {
		error(404, {
			message: `City "${cityId}" not found. Valid cities: ${CITIES.map((c) => c.id).join(', ')}`
		});
	}

	// ── Phase 1: Kick off independent fetches in parallel ──
	//
	// Optimization notes:
	// - buildQoLOverrides() fetches safety/PM25/NO2/congestion for ALL cities (needed for ranking).
	//   Those calls populate per-city caches, so getCityPM25(cityId) etc. hit warm cache.
	// - Activity functions share a single Supabase query (getCityMonthlyData) with 1h cache.
	//   Only the first call hits Supabase; the rest (14 calls) read from cache.
	// - getRouteDensity is a separate paginated Supabase query.
	// - getGeoMarkers reads from static JSON (instant).

	const [
		qolOverrides,
		geoMarkers,
		// Activity: first call fetches from Supabase, rest hit cache
		activitySummary,
		commuteSummary,
		leisureSummary,
		activityHourly,
		commuteHourly,
		leisureHourly,
		weekday,
		leisureWeekday,
		topCorridors,
		commuteCorridors,
		leisureCorridors,
		activityTrends,
		distanceDistribution,
		transitProximity,
		densityCells,
		// Safety trends (separate Supabase query)
		safetyTrends,
		// Metro ridership (Bengaluru only, GitHub fetch)
		ridership
	] = await Promise.all([
		buildQoLOverrides(),
		getGeoMarkers(),
		// Activity
		getActivitySummary(cityId),
		getActivitySummary(cityId, 'commute'),
		getActivitySummary(cityId, 'leisure'),
		getActivityByHour(cityId),
		getActivityByHour(cityId, 'commute'),
		getActivityByHour(cityId, 'leisure'),
		getActivityByDayOfWeek(cityId),
		getActivityByDayOfWeek(cityId, 'leisure'),
		getTopCorridors(cityId, 20),
		getTopCorridors(cityId, 10, 'commute'),
		getTopCorridors(cityId, 10, 'leisure'),
		getActivityTrends(cityId),
		getDistanceDistribution(cityId),
		getTransitProximity(cityId),
		getRouteDensity(cityId),
		// Safety trends
		getSafetyTrends(),
		// Ridership
		fetchMetroRidership(cityId)
	]);

	// ── Phase 1b: Per-city environmental data (hits warm cache from buildQoLOverrides) ──

	const [cityPM25, cityNO2, cityCongestion, safetyData] = await Promise.all([
		getCityPM25(cityId),
		getCityNO2(cityId),
		getCityCongestion(cityId),
		getLatestSafetyData()
	]);

	// ── Phase 2: Transit data (static preferred, live fallback) ──

	let transitData = getStaticTransitData(cityId);
	if (!transitData && city.transitSources) {
		transitData = await fetchTransitData(cityId);
	}
	const emptyTransit = { busStops: [], metroStations: [], metroLines: [], railStations: [], railLines: [] };
	const transit = transitData ?? emptyTransit;
	const transitMetrics = computeMetrics(transit, 0);

	// ── Phase 3: Compute QoL score + gap analysis (uses overrides) ──

	const qolScore = computeCityQoL(cityId, qolOverrides);
	const gapAnalysis = computeCityGap(cityId, qolOverrides);

	// All-city QoL scores for ranking context
	const allQoLScores = computeAllQoL(qolOverrides);
	const cityRank = allQoLScores.findIndex((s) => s.cityId === cityId) + 1;

	// ── Phase 4: Derived activity metrics ──

	// Month-over-month growth
	let momGrowth: number | null = null;
	if (activityTrends.length >= 2) {
		const latest = activityTrends[activityTrends.length - 1];
		const prev = activityTrends[activityTrends.length - 2];
		const latestTotal = latest.rides + latest.walks + latest.runs;
		const prevTotal = prev.rides + prev.walks + prev.runs;
		if (prevTotal > 0) {
			momGrowth = Math.round(((latestTotal - prevTotal) / prevTotal) * 1000) / 10;
		}
	}

	// Peak hour
	let peakHour = '';
	if (activityHourly.length > 0) {
		const peak = activityHourly.reduce((max, h) => (h.count > max.count ? h : max), activityHourly[0]);
		if (peak.count > 0) {
			const h = peak.hour;
			peakHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
		}
	}

	// Commute share
	const commuteShare =
		activitySummary.totalTrips > 0
			? Math.round((commuteSummary.totalTrips / activitySummary.totalTrips) * 1000) / 10
			: 0;

	// Weekend share (leisure)
	const weekendCount = leisureWeekday
		.filter((d) => d.day === 'Sat' || d.day === 'Sun')
		.reduce((sum, d) => sum + d.count, 0);
	const weekendShare =
		leisureSummary.totalTrips > 0
			? Math.round((weekendCount / leisureSummary.totalTrips) * 1000) / 10
			: 0;

	// ── Phase 5: Scenario defaults ──

	const scenarioDefaults = getDefaultInterventions(cityId, qolOverrides);
	const cityRailKm = getCityRailKm(cityId, qolOverrides);

	// Compute a few key preset scenarios for the city
	const keyPresets = SCENARIO_PRESETS.filter((p) => p.key !== 'reset').slice(0, 5);
	const computedScenarios = keyPresets
		.map((preset) => {
			const resolved = resolvePresetForCity(preset, cityId, qolOverrides);
			const result = computeScenarioResult(cityId, resolved, qolOverrides);
			if (!result) return null;
			return {
				id: preset.key,
				name: preset.label,
				description: preset.description,
				score: result.scenario.composite
			};
		})
		.filter((s): s is NonNullable<typeof s> => s !== null);

	// ── Phase 6: Data readiness ──

	const dataReadiness = getReadiness(cityId);
	const readinessScore = computeReadinessScore(cityId);

	// ── Phase 7: Safety for this city ──

	const citySafety = safetyData[cityId] ?? null;
	const citySafetyTrend = safetyTrends[cityId] ?? [];

	// ── Phase 8: Geo markers filtered by city ──

	// Rails city_id mapping (same as activity-data.ts)
	const CITY_SLUG_TO_RAILS_ID: Record<string, number> = {
		ahmedabad: 18220,
		bengaluru: 18326,
		chennai: 18586,
		delhi: 18215,
		hyderabad: 18629,
		indore: 18396,
		kochi: 18363,
		mumbai: 18445,
		pune: 18455
	};
	const railsCityId = CITY_SLUG_TO_RAILS_ID[cityId];
	const cityGeoMarkers = geoMarkers
		? geoMarkers.filter((m) => m.cityId === railsCityId)
		: [];

	// ── Phase 9: Company presence from geo markers ──

	// Count facilities per company — more facilities suggests larger presence
	const companyCounts = new Map<string, number>();
	for (const m of cityGeoMarkers) {
		if (m.type !== 'Company') continue;
		const name = m.name?.trim();
		if (!name) continue;
		companyCounts.set(name, (companyCounts.get(name) ?? 0) + 1);
	}
	// Sort by facility count (desc), then alphabetically for ties
	const uniqueCompanyNames = [...companyCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name);

	// ── Return consolidated data ──

	return {
		// City identity
		cityId,
		cityName: city.name,
		cityCenter: [city.lng, city.lat] as [number, number],
		cityZoom: city.zoom,

		// QoL scoring
		qolScore,
		qolOverrides,
		gapAnalysis,
		cityRank,
		totalCities: allQoLScores.length,

		// Transit network
		transit,
		transitMetrics,
		ridership,

		// Activity data
		activity: {
			summary: activitySummary,
			commuteSummary,
			leisureSummary,
			hourly: activityHourly,
			commuteHourly,
			leisureHourly,
			weekday,
			leisureWeekday,
			topCorridors,
			commuteCorridors,
			leisureCorridors,
			trends: activityTrends,
			distanceDistribution,
			transitProximity,
			densityCells,
			// Derived metrics
			momGrowth,
			peakHour,
			commuteShare,
			weekendShare
		},

		// Environmental & safety
		environmental: {
			pm25: cityPM25,
			no2: cityNO2,
			congestion: cityCongestion,
			safety: citySafety,
			safetyTrend: citySafetyTrend
		},

		// Geo markers (for map)
		geoMarkers: cityGeoMarkers,

		// Company presence
		companies: {
			count: uniqueCompanyNames.length,
			names: uniqueCompanyNames.slice(0, 15) // Top 15 for display
		},

		// Scenario engine
		scenario: {
			defaults: scenarioDefaults,
			railKm: cityRailKm,
			presets: SCENARIO_PRESETS,
			interventions: INTERVENTIONS
		},
		computedScenarios,

		// Data readiness
		dataReadiness,
		readinessScore,
		dataLayers: DATA_LAYERS
	};
};
