import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { CITY_OPENAQ_LOCATIONS, fetchCityPM25 } from '$lib/config/air-quality';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // Compute yesterday's date range (UTC) for the 24h window
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const dateFrom = yesterday.toISOString();
    const dateTo = today.toISOString();
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD for the DB record

    const cityIds = Object.keys(CITY_OPENAQ_LOCATIONS);
    const results: Record<string, { pm25Avg: number; stationsReporting: number } | null> = {};
    let upsertCount = 0;

    // Fetch PM2.5 data for all cities in parallel
    const cityResults = await Promise.all(
      cityIds.map(async (cityId) => {
        const data = await fetchCityPM25(cityId, dateFrom, dateTo);
        return { cityId, data };
      })
    );

    // Upsert results into Supabase
    const rowsToUpsert = [];

    for (const { cityId, data } of cityResults) {
      if (data) {
        rowsToUpsert.push({
          city_id: cityId,
          date: dateStr,
          pm25_avg: data.pm25Avg,
          pm25_max: data.pm25Max,
          pm10_avg: null, // PM10 not yet collected
          stations_reporting: data.stationsReporting,
          source: 'openaq'
        });
        results[cityId] = {
          pm25Avg: data.pm25Avg,
          stationsReporting: data.stationsReporting
        };
      } else {
        results[cityId] = null;
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('air_quality_daily')
        .upsert(rowsToUpsert, { onConflict: 'city_id,date' });

      if (error) throw error;
      upsertCount = rowsToUpsert.length;
    }

    return json({
      success: true,
      date: dateStr,
      synced: upsertCount,
      cities: results
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
};
