import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { getAllCityPM25 } from '$lib/server/air-quality';
import { getAllCityCongestion } from '$lib/server/traffic-flow';

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		const [airQuality, congestion] = await Promise.all([
			getAllCityPM25(),
			getAllCityCongestion()
		]);

		const today = new Date().toISOString().split('T')[0];
		let aqUpserted = 0;
		let congestionUpserted = 0;

		// Persist air quality snapshots
		for (const [cityId, data] of Object.entries(airQuality)) {
			if (!data) continue;
			const { error } = await supabaseAdmin
				.from('air_quality_daily')
				.upsert(
					{
						city_id: cityId,
						date: today,
						pm25_avg: data.pm25Avg,
						pm25_max: data.pm25Max,
						stations_reporting: data.stationsReporting,
						readings: data.readings
					},
					{ onConflict: 'city_id,date' }
				);
			if (!error) aqUpserted++;
		}

		// Persist congestion snapshots
		for (const [cityId, data] of Object.entries(congestion)) {
			if (!data) continue;
			const { error } = await supabaseAdmin
				.from('city_congestion_daily')
				.upsert(
					{
						city_id: cityId,
						date: today,
						congestion_pct: data.congestionPct,
						avg_current_speed: data.avgCurrentSpeed,
						avg_free_flow_speed: data.avgFreeFlowSpeed,
						points_reporting: data.pointsReporting
					},
					{ onConflict: 'city_id,date' }
				);
			if (!error) congestionUpserted++;
		}

		return json({
			success: true,
			synced: {
				air_quality: aqUpserted,
				congestion: congestionUpserted,
				date: today
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
