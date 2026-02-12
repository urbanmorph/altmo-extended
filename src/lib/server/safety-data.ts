/**
 * Server-side safety data fetcher with in-memory cache.
 * Reads latest traffic fatality rates from Supabase city_safety_annual table.
 * Same pattern as air-quality.ts: fetch + 24h cache + graceful fallback.
 */

import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface SafetyDataPoint {
	fatalitiesPerLakh: number;
	year: number;
	source: string;
}

interface CacheEntry {
	data: Record<string, SafetyDataPoint>;
	timestamp: number;
}

let cache: CacheEntry | null = null;

/**
 * Fetch the latest safety data for all cities.
 * Returns a map of cityId -> { fatalitiesPerLakh, year, source }.
 * Returns empty object if Supabase is unreachable (graceful fallback).
 */
export async function getLatestSafetyData(): Promise<Record<string, SafetyDataPoint>> {
	if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
		return cache.data;
	}

	const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;
	const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || publicEnv.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseKey) {
		return {};
	}

	try {
		const supabase = createClient(supabaseUrl, supabaseKey);

		// Get the latest year per city using distinct on
		const { data, error } = await supabase
			.from('city_safety_annual')
			.select('city_id, year, fatalities_per_lakh, source')
			.order('city_id')
			.order('year', { ascending: false });

		if (error || !data) {
			console.warn('Safety data fetch failed:', error?.message);
			return cache?.data ?? {};
		}

		// Keep only the latest year per city
		const result: Record<string, SafetyDataPoint> = {};
		for (const row of data) {
			if (!result[row.city_id]) {
				result[row.city_id] = {
					fatalitiesPerLakh: Number(row.fatalities_per_lakh),
					year: row.year,
					source: row.source ?? 'Unknown'
				};
			}
		}

		cache = { data: result, timestamp: Date.now() };
		return result;
	} catch (err) {
		console.warn('Safety data fetch error:', err);
		return cache?.data ?? {};
	}
}
