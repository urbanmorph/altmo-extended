/**
 * Server-side fetcher for working Altmo Core (Rails) API endpoints.
 * Uses 24h in-memory cache (same pattern as air-quality.ts, traffic-flow.ts).
 * Graceful fallback: returns null if API unreachable or env vars missing.
 *
 * Response shapes verified 2026-02-14 (post-Apipie fix):
 *   /statistics/overall  → { success, overall_statistics: { people, activitiesCount, distance(m), co2Offset, fuelSaved, moneySaved } }
 *   /geo_markers          → { success, data: { geo_markers: [{ id, associable_type, associable_id, associable_name, lat, lon, layer_type, city_id }] } }
 *   /routes/bulk           → { success, data: { routes: [{ activity_id, activity_type, start_date, distance, path, ... }] } }
 */

import { railsApi } from '$lib/rails-api';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ──

export interface GlobalStats {
	people: number;
	activitiesCount: number;
	distanceKm: number;
	co2Offset: number;
	fuelSaved: number;
	moneySaved: number;
}

export interface GeoMarker {
	id: number;
	name: string;
	lat: number;
	lon: number;
	type: string;
	associableId: number;
	cityId: number | null;
}

// ── Cache ──

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const statsCache: { entry: CacheEntry<GlobalStats> | null } = { entry: null };
const geoMarkersCache: { entry: CacheEntry<GeoMarker[]> | null } = { entry: null };

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
	return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

// ── Fetchers ──

/**
 * GET /statistics/overall → global impact totals
 * Response: { success, overall_statistics: { people, activitiesCount, distance(metres), co2Offset(kg), fuelSaved(litres), moneySaved(INR) } }
 */
export async function getGlobalStats(): Promise<GlobalStats | null> {
	if (isFresh(statsCache.entry)) return statsCache.entry.data;

	try {
		const raw = await railsApi<{
			success: boolean;
			overall_statistics: {
				people: number;
				activitiesCount: number;
				distance: number;
				co2Offset: number;
				fuelSaved: number;
				moneySaved: number;
			};
		}>('/statistics/overall');

		const s = raw.overall_statistics;
		const data: GlobalStats = {
			people: s.people ?? 0,
			activitiesCount: s.activitiesCount ?? 0,
			distanceKm: Math.round((s.distance ?? 0) / 1000),
			co2Offset: Math.round(s.co2Offset ?? 0),
			fuelSaved: Math.round(s.fuelSaved ?? 0),
			moneySaved: Math.round(s.moneySaved ?? 0)
		};

		statsCache.entry = { data, timestamp: Date.now() };
		return data;
	} catch (err) {
		console.error('[altmo-core] Failed to fetch global stats:', err);
		return null;
	}
}

/**
 * GET /geo_markers → company/campus/transit point locations
 * Response: { success, data: { geo_markers: [{ id, associable_type, associable_id, associable_name, lat, lon, layer_type, city_id }] } }
 */
export async function getGeoMarkers(): Promise<GeoMarker[] | null> {
	if (isFresh(geoMarkersCache.entry)) return geoMarkersCache.entry.data;

	try {
		const raw = await railsApi<{
			success: boolean;
			data: {
				geo_markers: Array<{
					id: number;
					associable_type: string;
					associable_id: number;
					associable_name: string;
					lat: number;
					lon: number;
					layer_type: string | null;
					city_id: number | null;
				}>;
			};
		}>('/geo_markers');

		const data: GeoMarker[] = (raw.data?.geo_markers ?? []).map((m) => ({
			id: m.id,
			name: m.associable_name ?? '',
			lat: m.lat,
			lon: m.lon,
			type: m.associable_type ?? '',
			associableId: m.associable_id,
			cityId: m.city_id
		}));

		geoMarkersCache.entry = { data, timestamp: Date.now() };
		return data;
	} catch (err) {
		console.error('[altmo-core] Failed to fetch geo markers:', err);
		return null;
	}
}

