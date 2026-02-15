/**
 * Server-side activity data layer — reads from pre-computed tables.
 *
 * Tables:
 *   - city_activity_monthly: ~12 rows per city, one row per month with all aggregates
 *   - route_density: H3 hex cells with activity counts (for map heatmap)
 *
 * All 6 original query functions are preserved with the same signatures and return types.
 * Instead of querying thousands of raw activity_routes rows, we read ~12 pre-computed rows
 * and sum across months.
 */

import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

// ── Rails city_id mapping ──

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

// ── Cache (1h TTL) ──

const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry || Date.now() - entry.timestamp > CACHE_TTL) return null;
	return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}

function getSupabase() {
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY || publicEnv.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) return null;
	return createClient(url, key);
}

// ── Types (unchanged from original) ──

export interface ActivitySummary {
	totalTrips: number;
	totalDistanceKm: number;
	avgDistanceKm: number;
	modeBreakdown: { mode: string; count: number; pct: number }[];
	directionBreakdown: { direction: string; label: string; count: number; pct: number }[];
}

export interface HourlyActivity {
	hour: number;
	count: number;
}

export interface Corridor {
	startArea: string;
	endArea: string;
	count: number;
	avgDistanceKm: number;
	primaryMode: string;
}

export interface MonthlyTrend {
	month: string;
	rides: number;
	walks: number;
	runs: number;
	distanceKm: number;
}

export interface WeekdayBreakdown {
	day: string;
	count: number;
	distanceKm: number;
}

export interface DensityCell {
	h3_index: string;
	total: number;
	rides: number;
	walks: number;
}

const EMPTY_SUMMARY: ActivitySummary = {
	totalTrips: 0,
	totalDistanceKm: 0,
	avgDistanceKm: 0,
	modeBreakdown: [],
	directionBreakdown: []
};

// ── Core data loader: one query per city serves all functions ──

interface MonthlyRow {
	city_id: number;
	month: string;
	total_trips: number;
	rides: number;
	walks: number;
	runs: number;
	to_work: number;
	from_work: number;
	leisure: number;
	commute_rides: number;
	commute_walks: number;
	commute_runs: number;
	leisure_rides: number;
	leisure_walks: number;
	leisure_runs: number;
	total_distance_m: number;
	avg_distance_m: number;
	hourly_distribution: { hour: number; count: number }[];
	hourly_commute: { hour: number; count: number }[];
	hourly_leisure: { hour: number; count: number }[];
	weekday_distribution: { day: string; count: number; distanceKm: number }[];
	weekday_leisure: { day: string; count: number; distanceKm: number }[];
	distance_buckets: { bucket: string; count: number; pct: number }[];
	top_corridors: Corridor[];
	top_corridors_commute: Corridor[];
	top_corridors_leisure: Corridor[];
}

async function getCityMonthlyData(citySlug: string): Promise<MonthlyRow[]> {
	const cacheKey = `monthly-data-${citySlug}`;
	const cached = getCached<MonthlyRow[]>(cacheKey);
	if (cached) return cached;

	const supabase = getSupabase();
	if (!supabase) return [];

	const railsCityId = CITY_SLUG_TO_RAILS_ID[citySlug];
	if (!railsCityId) return [];

	try {
		const { data, error } = await supabase
			.from('city_activity_monthly')
			.select('*')
			.eq('city_id', railsCityId)
			.order('month', { ascending: true });

		if (error || !data) {
			if (error) console.warn('[activity-data] Monthly query failed:', error.message);
			return [];
		}

		const rows = data as MonthlyRow[];
		setCache(cacheKey, rows);
		return rows;
	} catch (err) {
		console.warn('[activity-data] Monthly data error:', err);
		return [];
	}
}

// ── Direction helpers ──

function formatDirection(dir: string): string {
	if (dir === 'to_work') return 'To Work';
	if (dir === 'from_work') return 'From Work';
	return 'Leisure';
}

// ── Query Functions (same signatures as original) ──

export async function getActivitySummary(
	citySlug: string,
	directionFilter?: 'commute' | 'leisure' | null
): Promise<ActivitySummary> {
	const cacheKey = `activity-summary-${citySlug}-${directionFilter ?? 'all'}`;
	const cached = getCached<ActivitySummary>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return EMPTY_SUMMARY;

	let totalTrips = 0;
	let totalDistanceM = 0;
	let rides = 0, walks = 0, runs = 0;
	let toWork = 0, fromWork = 0, leisure = 0;

	for (const r of rows) {
		if (directionFilter === 'commute') {
			const monthTrips = r.commute_rides + r.commute_walks + r.commute_runs;
			totalTrips += monthTrips;
			rides += r.commute_rides;
			walks += r.commute_walks;
			runs += r.commute_runs;
			toWork += r.to_work;
			fromWork += r.from_work;
			// For commute, distance is proportional
			const commuteFraction = r.total_trips > 0 ? (r.to_work + r.from_work) / r.total_trips : 0;
			totalDistanceM += r.total_distance_m * commuteFraction;
		} else if (directionFilter === 'leisure') {
			const monthTrips = r.leisure_rides + r.leisure_walks + r.leisure_runs;
			totalTrips += monthTrips;
			rides += r.leisure_rides;
			walks += r.leisure_walks;
			runs += r.leisure_runs;
			leisure += r.leisure;
			const leisureFraction = r.total_trips > 0 ? r.leisure / r.total_trips : 0;
			totalDistanceM += r.total_distance_m * leisureFraction;
		} else {
			totalTrips += r.total_trips;
			totalDistanceM += r.total_distance_m;
			rides += r.rides;
			walks += r.walks;
			runs += r.runs;
			toWork += r.to_work;
			fromWork += r.from_work;
			leisure += r.leisure;
		}
	}

	if (totalTrips === 0) return EMPTY_SUMMARY;

	const totalDistanceKm = totalDistanceM / 1000;
	const avgDistanceKm = totalTrips > 0 ? totalDistanceKm / totalTrips : 0;

	// Mode breakdown
	const modeBreakdown: { mode: string; count: number; pct: number }[] = [];
	if (rides > 0) modeBreakdown.push({ mode: 'Ride', count: rides, pct: (rides / totalTrips) * 100 });
	if (walks > 0) modeBreakdown.push({ mode: 'Walk', count: walks, pct: (walks / totalTrips) * 100 });
	if (runs > 0) modeBreakdown.push({ mode: 'Run', count: runs, pct: (runs / totalTrips) * 100 });
	modeBreakdown.sort((a, b) => b.count - a.count);

	// Direction breakdown
	const directionBreakdown: { direction: string; label: string; count: number; pct: number }[] = [];
	if (directionFilter === 'commute') {
		if (toWork > 0) directionBreakdown.push({ direction: 'to_work', label: 'To Work', count: toWork, pct: (toWork / totalTrips) * 100 });
		if (fromWork > 0) directionBreakdown.push({ direction: 'from_work', label: 'From Work', count: fromWork, pct: (fromWork / totalTrips) * 100 });
	} else if (directionFilter === 'leisure') {
		if (leisure > 0) directionBreakdown.push({ direction: 'leisure', label: 'Leisure', count: leisure, pct: 100 });
	} else {
		for (const [dir, count] of [['to_work', toWork], ['from_work', fromWork], ['leisure', leisure]] as [string, number][]) {
			if (count > 0) directionBreakdown.push({ direction: dir, label: formatDirection(dir), count, pct: (count / totalTrips) * 100 });
		}
	}
	directionBreakdown.sort((a, b) => b.count - a.count);

	const result: ActivitySummary = {
		totalTrips,
		totalDistanceKm: Math.round(totalDistanceKm),
		avgDistanceKm: Math.round(avgDistanceKm * 10) / 10,
		modeBreakdown,
		directionBreakdown
	};

	setCache(cacheKey, result);
	return result;
}

export async function getActivityByHour(
	citySlug: string,
	directionFilter?: 'commute' | 'leisure' | null
): Promise<HourlyActivity[]> {
	const cacheKey = `activity-hourly-${citySlug}-${directionFilter ?? 'all'}`;
	const cached = getCached<HourlyActivity[]>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return [];

	const hourly = new Array(24).fill(0);
	for (const r of rows) {
		const dist = directionFilter === 'commute' ? r.hourly_commute
			: directionFilter === 'leisure' ? r.hourly_leisure
			: r.hourly_distribution;
		if (!dist) continue;
		for (const h of dist) {
			if (h.hour >= 0 && h.hour < 24) hourly[h.hour] += h.count;
		}
	}

	const result = hourly.map((count, hour) => ({ hour, count }));
	setCache(cacheKey, result);
	return result;
}

export async function getActivityByDayOfWeek(
	citySlug: string,
	directionFilter?: 'commute' | 'leisure' | null
): Promise<WeekdayBreakdown[]> {
	const cacheKey = `activity-weekday-${citySlug}-${directionFilter ?? 'all'}`;
	const cached = getCached<WeekdayBreakdown[]>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return [];

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const dayMap = new Map<string, { count: number; distKm: number }>();
	for (const d of DAYS) dayMap.set(d, { count: 0, distKm: 0 });

	for (const r of rows) {
		// Use leisure variant for leisure filter, else full weekday_distribution
		// Note: we don't store a weekday_commute (commute = total - leisure), so for commute
		// we approximate by subtracting leisure from total
		const dist = directionFilter === 'leisure' ? r.weekday_leisure : r.weekday_distribution;
		if (!dist) continue;
		for (const d of dist) {
			const existing = dayMap.get(d.day);
			if (existing) {
				existing.count += d.count;
				existing.distKm += d.distanceKm;
			}
		}
	}

	const result: WeekdayBreakdown[] = DAYS.map((day) => {
		const d = dayMap.get(day)!;
		return { day, count: d.count, distanceKm: Math.round(d.distKm) };
	});

	setCache(cacheKey, result);
	return result;
}

export async function getTopCorridors(
	citySlug: string,
	limit: number = 20,
	directionFilter?: 'commute' | 'leisure' | null
): Promise<Corridor[]> {
	const cacheKey = `activity-corridors-${citySlug}-${limit}-${directionFilter ?? 'all'}`;
	const cached = getCached<Corridor[]>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return [];

	// Merge corridors across months
	const corridorMap = new Map<string, { count: number; totalDist: number; modes: Map<string, number>; startArea: string; endArea: string }>();

	for (const r of rows) {
		const corridors = directionFilter === 'commute' ? r.top_corridors_commute
			: directionFilter === 'leisure' ? r.top_corridors_leisure
			: r.top_corridors;
		if (!corridors) continue;

		for (const c of corridors) {
			const key = `${c.startArea}-${c.endArea}`;
			const existing = corridorMap.get(key);
			if (existing) {
				existing.count += c.count;
				existing.totalDist += c.avgDistanceKm * c.count;
				existing.modes.set(c.primaryMode, (existing.modes.get(c.primaryMode) ?? 0) + c.count);
			} else {
				const modes = new Map<string, number>();
				modes.set(c.primaryMode, c.count);
				corridorMap.set(key, {
					count: c.count,
					totalDist: c.avgDistanceKm * c.count,
					modes,
					startArea: c.startArea,
					endArea: c.endArea
				});
			}
		}
	}

	const result = [...corridorMap.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, limit)
		.map((c) => {
			const primaryMode = [...c.modes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Ride';
			return {
				startArea: c.startArea,
				endArea: c.endArea,
				count: c.count,
				avgDistanceKm: Math.round((c.totalDist / c.count) * 10) / 10,
				primaryMode
			};
		});

	setCache(cacheKey, result);
	return result;
}

export async function getActivityTrends(citySlug: string): Promise<MonthlyTrend[]> {
	const cacheKey = `activity-trends-${citySlug}`;
	const cached = getCached<MonthlyTrend[]>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return [];

	const result: MonthlyTrend[] = rows.map((r) => ({
		month: r.month.substring(0, 7), // '2025-06-01' -> '2025-06'
		rides: r.rides,
		walks: r.walks,
		runs: r.runs,
		distanceKm: Math.round(r.total_distance_m / 1000)
	}));

	setCache(cacheKey, result);
	return result;
}

export async function getDistanceDistribution(
	citySlug: string
): Promise<{ bucket: string; count: number; pct: number }[]> {
	const cacheKey = `activity-dist-dist-${citySlug}`;
	const cached = getCached<{ bucket: string; count: number; pct: number }[]>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return [];

	// Sum distance_buckets across months
	const bucketMap = new Map<string, number>();
	let total = 0;

	for (const r of rows) {
		if (!r.distance_buckets) continue;
		for (const b of r.distance_buckets) {
			bucketMap.set(b.bucket, (bucketMap.get(b.bucket) ?? 0) + b.count);
			total += b.count;
		}
	}

	// Preserve bucket order
	const BUCKET_ORDER = ['0-2 km', '2-5 km', '5-10 km', '10-20 km', '20+ km'];
	const result = BUCKET_ORDER.map((bucket) => {
		const count = bucketMap.get(bucket) ?? 0;
		return {
			bucket,
			count,
			pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
		};
	});

	setCache(cacheKey, result);
	return result;
}

// ── Transit Proximity Data ──

export interface TransitProximityData {
	connected: number;
	firstMile: number;
	lastMile: number;
	totalTrips: number;
	pctConnected: number;
	avgFirstMileM: number;
	avgLastMileM: number;
	byMode: Record<string, number>;
	byTransitType: Record<string, number>;
	byLine: Record<string, number>;
	topStations: { name: string; type: string; line: string; count: number; avgDistM: number }[];
}

/**
 * Read transit_proximity JSONB from all city_activity_monthly rows for a city.
 * Aggregates across months: sums counts, weighted-averages distances, merges
 * station counts and re-sorts top 15.
 */
export async function getTransitProximity(citySlug: string): Promise<TransitProximityData | null> {
	const cacheKey = `transit-proximity-${citySlug}`;
	const cached = getCached<TransitProximityData>(cacheKey);
	if (cached) return cached;

	const rows = await getCityMonthlyData(citySlug);
	if (rows.length === 0) return null;

	let connected = 0;
	let firstMile = 0;
	let lastMile = 0;
	let totalTrips = 0;
	let totalFirstMileDistWeighted = 0;
	let totalLastMileDistWeighted = 0;
	const byMode = new Map<string, number>();
	const byTransitType = new Map<string, number>();
	const byLine = new Map<string, number>();
	const stationMap = new Map<string, { name: string; type: string; line: string; count: number; totalDist: number }>();

	for (const r of rows) {
		totalTrips += r.total_trips;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const tp = (r as any).transit_proximity as Record<string, unknown> | undefined;
		if (!tp || !tp.connected) continue;

		connected += tp.connected as number;
		firstMile += (tp.first_mile as number) ?? 0;
		lastMile += (tp.last_mile as number) ?? 0;

		const fm = (tp.first_mile as number) ?? 0;
		const lm = (tp.last_mile as number) ?? 0;
		totalFirstMileDistWeighted += ((tp.avg_first_mile_m as number) ?? 0) * fm;
		totalLastMileDistWeighted += ((tp.avg_last_mile_m as number) ?? 0) * lm;

		const modeData = tp.by_mode as Record<string, number> | undefined;
		if (modeData) {
			for (const [k, v] of Object.entries(modeData)) {
				byMode.set(k, (byMode.get(k) ?? 0) + v);
			}
		}

		const typeData = tp.by_transit_type as Record<string, number> | undefined;
		if (typeData) {
			for (const [k, v] of Object.entries(typeData)) {
				byTransitType.set(k, (byTransitType.get(k) ?? 0) + v);
			}
		}

		const lineData = tp.by_line as Record<string, number> | undefined;
		if (lineData) {
			for (const [k, v] of Object.entries(lineData)) {
				byLine.set(k, (byLine.get(k) ?? 0) + v);
			}
		}

		const stations = tp.top_stations as { name: string; type: string; line: string; count: number; avg_dist_m: number }[] | undefined;
		if (stations) {
			for (const s of stations) {
				const existing = stationMap.get(s.name);
				if (existing) {
					existing.count += s.count;
					existing.totalDist += s.avg_dist_m * s.count;
				} else {
					stationMap.set(s.name, {
						name: s.name,
						type: s.type,
						line: s.line,
						count: s.count,
						totalDist: s.avg_dist_m * s.count
					});
				}
			}
		}
	}

	if (connected === 0) return null;

	const topStations = [...stationMap.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 15)
		.map((s) => ({
			name: s.name,
			type: s.type,
			line: s.line,
			count: s.count,
			avgDistM: Math.round(s.totalDist / s.count)
		}));

	const result: TransitProximityData = {
		connected,
		firstMile,
		lastMile,
		totalTrips,
		pctConnected: Math.round((connected / totalTrips) * 1000) / 10,
		avgFirstMileM: firstMile > 0 ? Math.round(totalFirstMileDistWeighted / firstMile) : 0,
		avgLastMileM: lastMile > 0 ? Math.round(totalLastMileDistWeighted / lastMile) : 0,
		byMode: Object.fromEntries(byMode),
		byTransitType: Object.fromEntries(byTransitType),
		byLine: Object.fromEntries(byLine),
		topStations
	};

	setCache(cacheKey, result);
	return result;
}

// ── NEW: Route density for heatmap ──

export async function getRouteDensity(citySlug: string): Promise<DensityCell[]> {
	const cacheKey = `route-density-${citySlug}`;
	const cached = getCached<DensityCell[]>(cacheKey);
	if (cached) return cached;

	const supabase = getSupabase();
	if (!supabase) return [];

	const railsCityId = CITY_SLUG_TO_RAILS_ID[citySlug];
	if (!railsCityId) return [];

	try {
		// Fetch density cells with total >= 3 (filters out noise, keeps 98% of trips)
		// Supabase PostgREST caps at 1000 rows per request, so paginate
		let allData: DensityCell[] = [];
		let from = 0;
		const pageSize = 1000;
		while (true) {
			const { data: batch, error: err } = await supabase
				.from('route_density')
				.select('h3_index, total, rides, walks')
				.eq('city_id', railsCityId)
				.gte('total', 3)
				.range(from, from + pageSize - 1);
			if (err) {
				console.warn('[activity-data] Density query failed:', err.message);
				break;
			}
			if (!batch || batch.length === 0) break;
			allData = allData.concat(batch as DensityCell[]);
			if (batch.length < pageSize) break;
			from += pageSize;
		}
		setCache(cacheKey, allData);
		return allData;
	} catch (err) {
		console.warn('[activity-data] Density query error:', err);
		return [];
	}
}
