/**
 * Shared QoL overrides builder.
 * Fetches live data from all three automated sources (safety, air quality, congestion)
 * and assembles a QoLOverrides object for use in computeCityQoL().
 *
 * Used by all page servers that display QoL scores to avoid duplicating
 * the same ~20-line override-building block.
 */

import { getLatestSafetyData } from './safety-data';
import { getAllCityPM25 } from './air-quality';
import { getAllCityCongestion } from './traffic-flow';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export async function buildQoLOverrides(): Promise<QoLOverrides> {
	const [safety, airQuality, congestion] = await Promise.all([
		getLatestSafetyData(),
		getAllCityPM25(),
		getAllCityCongestion()
	]);

	const overrides: QoLOverrides = {};

	for (const [cityId, data] of Object.entries(safety)) {
		overrides[cityId] = { traffic_fatalities: data.fatalitiesPerLakh };
		if (data.vruFatalityShare !== null) {
			overrides[cityId].vru_fatality_share = data.vruFatalityShare;
		}
	}

	for (const [cityId, data] of Object.entries(airQuality)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], pm25_annual: data.pm25Avg };
		}
	}

	for (const [cityId, data] of Object.entries(congestion)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], congestion_level: data.congestionPct };
		}
	}

	return overrides;
}
