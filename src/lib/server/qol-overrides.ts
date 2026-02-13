/**
 * Shared QoL overrides builder.
 * Fetches live data from all four automated sources (safety, PM2.5, NO2, congestion)
 * and assembles a QoLOverrides object for use in computeCityQoL().
 *
 * Used by all page servers that display QoL scores to avoid duplicating
 * the override-building block.
 */

import { getLatestSafetyData } from './safety-data';
import { getAllCityPM25, getAllCityNO2 } from './air-quality';
import { getAllCityCongestion } from './traffic-flow';
import type { QoLOverrides } from '$lib/config/city-qol-data';

export async function buildQoLOverrides(): Promise<QoLOverrides> {
	const [safety, airQuality, no2Data, congestion] = await Promise.all([
		getLatestSafetyData(),
		getAllCityPM25(),
		getAllCityNO2(),
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

	for (const [cityId, data] of Object.entries(no2Data)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], no2_annual: data.no2Avg };
		}
	}

	for (const [cityId, data] of Object.entries(congestion)) {
		if (data) {
			overrides[cityId] = { ...overrides[cityId], congestion_level: data.congestionPct };
		}
	}

	return overrides;
}
