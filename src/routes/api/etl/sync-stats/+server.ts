import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { railsApi } from '$lib/rails-api';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

interface LeaderboardEntry {
	rank: number;
	company_name: string;
	percentage: number;
	riders: number;
	rides: number;
	carbon_credits: number;
	city_id: number;
}

interface DailyStatEntry {
	date: string;
	facilities: number;
	riders: number;
	rides: number;
	distance: number;
	co2_saved: number;
	petrol_saved: number;
}

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		const [leaderboard, globalStats] = await Promise.all([
			// Singular path, JBuilder returns { leaderboards_list: [...] }
			railsApi<{ leaderboards_list: LeaderboardEntry[] }>('/api/v1/leaderboard'),
			// Returns { success, code, results: [...] } — 90 days rolling
			railsApi<{ success: boolean; results: DailyStatEntry[] }>('/api/v1/stats/global')
		]);

		const results = { leaderboards: 0, dailyStats: 0 };

		// Leaderboard: upsert on company_name (full snapshot each sync)
		const entries = leaderboard.leaderboards_list;
		if (entries?.length) {
			const rows = entries.map((e) => ({
				company_name: e.company_name,
				rank: e.rank,
				percentage: e.percentage,
				riders: e.riders,
				rides: e.rides,
				carbon_credits: e.carbon_credits,
				city_id: e.city_id,
				synced_at: new Date().toISOString()
			}));
			const { error } = await supabaseAdmin
				.from('leaderboards')
				.upsert(rows, { onConflict: 'company_name' });
			if (error) throw error;
			results.leaderboards = entries.length;
		}

		// Daily stats: upsert on date
		const stats = globalStats.results;
		if (stats?.length) {
			const rows = stats.map((s) => ({
				date: s.date,
				facilities: s.facilities,
				riders: s.riders,
				rides: s.rides,
				distance: s.distance,
				co2_saved: s.co2_saved,
				petrol_saved: s.petrol_saved,
				synced_at: new Date().toISOString()
			}));
			const { error } = await supabaseAdmin
				.from('daily_stats')
				.upsert(rows, { onConflict: 'date' });
			if (error) throw error;
			results.dailyStats = stats.length;
		}

		return json({ success: true, synced: results });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
