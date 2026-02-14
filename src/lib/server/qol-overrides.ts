/**
 * Shared QoL overrides builder — SINGLE SOURCE OF TRUTH for all live data overrides.
 *
 * Fetches live data from all automated sources and assembles a QoLOverrides object
 * for use in computeCityQoL(). Every page that displays QoL scores calls this function.
 *
 * IMPORTANT: When adding a new live data source, wire it HERE so all pages
 * (home, benchmark, forecast, access, pulse) automatically reflect the new data.
 * Do NOT add local per-page overrides — that causes score drift between pages.
 *
 * Current live sources:
 *   - Safety: traffic_fatalities, vru_fatality_share  (Supabase)
 *   - Air quality: pm25_annual, no2_annual            (OpenAQ v3)
 *   - Congestion: congestion_level                    (TomTom Traffic Flow)
 *   - Rail transit: rail_transit_km                   (Overpass API — metro + suburban)
 */

import { getLatestSafetyData } from './safety-data';
import { getAllCityPM25, getAllCityNO2 } from './air-quality';
import { getAllCityCongestion } from './traffic-flow';
import { fetchTransitData } from './transit-data';
import { CITIES } from '$lib/config/cities';
import { computeMetroNetworkKm, computeRailNetworkKm } from '$lib/utils/transit';
import type { QoLOverrides } from '$lib/config/city-qol-data';

interface RailBreakdown {
	totalKm: number;
	metroKm: number;
	suburbanRailKm: number;
}

/**
 * Fetch live rail transit km (metro + suburban) for all cities.
 * Uses 24h-cached transit data. Returns breakdown per city.
 */
async function buildRailTransitOverrides(): Promise<Record<string, RailBreakdown>> {
	const results: Record<string, RailBreakdown> = {};

	const transitResults = await Promise.all(
		CITIES.filter((c) => c.transitSources).map(async (city) => {
			try {
				const data = await fetchTransitData(city.id);
				const metroKm = computeMetroNetworkKm(data.metroLines);
				const suburbanRailKm = computeRailNetworkKm(data.railLines);
				return { cityId: city.id, metroKm, suburbanRailKm, totalKm: metroKm + suburbanRailKm };
			} catch (e) {
				console.error(`[qol-overrides] Rail transit fetch failed for ${city.id}:`, (e as Error).message);
				return { cityId: city.id, metroKm: 0, suburbanRailKm: 0, totalKm: 0 };
			}
		})
	);

	for (const { cityId, totalKm, metroKm, suburbanRailKm } of transitResults) {
		if (totalKm > 0) {
			results[cityId] = { totalKm, metroKm, suburbanRailKm };
		}
	}

	return results;
}

export async function buildQoLOverrides(): Promise<QoLOverrides> {
	const [safety, airQuality, no2Data, congestion, railTransit] = await Promise.all([
		getLatestSafetyData(),
		getAllCityPM25(),
		getAllCityNO2(),
		getAllCityCongestion(),
		buildRailTransitOverrides()
	]);

	const overrides: QoLOverrides = {};

	// Safety: traffic_fatalities + vru_fatality_share
	for (const [cityId, data] of Object.entries(safety)) {
		overrides[cityId] = { traffic_fatalities: data.fatalitiesPerLakh };
		if (data.vruFatalityShare !== null) {
			overrides[cityId].vru_fatality_share = data.vruFatalityShare;
		}
	}

	// Air quality: pm25_annual
	for (const [cityId, data] of Object.entries(airQuality)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], pm25_annual: data.pm25Avg };
		}
	}

	// Air quality: no2_annual
	for (const [cityId, data] of Object.entries(no2Data)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], no2_annual: data.no2Avg };
		}
	}

	// Congestion: congestion_level
	for (const [cityId, data] of Object.entries(congestion)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], congestion_level: data.congestionPct };
		}
	}

	// Rail transit: rail_transit_km (metro + suburban from Overpass geometries)
	// Also stores metro_km and suburban_rail_km as display-only breakdown fields
	// (not in INDICATOR_DEFINITIONS, so they don't affect scoring)
	for (const [cityId, breakdown] of Object.entries(railTransit)) {
		overrides[cityId] = {
			...overrides[cityId],
			rail_transit_km: breakdown.totalKm,
			metro_km: breakdown.metroKm,
			suburban_rail_km: breakdown.suburbanRailKm
		};
	}

	return overrides;
}
